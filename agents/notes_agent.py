"""
Notes Sub-Agent
Handles: saving notes, searching notes, listing notes, updating notes, deleting notes.
Exposes MCP-style tool definitions via get_tools().
"""
from database.db import create_note, get_notes, update_note, delete_note, log_action
from agents.mcp_tools import Tool


class NotesAgent:
    name = "NotesAgent"

    def get_tools(self) -> list[Tool]:
        """Return MCP-style tool definitions for this agent."""
        return [
            Tool(
                name="save_note",
                agent=self.name,
                description="Save a new note with title, content, and optional tags.",
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Note title"},
                        "content": {"type": "string", "description": "Note content body"},
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of tags for categorization",
                        },
                    },
                    "required": ["title", "content"],
                },
                execute=lambda **kw: self.handle("save_note", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="search_notes",
                agent=self.name,
                description="Search notes by keyword matching in title or content.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search keyword"},
                    },
                    "required": ["query"],
                },
                execute=lambda **kw: self.handle("search_notes", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="list_notes",
                agent=self.name,
                description="List all saved notes.",
                parameters={"type": "object", "properties": {}},
                execute=lambda **kw: self.handle("list_notes", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="update_note",
                agent=self.name,
                description="Update a note's title, content, or tags by note_id.",
                parameters={
                    "type": "object",
                    "properties": {
                        "note_id": {"type": "integer", "description": "Note ID to update"},
                        "title": {"type": "string", "description": "New title"},
                        "content": {"type": "string", "description": "New content"},
                        "tags": {"type": "array", "items": {"type": "string"},
                                 "description": "New tags"},
                    },
                    "required": ["note_id"],
                },
                execute=lambda **kw: self.handle("update_note", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="delete_note",
                agent=self.name,
                description="Delete a note permanently by note_id.",
                parameters={
                    "type": "object",
                    "properties": {
                        "note_id": {"type": "integer", "description": "Note ID to delete"},
                    },
                    "required": ["note_id"],
                },
                execute=lambda **kw: self.handle("delete_note", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
        ]

    def handle(self, intent: str, params: dict, session_id: str, user_query: str) -> dict:

        if intent == "save_note":
            result = create_note(
                title=params.get("title", "Note"),
                content=params.get("content", ""),
                tags=params.get("tags", [])
            )
            log_action(session_id, user_query, self.name, "save_note", str(result))
            return {
                "agent": self.name,
                "action": "save_note",
                "message": f"Note saved: '{result['title']}'",
                "data": result
            }

        elif intent == "search_notes":
            query = params.get("query", "")
            results = get_notes(search=query)
            log_action(session_id, user_query, self.name, "search_notes",
                       f"{len(results)} results for '{query}'")
            return {
                "agent": self.name,
                "action": "search_notes",
                "message": f"Found {len(results)} note(s) matching '{query}'.",
                "data": results
            }

        elif intent == "list_notes":
            notes = get_notes()
            log_action(session_id, user_query, self.name, "list_notes", f"{len(notes)} notes")
            return {
                "agent": self.name,
                "action": "list_notes",
                "message": f"You have {len(notes)} note(s).",
                "data": notes
            }

        elif intent == "update_note":
            note_id = params.get("note_id")
            if note_id:
                updates = {k: v for k, v in params.items() if k != "note_id"}
                if updates:
                    result = update_note(int(note_id), **updates)
                    log_action(session_id, user_query, self.name, "update_note", str(result))
                    return {
                        "agent": self.name,
                        "action": "update_note",
                        "message": f"Note #{note_id} updated.",
                        "data": result
                    }
            return {"agent": self.name, "action": "update_note",
                    "message": "Note ID and fields required.", "data": {}}

        elif intent == "delete_note":
            note_id = params.get("note_id")
            if note_id:
                deleted = delete_note(int(note_id))
                if deleted:
                    log_action(session_id, user_query, self.name, "delete_note",
                               f"Deleted note {note_id}")
                    return {
                        "agent": self.name,
                        "action": "delete_note",
                        "message": f"Note #{note_id} deleted.",
                        "data": {"id": note_id, "deleted": True}
                    }
            return {"agent": self.name, "action": "delete_note",
                    "message": "Note not found.", "data": {}}

        return {"agent": self.name, "action": "unknown",
                "message": "NotesAgent could not handle this intent.", "data": {}}
