"""
Structured database layer using SQLite.
Stores tasks, events, notes, and agent memory.
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "agent_data.db"


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            location TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS workflow_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            user_query TEXT,
            agent TEXT,
            action TEXT,
            result TEXT,
            timestamp TEXT DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()


# ── Task CRUD ──────────────────────────────────────────────
def create_task(title: str, description: str = "", priority: str = "medium",
                due_date: str = "") -> dict:
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO tasks (title, description, priority, due_date) VALUES (?,?,?,?)",
        (title, description, priority, due_date)
    )
    conn.commit()
    task_id = c.lastrowid
    conn.close()
    return {"id": task_id, "title": title, "description": description,
            "priority": priority, "due_date": due_date, "status": "pending"}


def get_tasks(status: str = None) -> list:
    conn = get_connection()
    c = conn.cursor()
    if status:
        c.execute("SELECT * FROM tasks WHERE status=? ORDER BY created_at DESC", (status,))
    else:
        c.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_task_by_id(task_id: int) -> dict | None:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM tasks WHERE id=?", (task_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def update_task(task_id: int, **kwargs) -> dict:
    conn = get_connection()
    c = conn.cursor()
    kwargs["updated_at"] = datetime.now().isoformat()
    sets = ", ".join(f"{k}=?" for k in kwargs)
    c.execute(f"UPDATE tasks SET {sets} WHERE id=?", (*kwargs.values(), task_id))
    conn.commit()
    c.execute("SELECT * FROM tasks WHERE id=?", (task_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else {}


def delete_task(task_id: int) -> bool:
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    conn.commit()
    deleted = c.rowcount > 0
    conn.close()
    return deleted


# ── Event CRUD ─────────────────────────────────────────────
def create_event(title: str, start_time: str, end_time: str,
                 description: str = "", location: str = "") -> dict:
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO events (title, description, start_time, end_time, location) VALUES (?,?,?,?,?)",
        (title, description, start_time, end_time, location)
    )
    conn.commit()
    event_id = c.lastrowid
    conn.close()
    return {"id": event_id, "title": title, "start_time": start_time,
            "end_time": end_time, "description": description, "location": location}


def get_events() -> list:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM events ORDER BY start_time")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def delete_event(event_id: int) -> bool:
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM events WHERE id=?", (event_id,))
    conn.commit()
    deleted = c.rowcount > 0
    conn.close()
    return deleted


# ── Notes CRUD ─────────────────────────────────────────────
def create_note(title: str, content: str, tags: list = None) -> dict:
    conn = get_connection()
    c = conn.cursor()
    tags_json = json.dumps(tags or [])
    c.execute("INSERT INTO notes (title, content, tags) VALUES (?,?,?)",
              (title, content, tags_json))
    conn.commit()
    note_id = c.lastrowid
    conn.close()
    return {"id": note_id, "title": title, "content": content, "tags": tags or []}


def get_notes(search: str = None) -> list:
    conn = get_connection()
    c = conn.cursor()
    if search:
        c.execute("SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC",
                  (f"%{search}%", f"%{search}%"))
    else:
        c.execute("SELECT * FROM notes ORDER BY created_at DESC")
    rows = []
    for r in c.fetchall():
        row = dict(r)
        row["tags"] = json.loads(row.get("tags", "[]"))
        rows.append(row)
    conn.close()
    return rows


def update_note(note_id: int, **kwargs) -> dict:
    conn = get_connection()
    c = conn.cursor()
    if "tags" in kwargs and isinstance(kwargs["tags"], list):
        kwargs["tags"] = json.dumps(kwargs["tags"])
    kwargs["updated_at"] = datetime.now().isoformat()
    sets = ", ".join(f"{k}=?" for k in kwargs)
    c.execute(f"UPDATE notes SET {sets} WHERE id=?", (*kwargs.values(), note_id))
    conn.commit()
    c.execute("SELECT * FROM notes WHERE id=?", (note_id,))
    row = c.fetchone()
    conn.close()
    if row:
        result = dict(row)
        result["tags"] = json.loads(result.get("tags", "[]"))
        return result
    return {}


def delete_note(note_id: int) -> bool:
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM notes WHERE id=?", (note_id,))
    conn.commit()
    deleted = c.rowcount > 0
    conn.close()
    return deleted


# ── Workflow log ───────────────────────────────────────────
def log_action(session_id: str, user_query: str, agent: str,
               action: str, result: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO workflow_log (session_id, user_query, agent, action, result) VALUES (?,?,?,?,?)",
        (session_id, user_query, agent, action, result)
    )
    conn.commit()
    conn.close()


def get_workflow_log(limit: int = 50) -> list:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM workflow_log ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows
