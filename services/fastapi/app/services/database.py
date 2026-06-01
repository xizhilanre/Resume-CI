# services/fastapi/app/services/database.py
import aiosqlite
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resume_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT,
    jd_raw TEXT,
    jd_parsed TEXT,
    project_id TEXT,
    resume_html TEXT,
    page_fit_status TEXT,
    wizard_step TEXT NOT NULL DEFAULT 'anchor',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_audits (
    id TEXT PRIMARY KEY,
    repo_url TEXT NOT NULL,
    audit_json TEXT NOT NULL,
    candidate_score_json TEXT,
    architecture_dsl TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alignment_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES resume_sessions(id),
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    star_bullet_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES resume_sessions(id),
    section TEXT NOT NULL,
    old_content TEXT,
    new_content TEXT NOT NULL,
    edited_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON resume_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_alignment_session ON alignment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_session ON edit_history(session_id);
"""


class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path

    async def init(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.executescript(SCHEMA)
            await db.commit()
        logger.info(f"Database initialized at {self.db_path}")

    # ─── Sessions ───

    async def save_session(self, session: dict) -> str:
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                """INSERT OR REPLACE INTO resume_sessions
                   (id, user_id, name, jd_raw, jd_parsed, project_id, resume_html, page_fit_status, wizard_step, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (session["id"], session["user_id"], session.get("name"),
                 session.get("jd_raw"), json.dumps(session.get("jd_parsed")),
                 session.get("project_id"), session.get("resume_html"),
                 json.dumps(session.get("page_fit_status")),
                 session.get("wizard_step", "anchor")),
            )
            await db.commit()
        return session["id"]

    async def load_session(self, session_id: str) -> Optional[dict]:
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM resume_sessions WHERE id = ?", (session_id,))
            row = await cursor.fetchone()
            return self._row_to_dict(row) if row else None

    async def list_sessions(self, user_id: str) -> list[dict]:
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT id, name, wizard_step, updated_at FROM resume_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20",
                (user_id,),
            )
            return [dict(r) for r in await cursor.fetchall()]

    # ─── Audits ───

    async def save_audit(self, repo_name: str, audit_json: dict, candidate_score: dict = None, architecture_dsl: str = None):
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                """INSERT OR REPLACE INTO project_audits (id, repo_url, audit_json, candidate_score_json, architecture_dsl)
                   VALUES (?, ?, ?, ?, ?)""",
                (repo_name, audit_json.get("repo_url", ""), json.dumps(audit_json),
                 json.dumps(candidate_score) if candidate_score else None, architecture_dsl),
            )
            await db.commit()

    async def load_audit(self, repo_name: str) -> Optional[dict]:
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM project_audits WHERE id = ?", (repo_name,))
            row = await cursor.fetchone()
            return self._row_to_dict(row) if row else None

    # ─── Alignment ───

    async def save_alignment_answer(self, session_id: str, question_id: str, question_text: str, answer_text: str, star_json: dict = None) -> str:
        import uuid
        aid = str(uuid.uuid4())
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                """INSERT INTO alignment_sessions (id, session_id, question_id, question_text, answer_text, star_bullet_json)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (aid, session_id, question_id, question_text, answer_text, json.dumps(star_json) if star_json else None),
            )
            await db.commit()
        return aid

    async def load_alignment_answers(self, session_id: str) -> list[dict]:
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM alignment_sessions WHERE session_id = ? ORDER BY created_at", (session_id,),
            )
            return [dict(r) for r in await cursor.fetchall()]

    # ─── Edit History ───

    async def push_edit(self, session_id: str, section: str, old_content: str, new_content: str):
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                "INSERT INTO edit_history (session_id, section, old_content, new_content) VALUES (?, ?, ?, ?)",
                (session_id, section, old_content, new_content),
            )
            await db.commit()

    async def get_edits(self, session_id: str, limit: int = 20) -> list[dict]:
        async with aiosqlite.connect(str(self.db_path)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM edit_history WHERE session_id = ? ORDER BY edited_at DESC LIMIT ?",
                (session_id, limit),
            )
            return [dict(r) for r in await cursor.fetchall()]

    # ─── User ───

    async def upsert_user(self, user_id: str, login: str, email: str = None, avatar_url: str = None):
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute(
                "INSERT OR REPLACE INTO users (id, login, email, avatar_url) VALUES (?, ?, ?, ?)",
                (user_id, login, email, avatar_url),
            )
            await db.commit()

    # ─── Helpers ───

    def _row_to_dict(self, row) -> dict:
        d = dict(row)
        for key in ("jd_parsed", "page_fit_status", "audit_json", "candidate_score_json", "star_bullet_json"):
            if d.get(key) and isinstance(d[key], str):
                try:
                    d[key] = json.loads(d[key])
                except json.JSONDecodeError:
                    pass
        return d
