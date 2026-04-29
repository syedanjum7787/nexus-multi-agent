# NEXUS — Multi-Agent Productivity System
### Hack2Skill Gen AI APAC Edition Submission

A production-ready multi-agent AI system that manages tasks, schedules, and notes using coordinated sub-agents, a structured database, MCP tool integration, and a REST API — powered by Google Gemini AI.

---

## Architecture

```
User → FastAPI (/query)
         │
    Orchestrator Agent (Google Gemini 2.0 Flash)
    ├── Plans multi-step workflows via AI
    ├── Routes to sub-agents via MCP Tool Registry
    │
    ├── MCP Tool Registry
    │   ├── create_task, list_tasks, complete_task, update_task, delete_task
    │   ├── schedule_event, list_events, check_availability, delete_event
    │   └── save_note, search_notes, list_notes, update_note, delete_note
    │
    ├── TaskAgent      → SQLite (tasks table)
    ├── CalendarAgent  → SQLite (events table)
    └── NotesAgent     → SQLite (notes table)
                             │
                       workflow_log table
```

## Core Requirements Met

| Requirement | Implementation |
|---|---|
| Primary + sub-agents | OrchestratorAgent → TaskAgent, CalendarAgent, NotesAgent |
| Structured database | SQLite with 4 tables (tasks, events, notes, workflow_log) |
| MCP tool integration | Tool Registry with 14 tools, structured JSON Schema, dynamic discovery |
| Multi-step workflows | Orchestrator plans N-step sequences with dependency resolution |
| API-based deployment | FastAPI with full CRUD endpoints + MCP tool discovery, deployable to Cloud Run |

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your Google Gemini API key
```bash
export GEMINI_API_KEY=your_key_here
```

### 3. Start the API server
```bash
python3 main.py
```

### 4. Open the dashboard
Navigate to [http://localhost:8000](http://localhost:8000)

### 5. Test with curl
```bash
# Multi-agent workflow
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create a high priority task to review the Q3 report by Friday, schedule a 2-hour block on my calendar, and save a note with the agenda"}'

# Discover all MCP tools
curl http://localhost:8000/mcp/tools
```

---

## MCP Tool Integration

NEXUS implements the **Model Context Protocol (MCP)** pattern for tool management:

- Each sub-agent registers its capabilities as **structured tools** with JSON Schema parameters
- The orchestrator **dynamically discovers** available tools at startup
- Tool schemas are injected into the AI system prompt for accurate planning
- Execution goes through the **ToolRegistry** for a unified dispatch mechanism
- The `/mcp/tools` endpoint exposes all registered tools via API

### Registered Tools (14 total)

| Agent | Tool | Description |
|---|---|---|
| TaskAgent | `create_task` | Create a new task with priority and due date |
| TaskAgent | `list_tasks` | List tasks, optionally filtered by status |
| TaskAgent | `complete_task` | Mark a task completed by ID or title |
| TaskAgent | `update_task` | Update task fields |
| TaskAgent | `delete_task` | Delete a task permanently |
| CalendarAgent | `schedule_event` | Schedule an event with smart time defaults |
| CalendarAgent | `list_events` | List all calendar events |
| CalendarAgent | `check_availability` | Check availability on a date |
| CalendarAgent | `delete_event` | Delete a calendar event |
| NotesAgent | `save_note` | Save a note with tags |
| NotesAgent | `search_notes` | Search notes by keyword |
| NotesAgent | `list_notes` | List all notes |
| NotesAgent | `update_note` | Update a note's content |
| NotesAgent | `delete_note` | Delete a note |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/query` | Main orchestrator — natural language input |
| GET | `/tasks` | List all tasks (optional `?status=pending`) |
| POST | `/tasks` | Create a new task |
| PATCH | `/tasks/{id}` | Update task fields |
| DELETE | `/tasks/{id}` | Delete a task |
| GET | `/events` | List all calendar events |
| POST | `/events` | Schedule a new event |
| DELETE | `/events/{id}` | Delete an event |
| GET | `/notes` | List/search notes (optional `?search=keyword`) |
| POST | `/notes` | Create a new note |
| PATCH | `/notes/{id}` | Update a note |
| DELETE | `/notes/{id}` | Delete a note |
| GET | `/logs` | Workflow execution log |
| GET | `/mcp/tools` | List all registered MCP tools |
| GET | `/health` | Health check with tool count |

---

## Example Workflows

**Single-agent:**
> "Create a task to review slides by Monday with high priority"

**Multi-agent (2 steps):**
> "Schedule a team meeting tomorrow at 2pm for 1 hour and save a note with the discussion points"

**Full 3-agent workflow:**
> "Add a task to review Q3 report, block 2 hours on Friday, and save a note with the report agenda"

---

## Deploy to Google Cloud Run

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/nexus-agents

# Deploy
gcloud run deploy nexus-agents \
  --image gcr.io/PROJECT_ID/nexus-agents \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key
```

---

## Project Structure

```
nexus-multi-agent/
├── main.py                  # FastAPI app — serves API + dashboard
├── requirements.txt         # Python dependencies (Gemini, FastAPI, etc.)
├── dashboard.html           # Frontend UI — WALL-E themed dashboard
├── styles.css               # Full CSS design system (dark/light themes)
├── walle.js                 # WALL-E agent animations + particles + theme
├── agents/
│   ├── orchestrator.py      # Primary agent (Gemini-powered planner)
│   ├── mcp_tools.py         # MCP Tool Registry (tool schemas + dispatch)
│   ├── task_agent.py        # Task sub-agent (5 tools)
│   ├── calendar_agent.py    # Calendar sub-agent (4 tools)
│   └── notes_agent.py       # Notes sub-agent (5 tools)
└── database/
    └── db.py                # SQLite CRUD + schema (full delete support)
```
