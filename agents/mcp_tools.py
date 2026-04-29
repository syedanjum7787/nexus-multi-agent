"""
MCP Tool Registry — Model Context Protocol style tool discovery and execution.

Each sub-agent registers its capabilities as structured tools with:
  - name: unique identifier
  - description: what it does (used by the orchestrator to plan)
  - parameters: JSON Schema of accepted params
  - execute: callable that runs the tool

The orchestrator dynamically builds its system prompt from registered tools,
and dispatches executions through the registry.
"""
from dataclasses import dataclass, field
from typing import Callable, Any


@dataclass
class Tool:
    """A single MCP-style tool with structured schema and executor."""
    name: str
    agent: str
    description: str
    parameters: dict  # JSON Schema
    execute: Callable[..., dict] = field(repr=False)


class ToolRegistry:
    """Central registry for all MCP tools across agents."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool):
        """Register a tool. Raises if duplicate name."""
        if tool.name in self._tools:
            raise ValueError(f"Duplicate tool name: {tool.name}")
        self._tools[tool.name] = tool

    def register_agent(self, agent):
        """Register all tools from an agent that implements get_tools()."""
        if hasattr(agent, 'get_tools'):
            for tool in agent.get_tools():
                self.register(tool)

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def execute(self, tool_name: str, params: dict, session_id: str = "",
                user_query: str = "") -> dict:
        """Execute a tool by name with given params."""
        tool = self._tools.get(tool_name)
        if not tool:
            return {
                "agent": "ToolRegistry",
                "action": tool_name,
                "message": f"Unknown tool: {tool_name}",
                "data": {}
            }
        try:
            return tool.execute(params=params, session_id=session_id,
                                user_query=user_query)
        except Exception as e:
            return {
                "agent": tool.agent,
                "action": tool_name,
                "message": f"Tool execution failed: {str(e)}",
                "data": {}
            }

    def list_tools(self) -> list[dict]:
        """Return a summary list of all registered tools (for API/UI)."""
        return [
            {
                "name": t.name,
                "agent": t.agent,
                "description": t.description,
                "parameters": t.parameters,
            }
            for t in self._tools.values()
        ]

    def build_prompt_schema(self) -> str:
        """Build a structured tool listing for the orchestrator's system prompt."""
        lines = []
        # Group tools by agent
        agents: dict[str, list[Tool]] = {}
        for tool in self._tools.values():
            agents.setdefault(tool.agent, []).append(tool)

        for agent_name, tools in agents.items():
            lines.append(f"\n### {agent_name}")
            for t in tools:
                lines.append(f"- **{t.name}**: {t.description}")
                if t.parameters.get("properties"):
                    props = t.parameters["properties"]
                    required = set(t.parameters.get("required", []))
                    param_parts = []
                    for pname, pschema in props.items():
                        req = " (required)" if pname in required else ""
                        desc = pschema.get("description", "")
                        param_parts.append(f"  - `{pname}`: {desc}{req}")
                    lines.append("  Parameters:")
                    lines.extend(param_parts)
        return "\n".join(lines)

    @property
    def tool_count(self) -> int:
        return len(self._tools)

    @property
    def agent_names(self) -> list[str]:
        return list({t.agent for t in self._tools.values()})
