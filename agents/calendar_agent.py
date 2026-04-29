"""
Calendar Sub-Agent
Handles: scheduling events, listing upcoming events, checking availability, deleting events.
Exposes MCP-style tool definitions via get_tools().
"""
from database.db import create_event, get_events, delete_event, log_action
from agents.mcp_tools import Tool
from datetime import datetime, timedelta


class CalendarAgent:
    name = "CalendarAgent"

    def get_tools(self) -> list[Tool]:
        """Return MCP-style tool definitions for this agent."""
        return [
            Tool(
                name="schedule_event",
                agent=self.name,
                description="Schedule a new calendar event with title, start time, duration, description, and location.",
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Event title"},
                        "start_time": {"type": "string",
                                       "description": "Start time in YYYY-MM-DD HH:MM format"},
                        "duration_hours": {"type": "number",
                                           "description": "Duration in hours (default: 1)"},
                        "end_time": {"type": "string",
                                     "description": "End time in YYYY-MM-DD HH:MM format (alternative to duration)"},
                        "description": {"type": "string", "description": "Event description"},
                        "location": {"type": "string", "description": "Event location"},
                    },
                    "required": ["title"],
                },
                execute=lambda **kw: self.handle("schedule_event", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="list_events",
                agent=self.name,
                description="List all scheduled calendar events.",
                parameters={"type": "object", "properties": {}},
                execute=lambda **kw: self.handle("list_events", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="check_availability",
                agent=self.name,
                description="Check if a specific date has any scheduled events.",
                parameters={
                    "type": "object",
                    "properties": {
                        "date": {"type": "string",
                                 "description": "Date to check in YYYY-MM-DD format"},
                    },
                    "required": ["date"],
                },
                execute=lambda **kw: self.handle("check_availability", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
            Tool(
                name="delete_event",
                agent=self.name,
                description="Delete a calendar event by event_id.",
                parameters={
                    "type": "object",
                    "properties": {
                        "event_id": {"type": "integer", "description": "Event ID to delete"},
                    },
                    "required": ["event_id"],
                },
                execute=lambda **kw: self.handle("delete_event", kw.get("params", {}),
                                                  kw.get("session_id", ""), kw.get("user_query", "")),
            ),
        ]

    def handle(self, intent: str, params: dict, session_id: str, user_query: str) -> dict:

        if intent == "schedule_event":
            # Smart time defaults if not provided
            start = params.get("start_time") or self._next_available()
            duration_hrs = float(params.get("duration_hours", 1))
            end = params.get("end_time") or self._add_hours(start, duration_hrs)

            result = create_event(
                title=params.get("title", "New Event"),
                start_time=start,
                end_time=end,
                description=params.get("description", ""),
                location=params.get("location", "")
            )
            log_action(session_id, user_query, self.name, "schedule_event", str(result))
            return {
                "agent": self.name,
                "action": "schedule_event",
                "message": f"Event scheduled: '{result['title']}' on {result['start_time']}",
                "data": result
            }

        elif intent == "list_events":
            events = get_events()
            log_action(session_id, user_query, self.name, "list_events", f"{len(events)} events")
            return {
                "agent": self.name,
                "action": "list_events",
                "message": f"Found {len(events)} event(s).",
                "data": events
            }

        elif intent == "check_availability":
            events = get_events()
            date = params.get("date", datetime.now().strftime("%Y-%m-%d"))
            day_events = [e for e in events if date in e.get("start_time", "")]
            if day_events:
                times = [f"{e['start_time']} - {e['end_time']}: {e['title']}" for e in day_events]
                msg = f"Busy on {date}: " + "; ".join(times)
            else:
                msg = f"You are free on {date}."
            log_action(session_id, user_query, self.name, "check_availability", msg)
            return {
                "agent": self.name,
                "action": "check_availability",
                "message": msg,
                "data": day_events
            }

        elif intent == "delete_event":
            event_id = params.get("event_id")
            if event_id:
                deleted = delete_event(int(event_id))
                if deleted:
                    log_action(session_id, user_query, self.name, "delete_event",
                               f"Deleted event {event_id}")
                    return {
                        "agent": self.name,
                        "action": "delete_event",
                        "message": f"Event #{event_id} deleted.",
                        "data": {"id": event_id, "deleted": True}
                    }
            return {"agent": self.name, "action": "delete_event",
                    "message": "Event not found.", "data": {}}

        return {"agent": self.name, "action": "unknown",
                "message": "CalendarAgent could not handle this intent.", "data": {}}

    def _next_available(self) -> str:
        now = datetime.now()
        # Round up to next hour
        next_hour = now.replace(minute=0, second=0) + timedelta(hours=1)
        return next_hour.strftime("%Y-%m-%d %H:%M")

    def _add_hours(self, start: str, hours: float) -> str:
        try:
            dt = datetime.strptime(start, "%Y-%m-%d %H:%M")
            return (dt + timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M")
        except Exception:
            return start
