"""
Task Sub-Agent
Handles: creating, listing, updating, completing, and deleting tasks.
Exposes MCP-style tool definitions via get_tools().
"""
from database.db import create_task, get_tasks, get_task_by_id, update_task, delete_task, log_action
from agents.mcp_tools import Tool


class TaskAgent:
    name = "TaskAgent"

    def get_tools(self) -> list[Tool]:
        """Return MCP-style tool definitions for this agent."""
        return [
            Tool(
                name="create_task",
                agent=self.name,
                description="Create a new task with title, description, priority, and optional due date.",
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Task title"},
                        "description": {"type": "string", "description": "Task description"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high"],
                                     "description": "Priority level (low/medium/high)"},
                        "due_date": {"type": "string", "description": "Due date in YYYY-MM-DD format"},
                    },
                    "required": ["title"],
                },
                execute=lambda **kw: self.handle("create_task", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="list_tasks",
                agent=self.name,
                description="List all tasks, optionally filtered by status (pending/completed).",
                parameters={
                    "type": "object",
                    "properties": {
                        "status": {"type": "string", "enum": ["pending", "completed"],
                                   "description": "Filter by status"},
                    },
                },
                execute=lambda **kw: self.handle("list_tasks", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="complete_task",
                agent=self.name,
                description="Mark a task as completed by task_id or by matching title.",
                parameters={
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "integer", "description": "Task ID to complete"},
                        "title": {"type": "string", "description": "Task title to match"},
                    },
                },
                execute=lambda **kw: self.handle("complete_task", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="update_task",
                agent=self.name,
                description="Update a task's fields (status, priority, description, due_date) by task_id.",
                parameters={
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "integer", "description": "Task ID to update"},
                        "status": {"type": "string", "description": "New status"},
                        "priority": {"type": "string", "description": "New priority"},
                        "description": {"type": "string", "description": "New description"},
                        "due_date": {"type": "string", "description": "New due date"},
                    },
                    "required": ["task_id"],
                },
                execute=lambda **kw: self.handle("update_task", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="delete_task",
                agent=self.name,
                description="Delete a task permanently by task_id or by matching title.",
                parameters={
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "integer", "description": "Task ID to delete"},
                        "title": {"type": "string", "description": "Task title to match for deletion"},
                    },
                },
                execute=lambda **kw: self.handle("delete_task", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
        ]

    def handle(self, intent: str, params: dict, session_id: str, user_query: str) -> dict:

        if intent == "create_task":
            result = create_task(
                title=params.get("title", "Untitled Task"),
                description=params.get("description", ""),
                priority=params.get("priority", "medium"),
                due_date=params.get("due_date", "")
            )
            log_action(session_id, user_query, self.name, "create_task", str(result))
            return {
                "agent": self.name,
                "action": "create_task",
                "message": f"Task created: '{result['title']}' (Priority: {result['priority']})",
                "data": result
            }

        elif intent == "list_tasks":
            status = params.get("status")
            tasks = get_tasks(status)
            log_action(session_id, user_query, self.name, "list_tasks", f"{len(tasks)} tasks")
            return {
                "agent": self.name,
                "action": "list_tasks",
                "message": f"Found {len(tasks)} task(s).",
                "data": tasks
            }

        elif intent == "complete_task":
            task_id = params.get("task_id")
            if not task_id:
                all_tasks = get_tasks()
                title = params.get("title", "").lower()
                matched = [t for t in all_tasks if title in t["title"].lower()]
                if matched:
                    task_id = matched[0]["id"]
            if task_id:
                result = update_task(int(task_id), status="completed")
                log_action(session_id, user_query, self.name, "complete_task", str(result))
                return {
                    "agent": self.name,
                    "action": "complete_task",
                    "message": f"Task '{result.get('title')}' marked as completed.",
                    "data": result
                }
            return {"agent": self.name, "action": "complete_task",
                    "message": "Task not found.", "data": {}}

        elif intent == "update_task":
            task_id = params.get("task_id")
            updates = {k: v for k, v in params.items() if k not in ("task_id", "title")}
            if task_id:
                result = update_task(int(task_id), **updates)
                log_action(session_id, user_query, self.name, "update_task", str(result))
                return {
                    "agent": self.name,
                    "action": "update_task",
                    "message": "Task updated.",
                    "data": result
                }
            return {"agent": self.name, "action": "update_task",
                    "message": "Task ID required.", "data": {}}

        elif intent == "delete_task":
            task_id = params.get("task_id")
            if not task_id:
                all_tasks = get_tasks()
                title = params.get("title", "").lower()
                matched = [t for t in all_tasks if title in t["title"].lower()]
                if matched:
                    task_id = matched[0]["id"]
            if task_id:
                # Get task info before deleting
                task_info = get_task_by_id(int(task_id))
                deleted = delete_task(int(task_id))
                if deleted:
                    log_action(session_id, user_query, self.name, "delete_task",
                               f"Deleted task {task_id}")
                    return {
                        "agent": self.name,
                        "action": "delete_task",
                        "message": f"Task '{task_info.get('title', task_id) if task_info else task_id}' deleted.",
                        "data": {"id": task_id, "deleted": True}
                    }
            return {"agent": self.name, "action": "delete_task",
                    "message": "Task not found.", "data": {}}

        return {"agent": self.name, "action": "unknown",
                "message": "TaskAgent could not handle this intent.", "data": {}}
