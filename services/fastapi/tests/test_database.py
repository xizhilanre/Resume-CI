# services/fastapi/tests/test_database.py
import pytest
import pytest_asyncio
import tempfile
from pathlib import Path
from app.services.database import Database


@pytest_asyncio.fixture
async def db():
    with tempfile.TemporaryDirectory() as tmp:
        database = Database(Path(tmp) / "test.db")
        await database.init()
        yield database


@pytest.mark.asyncio
async def test_save_and_load_session(db):
    sid = await db.save_session({"id": "s1", "user_id": "u1", "wizard_step": "anchor"})
    session = await db.load_session("s1")
    assert session["wizard_step"] == "anchor"
    assert session["user_id"] == "u1"


@pytest.mark.asyncio
async def test_save_and_load_audit(db):
    await db.save_audit("test/repo", {"repo_url": "https://github.com/test/repo", "signals": {"api_backend": []}})
    audit = await db.load_audit("test/repo")
    assert audit["audit_json"] is not None


@pytest.mark.asyncio
async def test_list_sessions_orders_by_updated_at(db):
    await db.save_session({"id": "s1", "user_id": "u1"})
    await db.save_session({"id": "s2", "user_id": "u1"})
    sessions = await db.list_sessions("u1")
    assert len(sessions) == 2


@pytest.mark.asyncio
async def test_alignment_crud(db):
    await db.save_session({"id": "s1", "user_id": "u1"})
    await db.save_alignment_answer("s1", "q1", "如何处理高并发？", "用消息队列", {"situation": "..."})
    answers = await db.load_alignment_answers("s1")
    assert len(answers) == 1
    assert answers[0]["question_text"] == "如何处理高并发？"


@pytest.mark.asyncio
async def test_edit_history(db):
    await db.save_session({"id": "s1", "user_id": "u1"})
    await db.push_edit("s1", "experience", "old text", "new text")
    edits = await db.get_edits("s1")
    assert len(edits) == 1
    assert edits[0]["new_content"] == "new text"
