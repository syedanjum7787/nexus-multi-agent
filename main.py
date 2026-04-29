"""
Multi-Agent System — FastAPI Backend (powered by Google Gemini AI)
Endpoints: /query, /tasks, /events, /notes, /logs, /health, /mcp/tools
Also serves the dashboard UI at /
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

from agents.orchestrator import OrchestratorAgent
from database.db import (init_db, get_tasks, get_events, get_notes,
                         get_workflow_log, create_task, create_event,
                         create_note, update_task, update_note,
                         delete_task, delete_event, delete_note)

app = FastAPI(
    title="NEXUS Multi-Agent Productivity System",
    description="A multi-agent AI system powered by Google Gemini for task, calendar, and notes management via MCP tools.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.dirname(__file__)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

init_db()
orchestrator = OrchestratorAgent()


# ── Request Models ──
class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    due_date: Optional[str] = ""

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None

class EventCreate(BaseModel):
    title: str
    start_time: str
    end_time: str
    description: Optional[str] = ""
    location: Optional[str] = ""

class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


# ── UI Routes ──
@app.get("/")
def serve_dashboard():
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))

@app.get("/dashboard.html")
def serve_dashboard_explicit():
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))

@app.get("/styles.css")
def serve_css():
    return FileResponse(os.path.join(STATIC_DIR, "styles.css"), media_type="text/css")

@app.get("/walle.js")
def serve_walle_js():
    return FileResponse(os.path.join(STATIC_DIR, "walle.js"), media_type="application/javascript")

@app.get("/neko.js")
def serve_neko_js():
    return FileResponse(os.path.join(STATIC_DIR, "neko.js"), media_type="application/javascript")

@app.get("/cat-engine.js")
def serve_cat_engine_js():
    return FileResponse(os.path.join(STATIC_DIR, "cat-engine.js"), media_type="application/javascript")

@app.get("/{filename}.png")
def serve_png(filename: str):
    filepath = os.path.join(STATIC_DIR, f"{filename}.png")
    if os.path.isfile(filepath):
        return FileResponse(filepath, media_type="image/png")
    raise HTTPException(404, "File not found")

@app.get("/assets/sounds/{filename}")
def serve_sound(filename: str):
    filepath = os.path.join(STATIC_DIR, "assets", "sounds", filename)
    if os.path.isfile(filepath):
        return FileResponse(filepath)
    raise HTTPException(404, "File not found")


# ── API Routes ──
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "NEXUS Multi-Agent System",
        "ai_provider": "Google Gemini 2.0 Flash",
        "ai_ready": orchestrator._has_ai,
        "mcp_tools": orchestrator.registry.tool_count,
        "agents": orchestrator.registry.agent_names,
    }

@app.post("/query")
def query(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty.")
    result = orchestrator.run(req.query, req.session_id)
    if "error" in result:
        raise HTTPException(500, result["error"])
    return result

# ── MCP Tools Discovery ──
@app.get("/mcp/tools")
def list_mcp_tools():
    """List all registered MCP tools with their schemas."""
    return {"tools": orchestrator.registry.list_tools()}


# ── Tasks CRUD ──
@app.get("/tasks")
def list_tasks(status: Optional[str] = None):
    return {"tasks": get_tasks(status)}

@app.post("/tasks")
def add_task(task: TaskCreate):
    result = create_task(task.title, task.description, task.priority, task.due_date)
    return {"task": result, "message": f"Task '{task.title}' created successfully."}

@app.patch("/tasks/{task_id}")
def patch_task(task_id: int, body: TaskUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update.")
    result = update_task(task_id, **updates)
    return {"task": result, "message": "Task updated."}

@app.delete("/tasks/{task_id}")
def remove_task(task_id: int):
    deleted = delete_task(task_id)
    if not deleted:
        raise HTTPException(404, "Task not found.")
    return {"message": f"Task #{task_id} deleted.", "id": task_id}


# ── Events CRUD ──
@app.get("/events")
def list_events():
    return {"events": get_events()}

@app.post("/events")
def add_event(event: EventCreate):
    result = create_event(event.title, event.start_time, event.end_time,
                          event.description, event.location)
    return {"event": result, "message": f"Event '{event.title}' scheduled."}

@app.delete("/events/{event_id}")
def remove_event(event_id: int):
    deleted = delete_event(event_id)
    if not deleted:
        raise HTTPException(404, "Event not found.")
    return {"message": f"Event #{event_id} deleted.", "id": event_id}


# ── Notes CRUD ──
@app.get("/notes")
def list_notes(search: Optional[str] = None):
    return {"notes": get_notes(search)}

@app.post("/notes")
def add_note(note: NoteCreate):
    result = create_note(note.title, note.content, note.tags)
    return {"note": result, "message": f"Note '{note.title}' saved."}

@app.patch("/notes/{note_id}")
def patch_note(note_id: int, body: NoteUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update.")
    result = update_note(note_id, **updates)
    return {"note": result, "message": "Note updated."}

@app.delete("/notes/{note_id}")
def remove_note(note_id: int):
    deleted = delete_note(note_id)
    if not deleted:
        raise HTTPException(404, "Note not found.")
    return {"message": f"Note #{note_id} deleted.", "id": note_id}


# ── Logs ──
@app.get("/logs")
def workflow_logs(limit: int = 50):
    return {"logs": get_workflow_log(limit)}


if __name__ == "__main__":
    print("\n  🤖 NEXUS Multi-Agent System v3.0")
    print("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  🌐 Dashboard:  http://localhost:8000")
    print("  📡 API docs:   http://localhost:8000/docs")
    print(f"  🔧 MCP Tools:  {orchestrator.registry.tool_count} tools registered")
    if orchestrator._has_ai:
        print("  🔑 AI Engine:  Google Gemini 2.0 Flash ✓")
    else:
        print("  ⚠️  AI Engine:  NOT CONFIGURED")
        print("     → Set: export GEMINI_API_KEY=your_key")
        print("     → Get a free key: https://aistudio.google.com/apikey")
        print("     → Tasks, Calendar, Notes & MCP Tools still work without AI")
    print()
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), reload=True)
