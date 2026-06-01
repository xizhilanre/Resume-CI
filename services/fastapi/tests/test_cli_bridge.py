# services/fastapi/tests/test_cli_bridge.py
import pytest
import tempfile
from pathlib import Path
from app.services.cli_bridge import CLIBridge, CLITimeoutError, _signals_to_mermaid, _signals_to_flashcards


@pytest.fixture
def bridge():
    with tempfile.TemporaryDirectory() as tmp:
        ws = Path(tmp) / "workspace"
        ws.mkdir()
        yield CLIBridge(
            workspace=ws,
            tool_dir=Path("dummy/tool"),
            optimizer_dir=Path("dummy/optimizer"),
            vibe_resume_dir=Path("dummy/vibe"),
            chrome_path="/usr/bin/chromium",
        )


@pytest.mark.asyncio
async def test_task_dir_isolation(bridge):
    d1 = bridge._task_dir("task-1")
    d2 = bridge._task_dir("task-2")
    assert d1 != d2
    assert d1.name == "task-1"
    assert d1.exists()


@pytest.mark.asyncio
async def test_cancel_cleans_up(bridge):
    task_dir = bridge._task_dir("task-x")
    (task_dir / "test.txt").write_text("data")
    await bridge.cancel("task-x")
    assert not task_dir.exists()


@pytest.mark.asyncio
async def test_health_check_runs_all_checks(bridge):
    results = await bridge.health_check()
    assert "shushu-repo-audit" in results
    assert "vibe-resume-export" in results


def test_cache_repo_path_parses_url(bridge):
    path = bridge._cache_repo_path("https://github.com/owner/repo")
    assert "owner_repo" in str(path)


def test_timeout_error_message():
    err = CLITimeoutError("repo_audit", 120)
    assert "repo_audit" in str(err)
    assert "120" in str(err)


def test_signals_to_mermaid_empty():
    dsl = _signals_to_mermaid({"signals": {}})
    assert "graph TD" in dsl


def test_signals_to_mermaid_with_api():
    dsl = _signals_to_mermaid({"signals": {"api_backend": ["routes/api.py"], "database_state": ["models/db.py"]}})
    assert "API Backend" in dsl
    assert "Database" in dsl


def test_signals_to_flashcards_max_5():
    audit = {
        "name": "test-proj",
        "signals": {"api_backend": [], "database_state": [], "async_jobs": [],
                     "devops_deploy": [], "security_auth": [], "testing_quality": []},
        "summary": {"file_count_scanned": 42},
    }
    cards = _signals_to_flashcards(audit)
    assert len(cards) <= 5
    assert all("id" in c and "question" in c for c in cards)


def test_fallback_candidates():
    from app.services.github_search import _fallback_candidates
    candidates = _fallback_candidates(["go"])
    assert len(candidates) == 3
    assert all("name" in c and "repo_url" in c for c in candidates)
