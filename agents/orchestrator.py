"""
Primary Orchestrator Agent
Uses Google Gemini AI to understand user intent and coordinate sub-agents
via the MCP tool registry. Supports multi-step workflows with dependency
resolution between steps and error recovery.
"""
import os, json, uuid
import google.generativeai as genai

from agents.task_agent import TaskAgent
from agents.calendar_agent import CalendarAgent
from agents.notes_agent import NotesAgent
from agents.mcp_tools import ToolRegistry
from database.db import init_db, log_action

# Configure Gemini (may be empty — checked at runtime)
_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
if _GEMINI_KEY:
    genai.configure(api_key=_GEMINI_KEY)

# Base system prompt — tool schema is appended dynamically
BASE_SYSTEM_PROMPT = """You are the orchestrator for NEXUS, a multi-agent productivity system.
Your job is to analyze the user's request and produce a JSON plan of tool calls.

## Available MCP Tools
{tool_schema}

## Response Format
Respond ONLY with a JSON object like:
{{
  "steps": [
    {{"tool": "<tool_name>", "params": {{...}} }},
    {{"tool": "<tool_name>", "params": {{...}} }}
  ],
  "summary": "One sentence describing what you will do."
}}

## Rules
1. Use exact tool names from the list above.
2. Include ALL required parameters for each tool.
3. If the request needs multiple tools, include multiple steps.
4. Keep params minimal and correct.
5. For dates, use YYYY-MM-DD format. For times, use YYYY-MM-DD HH:MM.
6. Do NOT include any text outside the JSON. No markdown fences. Just pure JSON.
"""


class OrchestratorAgent:
    def __init__(self):
        init_db()

        # Create sub-agents
        self._task_agent = TaskAgent()
        self._calendar_agent = CalendarAgent()
        self._notes_agent = NotesAgent()

        # Build MCP tool registry from sub-agents
        self.registry = ToolRegistry()
        self.registry.register_agent(self._task_agent)
        self.registry.register_agent(self._calendar_agent)
        self.registry.register_agent(self._notes_agent)

        # Build dynamic system prompt from registered tools
        tool_schema = self.registry.build_prompt_schema()
        system_prompt = BASE_SYSTEM_PROMPT.format(tool_schema=tool_schema)

        # Only create the Gemini model if API key is present
        self._has_ai = bool(_GEMINI_KEY)
        self.model = None
        if self._has_ai:
            try:
                self.model = genai.GenerativeModel(
                    model_name="gemini-2.0-flash",
                    system_instruction=system_prompt,
                )
            except Exception:
                self._has_ai = False

        # Simple session memory (last few queries per session)
        self._session_memory: dict[str, list[dict]] = {}

    def run(self, user_query: str, session_id: str = None) -> dict:
        session_id = session_id or str(uuid.uuid4())[:8]

        # Step 1: Ask Gemini to plan the workflow
        plan = self._plan(user_query, session_id)
        if "error" in plan:
            return plan

        steps = plan.get("steps", [])
        summary = plan.get("summary", "Processing your request.")
        results = []
        step_outputs = {}  # Track outputs for dependency resolution

        # Step 2: Execute each step through the MCP tool registry
        for i, step in enumerate(steps):
            tool_name = step.get("tool")
            params = step.get("params", {})

            # Dependency resolution: replace $ref placeholders from previous steps
            params = self._resolve_dependencies(params, step_outputs)

            # Execute through the MCP registry
            result = self.registry.execute(
                tool_name=tool_name,
                params=params,
                session_id=session_id,
                user_query=user_query
            )

            # Track output for potential downstream dependencies
            step_outputs[i] = result.get("data", {})
            results.append(result)

        log_action(session_id, user_query, "Orchestrator",
                   f"{len(steps)}-step workflow", summary)

        # Store in session memory
        self._remember(session_id, user_query, summary)

        return {
            "session_id": session_id,
            "query": user_query,
            "plan_summary": summary,
            "steps_executed": len(steps),
            "results": results
        }

    def _plan(self, user_query: str, session_id: str) -> dict:
        """Use Gemini to create an execution plan from natural language."""
        if not self._has_ai or not self.model:
            return {
                "error": "GEMINI_API_KEY not set. Run: export GEMINI_API_KEY=your_key_here && python3 main.py — "
                         "Get a free key at https://aistudio.google.com/apikey. "
                         "Note: Tasks, Calendar, Notes, and MCP Tools work without AI — "
                         "only the Orchestrate tab requires a Gemini API key."
            }
        try:
            # Include session memory for context-aware planning
            context = self._get_session_context(session_id)
            prompt = user_query
            if context:
                prompt = f"Previous context: {context}\n\nCurrent request: {user_query}"

            response = self.model.generate_content(prompt)
            raw = response.text.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                lines = raw.split("\n")
                # Remove first and last fence lines
                lines = [l for l in lines if not l.strip().startswith("```")]
                raw = "\n".join(lines)

            plan = json.loads(raw)

            # Validate that all tool names exist in the registry
            for step in plan.get("steps", []):
                tool_name = step.get("tool")
                if not self.registry.get(tool_name):
                    # Try to fix common naming issues
                    step["tool"] = self._fuzzy_match_tool(tool_name)

            return plan
        except json.JSONDecodeError as e:
            return {"error": f"Planning failed: AI returned invalid JSON — {str(e)}"}
        except Exception as e:
            return {"error": f"Planning failed: {str(e)}"}

    def _resolve_dependencies(self, params: dict, step_outputs: dict) -> dict:
        """Replace $ref(step_index.field) placeholders with actual values."""
        resolved = {}
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("$ref("):
                try:
                    ref = value[5:-1]  # strip $ref( and )
                    step_idx, field = ref.split(".")
                    resolved[key] = step_outputs.get(int(step_idx), {}).get(field, value)
                except Exception:
                    resolved[key] = value
            else:
                resolved[key] = value
        return resolved

    def _fuzzy_match_tool(self, tool_name: str) -> str:
        """Try to match a tool name approximately if Gemini uses a variation."""
        if not tool_name:
            return tool_name
        # Direct match
        if self.registry.get(tool_name):
            return tool_name
        # Try lowercase
        for t in self.registry.list_tools():
            if t["name"].lower() == tool_name.lower():
                return t["name"]
        return tool_name

    def _remember(self, session_id: str, query: str, summary: str):
        """Store query in session memory for context-aware planning."""
        if session_id not in self._session_memory:
            self._session_memory[session_id] = []
        self._session_memory[session_id].append({
            "query": query,
            "summary": summary,
        })
        # Keep only last 5 interactions per session
        self._session_memory[session_id] = self._session_memory[session_id][-5:]

    def _get_session_context(self, session_id: str) -> str:
        """Get session context for context-aware planning."""
        history = self._session_memory.get(session_id, [])
        if not history:
            return ""
        return "; ".join([f"Q: {h['query']} → {h['summary']}" for h in history[-3:]])
