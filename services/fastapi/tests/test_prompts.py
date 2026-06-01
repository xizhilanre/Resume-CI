# services/fastapi/tests/test_prompts.py
from app.services.prompts import (
    jd_parse_prompt, mermaid_prompt, polish_prompt,
    alignment_questions_prompt, interview_tip_prompt,
)


def test_jd_parse_prompt_returns_system_and_user():
    sys_msg, user_msg = jd_parse_prompt("招Go后端")
    assert "JD" in sys_msg
    assert "Go后端" in user_msg


def test_mermaid_prompt_includes_signals():
    prompt = mermaid_prompt({"api_backend": ["a.py"], "database_state": []}, "tree")
    assert "api_backend" in prompt
    assert "graph TD" in prompt


def test_polish_prompt_changes_by_style():
    _, expand = polish_prompt("test", "expand")
    _, shorten = polish_prompt("test", "shorten")
    assert "扩写" in expand
    assert "精简" in shorten


def test_alignment_questions_prompt_contains_project():
    prompt = alignment_questions_prompt("my-project", {"api_backend": ["x.py"]}, ["Go"])
    assert "my-project" in prompt
    assert "api_backend" in prompt


def test_interview_tip_prompt_uses_all_params():
    prompt = interview_tip_prompt("后端", ["Go"], "proj", 0.85, ["分布式"])
    assert "后端" in prompt
    assert "85%" in prompt
    assert "分布式" in prompt
