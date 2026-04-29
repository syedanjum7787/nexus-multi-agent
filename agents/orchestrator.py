"""
Primary Orchestrator Agent — Groq version
"""
import os, json, uuid
from groq import Groq

from agents.task_agent import TaskAgent
from agents.calendar_agent import CalendarAgent
from agents.notes_agent import NotesAgent
from agents.mcp_tools import ToolRegistry
from database.db import init_db, log_action

_GROQ_KEY = os.environ.get("GROQ_API_KEY", "")

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
        self._task_agent = TaskAgent()
        self._calendar_agent = CalendarAgent()
        self._notes_agent = NotesAgent()
        self.registry = ToolRegistry()
        self.registry.register_agent(self._task_agent)
        self.registry.register_agent(self._calendar_agent)
        self.registry.register_agent(self._notes_agent)
        tool_schema = self.registry.build_prompt_schema()
        self._system_prompt = BASE_SYSTEM_PROMPT.format(tool_schema=tool_schema)
        self._has_ai = bool(_GROQ_KEY)
        self.client = None
        if self._has_ai:
            try:
                self.client = Groq(api_key=_GROQ_KEY)
            except Exception:
                self._has_ai = False
        self._session_memory: dict[str, list[dict]] = {}

    def run(self, user_query: str, session_id: str = None) -> dict:
        session_id = session_id or str(uuid.uuid4())[:8]
        plan = self._plan(user_query, session_id)
        if "error" in plan:
            return plan
        steps = plan.get("steps", [])
        summary = plan.get("summary", "Processing your request.")
        results = []
        step_outputs = {}
        for i, step in enumerate(steps):
            tool_name = step.get("tool")
            params = step.get("params", {})
            params = self._resolve_dependencies(params, step_outputs)
            result = self.registry.execute(
                tool_name=tool_name,
                params=params,
                session_id=session_id,
                user_query=user_query
            )
            step_outputs[i] = result.get("data", {})
            results.append(result)
        log_action(session_id, user_query, "Orchestrator",
                   f"{len(steps)}-step workflow", summary)
        self._remember(session_id, user_query, summary)
        return {
            "session_id": session_id,
            "query": user_query,
            "plan_summary": summary,
            "steps_executed": len(steps),
            "results": results
        }

    def _plan(self, user_query: str, session_id: str) -> dict:
        if not self._has_ai or not self.client:
            return {
                "error": "GROQ_API_KEY not set. Get a free key at https://console.groq.com. "
                         "Tasks, Calendar, Notes and MCP Tools work without AI."
            }
        try:
            context = self._get_session_context(session_id)
            prompt = user_query
            if context:
                prompt = f"Previous context: {context}\n\nCurrent request: {user_query}"
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                raw = "\n".join(lines)
            plan = json.loads(raw)
            for step in plan.get("steps", []):
                tool_name = step.get("tool")
                if not self.registry.get(tool_name):
                    step["tool"] = self._fuzzy_match_tool(tool_name)
            return plan
        except json.JSONDecodeError as e:
            return {"error": f"Planning failed: AI returned invalid JSON — {str(e)}"}
        except Exception as e:
            return {"error": f"Planning failed: {str(e)}"}

    def _resolve_dependencies(self, params: dict, step_outputs: dict) -> dict:
        resolved = {}
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("$ref("):
                try:
                    ref = value[5:-1]
                    step_idx, field = ref.split(".")
                    resolved[key] = step_outputs.get(int(step_idx), {}).get(field, value)
                except Exception:
                    resolved[key] = value
            else:
                resolved[key] = value
        return resolved

    def _fuzzy_match_tool(self, tool_name: str) -> str:
        if not tool_name:
            return tool_name
        if self.registry.get(tool_name):
            return tool_name
        for t in self.registry.list_tools():
            if t["name"].lower() == tool_name.lower():
                return t["name"]
        return tool_name

    def _remember(self, session_id: str, query: str, summary: str):
        if session_id not in self._session_memory:
            self._session_memory[session_id] = []
        self._session_memory[session_id].append({"query": query, "summary": summary})
        self._session_memory[session_id] = self._session_memory[session_id][-5:]

    def _get_session_context(self, session_id: str) -> str:
        history = self._session_memory.get(session_id, [])
        if not history:
            return ""
        return "; ".join([f"Q: {h['query']} → {h['summary']}" for h in history[-3:]])
