# services/fastapi/app/services/cli_bridge.py
import asyncio
import json
import logging
import os
import shutil
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class CLITimeoutError(Exception):
    def __init__(self, command: str, timeout: float):
        super().__init__(f"Command '{command}' timed out after {timeout}s")
        self.command = command
        self.timeout = timeout


class CLINotFoundError(Exception):
    def __init__(self, name: str):
        super().__init__(f"CLI '{name}' is not installed. Run: pip install {name}")
        self.name = name


class CLINotInstalledError(CLINotFoundError):
    pass


class CLIPartialResult(Exception):
    def __init__(self, message: str, partial: dict | None = None):
        super().__init__(message)
        self.partial = partial


@dataclass
class CLIBridge:
    """统一 CLI 调用层"""

    workspace: Path
    tool_dir: Path          # shushu-internship-tool
    optimizer_dir: Path     # shushu-internship-resume-optimizer
    vibe_resume_dir: Path   # vibe-resume
    chrome_path: str        # Chromium executable

    _active_procs: dict[str, asyncio.subprocess.Process] = field(default_factory=dict)
    _active_tasks: set[str] = field(default_factory=set)

    # ─── Health check ───

    async def health_check(self) -> dict[str, bool]:
        results = {}
        for name, module in [
            ("shushu-repo-audit", "repo_audit"),
            ("shushu-candidate-score", "candidate_score"),
            ("shushu-interview-pack", "interview_pack"),
            ("shushu-achievement-audit", "achievement_audit"),
            ("shushu-resume-rank", "resume_rank"),
        ]:
            try:
                code, _, _ = await self._run_python_cli(module, ["--help"], timeout=10)
                results[name] = code == 0
            except Exception:
                results[name] = False

        try:
            code, _, _ = await self._run_node_script(
                "scripts/export-pdf.mjs", ["--help"],
                env={"CHROME_PATH": self.chrome_path},
                timeout=10,
            )
            results["vibe-resume-export"] = code == 0
        except Exception:
            results["vibe-resume-export"] = False

        return results

    # ─── Subprocess ───

    async def _run_python_cli(
        self, module: str, args: list[str],
        cwd: Path | None = None,
        timeout: float = 120,
        task_id: str | None = None,
    ) -> tuple[int, str, str]:
        cmd = ["python", "-m", f"shushu_internship_tool.{module}", *args]
        logger.info(f"[{task_id}] Running: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd, cwd=cwd or self.workspace,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )

        if task_id:
            self._active_procs[task_id] = proc

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return proc.returncode or 0, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            proc.kill()
            raise CLITimeoutError(module, timeout)
        finally:
            self._active_procs.pop(task_id, None)

    async def _run_node_script(
        self, script: str, args: list[str],
        cwd: Path | None = None, env: dict[str, str] | None = None,
        timeout: float = 60, task_id: str | None = None,
    ) -> tuple[int, str, str]:
        full_env = os.environ.copy()
        if env: full_env.update(env)

        script_path = self.vibe_resume_dir / script
        cmd = ["node", str(script_path), *args]
        logger.info(f"[{task_id}] Running: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd, cwd=cwd or self.vibe_resume_dir,
            env=full_env,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )

        if task_id:
            self._active_procs[task_id] = proc

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return proc.returncode or 0, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            proc.kill()
            raise CLITimeoutError(script, timeout)
        finally:
            self._active_procs.pop(task_id, None)

    async def _run_with_partial(self, *args, **kwargs) -> tuple[bool, any, str | None]:
        try:
            return True, await self._run_python_cli(*args, **kwargs), None
        except CLITimeoutError as e:
            return False, None, f"Timeout: {e}"
        except Exception as e:
            return False, None, str(e)

    # ─── Workspace ───

    def _task_dir(self, task_id: str) -> Path:
        d = self.workspace / task_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    async def cancel(self, task_id: str):
        self._active_tasks.discard(task_id)
        proc = self._active_procs.pop(task_id, None)
        if proc:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                proc.kill()
            except Exception:
                pass

        task_dir = self.workspace / task_id
        if task_dir.exists():
            shutil.rmtree(task_dir, ignore_errors=True)

    # ─── Git cache ───

    def _cache_repo_path(self, repo_url: str) -> Path:
        parts = repo_url.rstrip("/").split("/")
        key = f"{parts[-2]}_{parts[-1]}" if len(parts) >= 2 else parts[-1]
        cache = self.workspace / "_cache" / "repos" / key
        cache.mkdir(parents=True, exist_ok=True)
        return cache

    async def _clone_or_pull(self, repo_url: str) -> Path:
        import git
        cache_path = self._cache_repo_path(repo_url)

        if (cache_path / ".git").exists():
            try:
                repo = git.Repo(cache_path)
                repo.remotes.origin.pull(depth=1)
            except Exception:
                shutil.rmtree(cache_path, ignore_errors=True)
                cache_path.mkdir(parents=True, exist_ok=True)
                git.Repo.clone_from(repo_url, cache_path, depth=1)
        else:
            git.Repo.clone_from(repo_url, cache_path, depth=1)

        return cache_path

    # ─── Business methods ───

    async def candidate_score(
        self, jd_file: Path, candidates_file: Path, out_dir: Path, task_id: str
    ) -> list[dict]:
        code, stdout, stderr = await self._run_python_cli(
            "candidate_score",
            ["--jd", str(jd_file), "--candidates", str(candidates_file), "--out", str(out_dir)],
            cwd=self.tool_dir, timeout=120, task_id=task_id,
        )
        if code != 0:
            raise RuntimeError(f"candidate_score failed: {stderr}")
        result_file = out_dir / "candidate_score.json"
        data = json.loads(result_file.read_text(encoding="utf-8"))
        return data.get("candidates", [])

    async def repo_audit(
        self, repo_path: Path, name: str, out_dir: Path, task_id: str
    ) -> dict:
        code, stdout, stderr = await self._run_python_cli(
            "repo_audit",
            ["--repo", str(repo_path), "--out", str(out_dir), "--name", name],
            cwd=self.tool_dir, timeout=180, task_id=task_id,
        )
        if code != 0:
            raise RuntimeError(f"repo_audit failed: {stderr}")
        result_file = out_dir / "audit.json"
        return json.loads(result_file.read_text(encoding="utf-8"))

    async def achievement_audit(
        self, sources_file: Path, out_dir: Path, task_id: str
    ) -> dict:
        code, stdout, stderr = await self._run_python_cli(
            "achievement_audit",
            ["--sources", str(sources_file), "--out", str(out_dir)],
            cwd=self.optimizer_dir, timeout=120, task_id=task_id,
        )
        if code != 0:
            raise RuntimeError(f"achievement_audit failed: {stderr}")
        result_file = out_dir / "achievement_audit.json"
        return json.loads(result_file.read_text(encoding="utf-8"))

    async def resume_rank(
        self, jd_file: Path, achievements_file: Path,
        target_role: str, out_dir: Path, task_id: str,
    ) -> dict:
        code, stdout, stderr = await self._run_python_cli(
            "resume_rank",
            ["--jd", str(jd_file), "--achievements", str(achievements_file),
             "--target-role", target_role, "--out", str(out_dir)],
            cwd=self.optimizer_dir, timeout=120, task_id=task_id,
        )
        if code != 0:
            raise RuntimeError(f"resume_rank failed: {stderr}")
        result_file = out_dir / "resume_rank.json"
        return json.loads(result_file.read_text(encoding="utf-8"))

    async def discover_and_audit(
        self, jd_keywords: list[str], jd_techstack: list[str], task_id: str
    ) -> AsyncIterator[dict]:
        from .github_search import github_search_repos

        task_dir = self._task_dir(task_id)

        candidates = await github_search_repos(jd_keywords, jd_techstack)

        candidates_file = task_dir / "candidates.json"
        candidates_file.write_text(json.dumps(candidates, ensure_ascii=False), encoding="utf-8")

        jd_file = task_dir / "jd.txt"
        jd_file.write_text(" ".join(jd_keywords + jd_techstack), encoding="utf-8")

        score_dir = task_dir / "candidate_score"
        score_dir.mkdir(exist_ok=True)
        scored = await self.candidate_score(jd_file, candidates_file, score_dir, task_id)

        for i, candidate in enumerate(scored[:3]):
            try:
                repo_path = await self._clone_or_pull(candidate["repo_url"])
                audit_dir = task_dir / f"audit_{i}"
                audit_dir.mkdir(exist_ok=True)
                audit = await self.repo_audit(repo_path, candidate["name"], audit_dir, task_id)
            except Exception as e:
                logger.warning(f"Audit skipped for {candidate['name']}: {e}")
                audit = None

            yield {
                "id": candidate["name"].replace("/", "-"),
                "title": candidate["name"],
                "description": _extract_description(audit),
                "techStack": candidate.get("tags", []),
                "jdMatchScore": candidate.get("score", 70) / 100,
                "architecture": _signals_to_mermaid(audit) if audit else "",
                "challenges": _signals_to_flashcards(audit) if audit else [],
            }

    def _answers_to_sources(self, answers: list[dict], audit: dict, task_dir: Path) -> Path:
        summary_lines = []
        for a in answers:
            summary_lines.append(f"问题：{a['question']}")
            summary_lines.append(f"回答：{a['answer']}")
            summary_lines.append("")

        summary_file = task_dir / "alignment_answers.md"
        summary_file.write_text("\n".join(summary_lines), encoding="utf-8")

        sources = {
            "name": audit.get("name", "project"),
            "sources": [
                {"source_type": "project_summary", "path_or_text": str(summary_file), "title": "用户对齐问答"},
                {"source_type": "project_summary", "path_or_text": json.dumps(audit.get("readme_samples", {}), ensure_ascii=False), "title": "项目 README 摘要"},
            ],
        }

        sources_file = task_dir / "sources.json"
        sources_file.write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
        return sources_file

    def _achievements_to_star_bullets(self, achievement_audit: dict) -> list[dict]:
        bullets = []
        for ach in achievement_audit.get("achievements", []):
            bullet = {
                "id": ach.get("title", "").replace(" ", "-").lower(),
                "situation": ach.get("background", ""),
                "task": ach.get("task", ""),
                "action": "; ".join(ach.get("core_actions", ach.get("actions", []))),
                "result": ach.get("best_metric", "") or ach.get("core_result", "") or ach.get("outcome", ""),
            }
            if not bullet["situation"]:
                bullet["situation"] = ach.get("one_line_scope", "")
            if not bullet["result"]:
                bullet["result"] = ach.get("business_value", "")
            bullets.append(bullet)
        return bullets

    async def write_resume_html(self, html: str) -> str:
        index_path = self.vibe_resume_dir / "index.html"
        backup = index_path.read_text(encoding="utf-8") if index_path.exists() else ""
        index_path.write_text(html, encoding="utf-8")
        return backup

    async def restore_resume_html(self, backup: str):
        if backup:
            (self.vibe_resume_dir / "index.html").write_text(backup, encoding="utf-8")


# ─── Signal utilities ───

def _extract_description(audit: dict | None) -> str:
    if not audit: return "项目描述待分析"
    readme = audit.get("readme_samples", {})
    if readme:
        first = next(iter(readme.values()), "")
        return first[:200]
    return f"{audit.get('name', '项目')} — {audit.get('summary', {}).get('file_count_scanned', 0)} 文件"


def _signals_to_mermaid(audit: dict) -> str:
    signals = audit.get("signals", {})
    lines = ["graph TD"]
    nodes: list[str] = []

    if signals.get("api_backend"):
        nodes.append("    A[API Backend]")
    if signals.get("database_state"):
        nodes.append("    B[(Database)]")
    if signals.get("frontend_mobile"):
        nodes.append("    C[Frontend]")
    if signals.get("async_jobs"):
        nodes.append("    D[Async Jobs]")
    if signals.get("devops_deploy"):
        nodes.append("    E[Docker/K8s]")
    if signals.get("model") or signals.get("training"):
        nodes.append("    F[ML Pipeline]")

    if not nodes:
        return "graph TD\n    A[Project] --> B[Unknown Structure]"

    edges = []
    if nodes:
        if "C" in str(nodes) and "A" in str(nodes): edges.append("    C --> A")
        if "A" in str(nodes) and "B" in str(nodes): edges.append("    A --> B")

    return "\n".join(lines[:1] + nodes + edges)


def _signals_to_flashcards(audit: dict) -> list[dict]:
    cards = []
    signals = audit.get("signals", {})

    templates = {
        "api_backend": ("API 设计", "该项目包含 API 后端，涉及路由、中间件、请求处理等后端核心模块"),
        "database_state": ("数据持久化", "项目使用数据库进行状态管理，需要关注 schema 设计、迁移策略和查询优化"),
        "async_jobs": ("异步任务处理", "项目涉及异步任务/消息队列，需要理解生产者-消费者模式"),
        "devops_deploy": ("部署与运维", "项目包含 DevOps 配置（Docker/K8s/CI），涉及容器化和持续集成"),
        "security_auth": ("安全与认证", "项目实现了安全认证机制（JWT/OAuth/session），涉及安全最佳实践"),
        "testing_quality": ("测试策略", "项目包含自动化测试，涉及单元测试/集成测试的编写与维护"),
    }

    idx = 0
    for signal_key, (question, answer) in templates.items():
        if signals.get(signal_key):
            cards.append({
                "id": f"{audit.get('name', 'proj')}-fc-{idx}",
                "question": f"如何处理{question}相关的问题？",
                "answer": answer,
            })
            idx += 1

    if not cards:
        cards.append({
            "id": f"{audit.get('name', 'proj')}-fc-0",
            "question": "这个项目的核心技术难点是什么？",
            "answer": f"项目包含 {audit.get('summary', {}).get('file_count_scanned', 0)} 个文件，涵盖 {len(audit.get('signals', {}))} 个技术维度",
        })

    return cards[:5]
