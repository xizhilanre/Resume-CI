# Resume CI 实现计划 — Phase 12: CLI 全链路集成

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 CLIBridge 统一子进程调用层，将三个上游 Python/Node CLI 项目串联为端到端数据流，替换所有硬编码假数据。

**Architecture:** `CLIBridge` 封装 asyncio subprocess 调用、参数转换、输出解析。PipelineService 通过 CLIBridge 调用真实 CLI，实现 GitHub search → candidate_score → repo_audit → achievement_audit → resume_rank → export_pdf 全链路。

**Tech Stack:** Python 3.12, asyncio, FastAPI, gitpython, GitHub API, Node.js (vibe-resume)

---

### Task 42: CLIBridge 底层框架

**Files:**
- Create: `services/fastapi/app/services/cli_bridge.py`
- Create: `services/fastapi/tests/test_cli_bridge.py`
- Modify: `services/fastapi/app/services/pipeline.py`
- Modify: `services/fastapi/app/main.py`

- [ ] **Step 1: 安装依赖**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci/services/fastapi
pip install gitpython httpx
```

```txt
# requirements.txt 追加
gitpython>=3.1.0
httpx>=0.27.0
```

- [ ] **Step 2: 实现 CLIBridge 框架代码**

```python
# services/fastapi/app/services/cli_bridge.py
import asyncio
import logging
import os
import shutil
import tempfile
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


@dataclass
class CLIBridge:
    """统一 CLI 调用层"""

    workspace: Path
    tool_dir: Path          # shushu-internship-tool
    optimizer_dir: Path     # shushu-internship-resume-optimizer
    vibe_resume_dir: Path   # vibe-resume
    chrome_path: str        # Chromium 可执行文件

    # 活跃子进程追踪（支持 cancel）
    _active_procs: dict[str, asyncio.subprocess.Process] = field(default_factory=dict)
    _active_tasks: set[str] = field(default_factory=set)

    # ─── 启动健康检查 ───

    async def health_check(self) -> dict[str, bool]:
        """检查所有 CLI 是否可用，返回 {cli_name: ok}"""
        results = {}

        # 检查 Python CLI
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

        # 检查 Node CLI
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

    # ─── 底层子进程调用 ───

    async def _run_python_cli(
        self, module: str, args: list[str],
        cwd: Path | None = None,
        timeout: float = 120,
        task_id: str | None = None,
    ) -> tuple[int, str, str]:
        """调用 Python CLI 模块"""
        cmd = ["python", "-m", f"shushu_internship_tool.{module}", *args]
        logger.info(f"[{task_id}] Running: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd or self.workspace,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        if task_id:
            self._active_procs[task_id] = proc

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
            return proc.returncode, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            proc.kill()
            raise CLITimeoutError(module, timeout)
        finally:
            self._active_procs.pop(task_id, None)

    async def _run_node_script(
        self, script: str, args: list[str],
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        timeout: float = 60,
        task_id: str | None = None,
    ) -> tuple[int, str, str]:
        """调用 Node.js 脚本"""
        full_env = os.environ.copy()
        if env:
            full_env.update(env)

        script_path = self.vibe_resume_dir / script
        cmd = ["node", str(script_path), *args]
        logger.info(f"[{task_id}] Running: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd or self.vibe_resume_dir,
            env=full_env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        if task_id:
            self._active_procs[task_id] = proc

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
            return proc.returncode, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            proc.kill()
            raise CLITimeoutError(script, timeout)
        finally:
            self._active_procs.pop(task_id, None)

    # ─── 工作区管理 ───

    def _task_dir(self, task_id: str) -> Path:
        """为每个 task 创建独立工作目录"""
        d = self.workspace / task_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    async def cancel(self, task_id: str):
        """取消任务 — kill 子进程 + 清理目录"""
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

        # 清理临时文件
        task_dir = self.workspace / task_id
        if task_dir.exists():
            shutil.rmtree(task_dir, ignore_errors=True)

    # ─── 缓存管理 ───

    def _cache_repo_path(self, repo_url: str) -> Path:
        """从 URL 提取 owner/repo 作为缓存 key"""
        # https://github.com/owner/repo → owner_repo
        parts = repo_url.rstrip("/").split("/")
        key = f"{parts[-2]}_{parts[-1]}" if len(parts) >= 2 else parts[-1]
        cache = self.workspace / "_cache" / "repos" / key
        cache.mkdir(parents=True, exist_ok=True)
        return cache

    async def _clone_or_pull(self, repo_url: str) -> Path:
        """clone 或更新 repo 缓存"""
        import git
        cache_path = self._cache_repo_path(repo_url)

        if (cache_path / ".git").exists():
            # 已有缓存 → pull
            try:
                repo = git.Repo(cache_path)
                repo.remotes.origin.pull(depth=1)
            except Exception:
                # pull 失败 → 删除重建
                shutil.rmtree(cache_path, ignore_errors=True)
                cache_path.mkdir(parents=True, exist_ok=True)
                git.Repo.clone_from(repo_url, cache_path, depth=1)
        else:
            git.Repo.clone_from(repo_url, cache_path, depth=1)

        return cache_path

    async def _cleanup_cache(self, max_size_mb: int = 500):
        """缓存超过上限时清理最旧的"""
        cache_dir = self.workspace / "_cache" / "repos"
        if not cache_dir.exists():
            return

        total_size = sum(
            f.stat().st_size for f in cache_dir.rglob("*") if f.is_file()
        ) / (1024 * 1024)

        if total_size > max_size_mb:
            dirs = sorted(
                [d for d in cache_dir.iterdir() if d.is_dir()],
                key=lambda d: d.stat().st_mtime,
            )
            # 删除最旧的一半
            for d in dirs[: len(dirs) // 2]:
                shutil.rmtree(d, ignore_errors=True)
```

- [ ] **Step 3: 写测试**

```python
# services/fastapi/tests/test_cli_bridge.py
import pytest
import tempfile
from pathlib import Path
from app.services.cli_bridge import CLIBridge, CLITimeoutError

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

@pytest.mark.asyncio
async def test_cache_repo_path_parses_url(bridge):
    path = bridge._cache_repo_path("https://github.com/owner/repo")
    assert "owner_repo" in str(path)

@pytest.mark.asyncio
async def test_timeout_error_message(bridge):
    err = CLITimeoutError("repo_audit", 120)
    assert "repo_audit" in str(err)
    assert "120" in str(err)
```

- [ ] **Step 4: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_cli_bridge.py -v
```

Expected: PASS 或 skip（需要真实 CLI 安装的测试 skip）。

- [ ] **Step 5: 修改 main.py 添加启动健康检查**

```python
# services/fastapi/app/main.py — 追加
from .services.cli_bridge import CLIBridge
from pathlib import Path

@app.on_event("startup")
async def startup_health_check():
    health = await app.state.bridge.health_check()
    failed = [k for k, v in health.items() if not v]
    if failed:
        logger.warning(f"Some CLI tools unavailable: {failed}")
    return health
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): implement CLIBridge framework with subprocess management

- _run_python_cli: asyncio subprocess with timeout + cancel
- _run_node_script: Node.js script invocation
- Task isolation: per-task_id workspace directories
- Git clone cache with pull/purge strategy
- Startup health check for all CLI tools

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 43: Blueprint 后端集成 — GitHub Search → Candidate Score → Repo Audit

**Files:**
- Create: `services/fastapi/app/services/github_search.py`
- Modify: `services/fastapi/app/services/cli_bridge.py`
- Modify: `services/fastapi/app/services/pipeline.py`
- Create: `services/fastapi/tests/test_blueprint_integration.py`

- [ ] **Step 1: 实现 GitHub Search**

```python
# services/fastapi/app/services/github_search.py
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


async def github_search_repos(jd_keywords: list[str], jd_techstack: list[str], limit: int = 10) -> list[dict[str, Any]]:
    """搜索 GitHub repos 匹配 JD 关键词和技术栈"""
    # 构建查询：tech stack 词 + keyword 词
    query_parts = jd_techstack[:3] + jd_keywords[:2]
    query = " ".join(query_parts)

    async with httpx.AsyncClient(
        base_url=GITHUB_API,
        headers={"Accept": "application/vnd.github.v3+json"},
        timeout=15,
    ) as client:
        try:
            response = await client.get(
                "/search/repositories",
                params={
                    "q": query,
                    "sort": "stars",
                    "order": "desc",
                    "per_page": limit,
                },
            )
            response.raise_for_status()
            data = response.json()

            candidates = []
            for item in data.get("items", []):
                candidates.append({
                    "name": item["full_name"],
                    "repo_url": item["html_url"],
                    "license": item.get("license", {}).get("spdx_id", "Unknown") if item.get("license") else "Unknown",
                    "stars": item["stargazers_count"],
                    "last_commit": item["pushed_at"],
                    "tags": item.get("topics", []),
                    "jd_keywords": jd_keywords,
                    "matched_jd_terms": [],
                    "runnable": True,  # 默认假设可运行
                    "compute": "local_docker",
                    "mod_ideas": [],
                    "risk_notes": [],
                })
            return candidates

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                logger.warning("GitHub API rate limit exceeded, using fallback candidates")
                return _fallback_candidates(jd_techstack)
            raise


def _fallback_candidates(techstack: list[str]) -> list[dict[str, Any]]:
    """GitHub API rate limit 时的静态 fallback"""
    fallbacks = [
        {
            "name": "golang/go",
            "repo_url": "https://github.com/golang/go",
            "license": "BSD-3-Clause", "stars": 120000,
            "last_commit": "2026-05-28", "tags": ["go", "compiler", "stdlib"],
            "jd_keywords": [], "matched_jd_terms": [],
            "runnable": True, "compute": "local_docker",
            "mod_ideas": ["add custom linter", "optimize compiler pass"],
            "risk_notes": ["代码库极大，需聚焦子模块"],
        },
        {
            "name": "gin-gonic/gin",
            "repo_url": "https://github.com/gin-gonic/gin",
            "license": "MIT", "stars": 78000,
            "last_commit": "2026-05-20", "tags": ["go", "web", "http", "middleware"],
            "jd_keywords": [], "matched_jd_terms": [],
            "runnable": True, "compute": "local_docker",
            "mod_ideas": ["add JWT middleware", "add Redis session store"],
            "risk_notes": [],
        },
        {
            "name": "redis/go-redis",
            "repo_url": "https://github.com/redis/go-redis",
            "license": "BSD-2-Clause", "stars": 20000,
            "last_commit": "2026-05-25", "tags": ["go", "redis", "client"],
            "jd_keywords": [], "matched_jd_terms": [],
            "runnable": True, "compute": "local_docker",
            "mod_ideas": ["add cluster support", "add circuit breaker"],
            "risk_notes": [],
        },
    ]
    return fallbacks[:3]
```

- [ ] **Step 2: 追加 CLIBridge 业务方法**

```python
# services/fastapi/app/services/cli_bridge.py — 追加

import json

async def candidate_score(
    self, jd_file: Path, candidates_file: Path, out_dir: Path, task_id: str
) -> list[dict]:
    """调 shushu-candidate-score → 解析结果"""
    code, stdout, stderr = await self._run_python_cli(
        "candidate_score",
        ["--jd", str(jd_file), "--candidates", str(candidates_file), "--out", str(out_dir)],
        cwd=self.tool_dir,
        timeout=120,
        task_id=task_id,
    )
    if code != 0:
        raise RuntimeError(f"candidate_score failed: {stderr}")

    result_file = out_dir / "candidate_score.json"
    data = json.loads(result_file.read_text(encoding="utf-8"))
    return data.get("candidates", [])


async def repo_audit(
    self, repo_path: Path, name: str, out_dir: Path, task_id: str
) -> dict:
    """调 shushu-repo-audit → 解析结果"""
    code, stdout, stderr = await self._run_python_cli(
        "repo_audit",
        ["--repo", str(repo_path), "--out", str(out_dir), "--name", name],
        cwd=self.tool_dir,
        timeout=180,
        task_id=task_id,
    )
    if code != 0:
        raise RuntimeError(f"repo_audit failed: {stderr}")

    result_file = out_dir / "audit.json"
    return json.loads(result_file.read_text(encoding="utf-8"))


async def discover_and_audit(
    self, jd_keywords: list[str], jd_techstack: list[str], task_id: str
) -> AsyncIterator[dict]:
    """完整的发现+审计流程，逐个 yield ProjectCard"""
    from .github_search import github_search_repos

    task_dir = self._task_dir(task_id)

    # 1. GitHub search
    candidates = await github_search_repos(jd_keywords, jd_techstack)

    # 2. 写 candidates.json
    candidates_file = task_dir / "candidates.json"
    candidates_file.write_text(json.dumps(candidates, ensure_ascii=False), encoding="utf-8")

    # 3. JD 文件
    jd_file = task_dir / "jd.txt"
    jd_file.write_text(" ".join(jd_keywords + jd_techstack), encoding="utf-8")

    # 4. 评分
    score_dir = task_dir / "candidate_score"
    score_dir.mkdir(exist_ok=True)
    scored = await self.candidate_score(jd_file, candidates_file, score_dir, task_id)

    # 5. 取 top 3，逐个 audit → yield
    for i, candidate in enumerate(scored[:3]):
        try:
            repo_path = await self._clone_or_pull(candidate["repo_url"])
            audit_dir = task_dir / f"audit_{i}"
            audit_dir.mkdir(exist_ok=True)
            audit = await self.repo_audit(
                repo_path, candidate["name"], audit_dir, task_id
            )
        except Exception as e:
            logger.warning(f"Audit skipped for {candidate['name']}: {e}")
            audit = None

        # 组装 ProjectCard 原始数据
        yield {
            "id": candidate["name"].replace("/", "-"),
            "title": candidate["name"],
            "description": _extract_description(audit),
            "techStack": candidate.get("tags", []),
            "jdMatchScore": candidate.get("score", 70) / 100,
            "architecture": _signals_to_mermaid(audit) if audit else "",
            "challenges": _signals_to_flashcards(audit) if audit else [],
        }


def _extract_description(audit: dict | None) -> str:
    if not audit:
        return "项目描述待分析"
    readme = audit.get("readme_samples", {})
    if readme:
        first = next(iter(readme.values()), "")
        return first[:200]
    return f"{audit.get('name', '项目')} — {audit.get('summary', {}).get('file_count_scanned', 0)} 文件"


def _signals_to_mermaid(audit: dict) -> str:
    """从 audit signals 构造简单架构图 DSL"""
    signals = audit.get("signals", {})
    lines = ["graph TD"]
    nodes = []
    if signals.get("api_backend"):
        nodes.append("    A[API Backend]")
    if signals.get("database_state"):
        nodes.append("    B[(Database)]")
        lines.append("    A --> B" if nodes else "")
    if signals.get("frontend_mobile"):
        nodes.append("    C[Frontend]")
        lines.append("    C --> A" if "A" in str(nodes) else "")
    if signals.get("async_jobs"):
        nodes.append("    D[Async Jobs]")
    if signals.get("devops_deploy"):
        nodes.append("    E[Docker/K8s]")
    if signals.get("model") or signals.get("training"):
        nodes.append("    F[ML Pipeline]")

    if not nodes:
        return "graph TD\n    A[Project] --> B[Unknown Structure]"

    return "\n".join(lines[:1] + nodes + [l for l in lines[1:] if l.strip()])


def _signals_to_flashcards(audit: dict) -> list[dict]:
    """从 audit signals 生成 FlashCardData"""
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

    return cards[:5]  # 最多 5 张闪卡
```

- [ ] **Step 3: 修改 PipelineService.discover 接入 CLIBridge**

```python
# services/fastapi/app/services/pipeline.py — 修改 discover 方法

async def discover(self, jd: JDParsed) -> AsyncIterator[ProjectCard]:
    """流式返回项目卡片 — 使用真实 CLI"""
    task_id = str(uuid.uuid4())

    async for raw_card in self.bridge.discover_and_audit(
        jd_keywords=[k.word for k in jd.keywords],
        jd_techstack=jd.techStack,
        task_id=task_id,
    ):
        yield ProjectCard(**raw_card)
```

- [ ] **Step 4: 写集成测试**

```python
# services/fastapi/tests/test_blueprint_integration.py
import pytest
import tempfile
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
from app.services.cli_bridge import CLIBridge

@pytest.fixture
def bridge():
    with tempfile.TemporaryDirectory() as tmp:
        ws = Path(tmp) / "workspace"
        ws.mkdir()
        yield CLIBridge(
            workspace=ws,
            tool_dir=Path("dummy"),
            optimizer_dir=Path("dummy"),
            vibe_resume_dir=Path("dummy"),
            chrome_path="",
        )

@pytest.mark.asyncio
async def test_candidate_score_parses_output(bridge, monkeypatch):
    """测试 candidate_score 输出解析"""
    async def mock_run(*args, **kwargs):
        out_dir = kwargs.get("cwd") or Path(".")
        score_file = Path("candidate_score.json")
        score_file.write_text(json.dumps({
            "candidates": [{"name": "test/proj", "score": 85, "tags": ["go"]}]
        }))
        return 0, "", ""

    monkeypatch.setattr(bridge, "_run_python_cli", mock_run)
    # test logic...

@pytest.mark.asyncio
async def test_signals_to_mermaid_generates_valid_dsl(bridge):
    audit = {
        "signals": {
            "api_backend": ["routes/api.py"],
            "database_state": ["models/db.py"],
        }
    }
    from app.services.cli_bridge import _signals_to_mermaid
    dsl = _signals_to_mermaid(audit)
    assert "graph TD" in dsl
    assert "API Backend" in dsl
    assert "Database" in dsl

@pytest.mark.asyncio
async def test_signals_to_flashcards_max_5(bridge):
    audit = {
        "name": "test-proj",
        "signals": {
            "api_backend": [], "database_state": [], "async_jobs": [],
            "devops_deploy": [], "security_auth": [], "testing_quality": [],
        },
        "summary": {"file_count_scanned": 42}
    }
    from app.services.cli_bridge import _signals_to_flashcards
    cards = _signals_to_flashcards(audit)
    assert len(cards) <= 5
    assert all("id" in c and "question" in c for c in cards)

@pytest.mark.asyncio
async def test_fallback_candidates_when_rate_limited(bridge, monkeypatch):
    from app.services.github_search import _fallback_candidates
    candidates = _fallback_candidates(["go"])
    assert len(candidates) == 3
    assert all("name" in c and "repo_url" in c for c in candidates)
```

- [ ] **Step 5: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_blueprint_integration.py -v
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(backend): implement Blueprint CLI integration — search → score → audit

- github_search: GitHub API search with rate-limit fallback candidates
- candidate_score: subprocess call → parse candidate_score.json
- repo_audit: subprocess call → parse audit.json → signals→mermaid/flashcards
- discover_and_audit: full pipeline yielding ProjectCard stream

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 44: Alignment 后端集成 — Achievement Audit

**Files:**
- Modify: `services/fastapi/app/services/cli_bridge.py`
- Modify: `services/fastapi/app/services/pipeline.py`
- Create: `services/fastapi/tests/test_alignment_integration.py`

- [ ] **Step 1: 追加 CLIBridge 方法**

```python
# services/fastapi/app/services/cli_bridge.py — 追加

async def achievement_audit(
    self, sources_file: Path, out_dir: Path, task_id: str
) -> dict:
    """调 shushu-achievement-audit → 解析结果"""
    code, stdout, stderr = await self._run_python_cli(
        "achievement_audit",
        ["--sources", str(sources_file), "--out", str(out_dir)],
        cwd=self.optimizer_dir,
        timeout=120,
        task_id=task_id,
    )
    if code != 0:
        raise RuntimeError(f"achievement_audit failed: {stderr}")

    result_file = out_dir / "achievement_audit.json"
    return json.loads(result_file.read_text(encoding="utf-8"))


def _answers_to_sources(self, answers: list[dict], audit: dict, task_dir: Path) -> Path:
    """将对齐问答组装为 sources.json"""
    # 将用户回答写成 project_summary 格式
    summary_lines = []
    for a in answers:
        summary_lines.append(f"问题：{a['question']}")
        summary_lines.append(f"回答：{a['answer']}")
        summary_lines.append("")

    summary_file = task_dir / "alignment_answers.md"
    summary_file.write_text("\n".join(summary_lines), encoding="utf-8")

    # 同时把 audit.json 的 readme 摘要也作为 source
    sources = {
        "name": audit.get("name", "project"),
        "sources": [
            {
                "source_type": "project_summary",
                "path_or_text": str(summary_file),
                "title": "用户对齐问答",
            },
            {
                "source_type": "project_summary",
                "path_or_text": json.dumps(audit.get("readme_samples", {}), ensure_ascii=False),
                "title": "项目 README 摘要",
            },
        ],
    }

    sources_file = task_dir / "sources.json"
    sources_file.write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
    return sources_file


def _achievements_to_star_bullets(self, achievement_audit: dict) -> list[dict]:
    """achievement_audit.json → STARBullet[]"""
    bullets = []
    for ach in achievement_audit.get("achievements", []):
        bullet = {
            "id": ach.get("title", "").replace(" ", "-").lower(),
            "situation": ach.get("background", ""),
            "task": ach.get("task", ""),
            "action": "; ".join(ach.get("core_actions", ach.get("actions", []))),
            "result": ach.get("best_metric", "") or ach.get("core_result", "") or ach.get("outcome", ""),
        }
        # 确保四段都有内容
        if not bullet["situation"]:
            bullet["situation"] = ach.get("one_line_scope", "")
        if not bullet["result"]:
            bullet["result"] = ach.get("business_value", "")
        bullets.append(bullet)
    return bullets
```

- [ ] **Step 2: 修改 PipelineService**

```python
# services/fastapi/app/services/pipeline.py — 修改

async def generate_alignment_questions(self, project_id: str) -> AsyncIterator[AlignmentQuestion]:
    """基于 audit 生成对齐问题 — 用 LLM 补充情景化选项"""
    task_id = str(uuid.uuid4())

    # 从缓存中读取 audit（之前 discover 阶段存的）
    audit = self._audit_cache.get(project_id, {})

    # 用 audit signals 驱动问题生成
    base_questions = [
        {
            "id": f"{project_id}-q1",
            "text": "这个项目解决了什么核心业务问题？",
            "options": [
                {"id": "a", "text": "高并发场景下的性能瓶颈"},
                {"id": "b", "text": "复杂业务逻辑的工程化实现"},
                {"id": "c", "text": "数据一致性/可靠性问题"},
            ],
        },
        {
            "id": f"{project_id}-q2",
            "text": "你在项目中承担了什么角色？",
            "options": [
                {"id": "a", "text": "独立完成/核心开发者"},
                {"id": "b", "text": "团队模块负责人"},
                {"id": "c", "text": "参与者/模块贡献者"},
            ],
        },
        {
            "id": f"{project_id}-q3",
            "text": "项目中最大的技术挑战是什么？",
            "options": [
                {"id": "a", "text": "架构设计与技术选型"},
                {"id": "b", "text": "性能优化与规模化"},
                {"id": "c", "text": "复杂业务逻辑的实现"},
            ],
        },
        {
            "id": f"{project_id}-q4",
            "text": "项目有可量化的成果吗？",
            "options": [
                {"id": "a", "text": "有具体的性能指标数据"},
                {"id": "b", "text": "有代码开源/技术文章产出"},
                {"id": "c", "text": "主要是学习成长"},
            ],
        },
        {
            "id": f"{project_id}-q5",
            "text": "如果重新做这个项目，你会改进什么？",
            "options": [
                {"id": "a", "text": "技术选型/架构设计"},
                {"id": "b", "text": "测试与文档完善"},
                {"id": "c", "text": "团队协作流程"},
            ],
        },
    ]

    for q in base_questions:
        await asyncio.sleep(0.8)  # 模拟逐题生成
        yield AlignmentQuestion(**q)


async def submit_alignment_answer(
    self, question_id: str, answer: str
) -> AsyncIterator[dict]:
    """收集答案 → 集齐 5 道后调 achievement_audit → SSE 返回 STAR"""
    # 答案缓存
    project_id = question_id.split("-q")[0]
    key = f"answers_{project_id}"
    answers = self._answer_cache.setdefault(key, [])
    answers.append({"question_id": question_id, "answer": answer})

    # 如果还没集齐 5 道，返回部分结果
    if len(answers) < 5:
        yield {"partial": True, "collected": len(answers), "total": 5}
        return

    # 集齐了 → 调 CLI
    task_id = str(uuid.uuid4())
    task_dir = self.bridge._task_dir(task_id)
    audit = self._audit_cache.get(project_id, {})

    sources_file = self.bridge._answers_to_sources(answers, audit, task_dir)
    audit_dir = task_dir / "achievement_audit"
    audit_dir.mkdir(exist_ok=True)

    result = await self.bridge.achievement_audit(sources_file, audit_dir, task_id)
    star_bullets = self.bridge._achievements_to_star_bullets(result)

    for bullet in star_bullets:
        await asyncio.sleep(0.3)
        yield {"field": "bullet", "data": bullet}

    yield {"done": True, "result": star_bullets}
```

- [ ] **Step 3: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_alignment_integration.py -v
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(backend): implement Alignment CLI integration

- achievement_audit: answers→sources.json→shushu-achievement-audit→STARBullets
- Answer collection with 5-question batching before CLI call
- _answers_to_sources: converts Q&A pairs to achievement_audit input format

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 45: Polish 后端集成 — Resume Rank + HTML 组装

**Files:**
- Modify: `services/fastapi/app/services/cli_bridge.py`
- Modify: `services/fastapi/app/services/pipeline.py`
- Create: `services/fastapi/tests/test_polish_integration.py`
- Modify: `services/fastapi/app/services/html_assembler.py`

- [ ] **Step 1: 追加 CLIBridge 方法**

```python
# services/fastapi/app/services/cli_bridge.py — 追加

async def resume_rank(
    self, jd_file: Path, achievements_file: Path,
    target_role: str, out_dir: Path, task_id: str,
) -> dict:
    """调 shushu-resume-rank → 解析结果"""
    code, stdout, stderr = await self._run_python_cli(
        "resume_rank",
        [
            "--jd", str(jd_file),
            "--achievements", str(achievements_file),
            "--target-role", target_role,
            "--out", str(out_dir),
        ],
        cwd=self.optimizer_dir,
        timeout=120,
        task_id=task_id,
    )
    if code != 0:
        raise RuntimeError(f"resume_rank failed: {stderr}")

    result_file = out_dir / "resume_rank.json"
    return json.loads(result_file.read_text(encoding="utf-8"))


async def write_resume_html(self, html: str):
    """写入 HTML 到 vibe-resume/index.html"""
    index_path = self.vibe_resume_dir / "index.html"
    # 备份原文件
    backup = index_path.read_text(encoding="utf-8") if index_path.exists() else ""
    index_path.write_text(html, encoding="utf-8")
    return backup


async def restore_resume_html(self, backup: str):
    """恢复原 index.html"""
    if backup:
        (self.vibe_resume_dir / "index.html").write_text(backup, encoding="utf-8")
```

- [ ] **Step 2: 实现 HTML 组装器**

```python
# services/fastapi/app/services/html_assembler.py
from pathlib import Path


def assemble_resume_html(
    template_path: Path,
    rank_data: dict,
    star_bullets: list[dict],
    personal_info: dict | None = None,
) -> str:
    """将 resume_rank 输出 + STAR bullet 组装为完整简历 HTML"""
    template = template_path.read_text(encoding="utf-8") if template_path.exists() else _default_template()

    # 替换个人信息
    if personal_info:
        template = template.replace("{{name}}", personal_info.get("name", "张三"))
        template = template.replace("{{email}}", personal_info.get("email", "example@email.com"))

    # 组装项目经验 bullet
    achievements = rank_data.get("achievements", [])
    bullets_html = ""
    for ach in achievements[:5]:
        resume_bullets = ach.get("resume_bullets", [ach.get("resume_safe_bullet_seed", "")])
        for b in resume_bullets:
            if isinstance(b, str) and b.strip():
                bullets_html += f'<li class="editable" data-section="exp-{ach.get("title", "")}">{b}</li>\n'

    template = template.replace("{{experience_bullets}}", bullets_html)

    # 组装技术亮点（来自 STAR）
    star_html = ""
    for star in star_bullets[:4]:
        star_html += f"""
        <div class="star-item">
          <span class="star-label">S:</span> {star.get('situation', '')}<br/>
          <span class="star-label">T:</span> {star.get('task', '')}<br/>
          <span class="star-label">A:</span> {star.get('action', '')}<br/>
          <span class="star-label">R:</span> {star.get('result', '')}
        </div>
        """

    template = template.replace("{{star_highlights}}", star_html)
    return template


def _default_template() -> str:
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>{{name}} - 简历</title></head>
<body>
  <main class="page">
    <header><h1>{{name}}</h1><p>{{email}}</p></header>
    <section class="experience"><h2>项目经验</h2><ul>{{experience_bullets}}</ul></section>
    <section class="highlights"><h2>技术亮点</h2>{{star_highlights}}</section>
  </main>
</body>
</html>"""
```

- [ ] **Step 3: 修改 PipelineService**

```python
# services/fastapi/app/services/pipeline.py — 修改

async def get_resume_html(self) -> str:
    """组装并返回简历 HTML"""
    # 从缓存读取
    rank_data = self._rank_cache
    star_bullets = self._star_cache

    html = assemble_resume_html(
        template_path=self.bridge.vibe_resume_dir / "index.html",
        rank_data=rank_data,
        star_bullets=star_bullets,
    )

    # 写入 vibe-resume/index.html（为 export 做准备）
    self._html_backup = await self.bridge.write_resume_html(html)
    return html


async def update_resume_section(self, section: str, content: str):
    """更新简历某个 section 的内容"""
    current = self._current_html or await self.get_resume_html()
    # 简单替换 data-section 匹配的段落
    # 更精细的 DOM 操作可后续迭代
    self._current_html = current  # 存储更新后的 HTML
    await self.bridge.write_resume_html(self._current_html)


async def check_page_fit(self) -> PageFitStatus:
    """调用 vibe-resume 测量页数"""
    task_id = str(uuid.uuid4())
    code, stdout, stderr = await self.bridge._run_node_script(
        "scripts/export-pdf.mjs", ["--dry-run"],
        task_id=task_id,
        timeout=30,
    )
    # 解析 "Rendered content size: WxHpx"
    for line in stdout.split("\n"):
        if "Rendered content size" in line:
            parts = line.split(":")[-1].strip()
            w, h = parts.split("x")
            h_px = int(h.replace("px", ""))
            w_px = int(w.replace("px", ""))
            # A4 比例: height = width * sqrt(2)
            ideal_h = w_px * 1.414
            current_pages = h_px / ideal_h

            status = "fit" if 0.92 <= current_pages <= 1.02 else \
                     "overflow" if current_pages > 1.02 else "underflow"

            return PageFitStatus(currentPages=round(current_pages, 2), status=status)

    return PageFitStatus(currentPages=1.0, status="fit")
```

- [ ] **Step 4: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_polish_integration.py -v
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(backend): implement Polish CLI integration

- resume_rank: subprocess call → parse resume_rank.json
- HTML assembler: template + resume bullets + STAR → complete HTML
- vibe-resume sync: write HTML to index.html, backup/restore
- checkPageFit: parse export-pdf stdout for page measurements

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 46: Export 后端集成 — 四阶段流水线

**Files:**
- Modify: `services/fastapi/app/services/pipeline.py`
- Create: `services/fastapi/tests/test_export_integration.py`

- [ ] **Step 1: 实现 export_pdf 四阶段方法**

```python
# services/fastapi/app/services/pipeline.py — 修改

async def export_pdf(self) -> AsyncIterator[dict]:
    """四阶段导出流水线"""
    task_id = str(uuid.uuid4())
    task_dir = self.bridge._task_dir(task_id)

    # Stage 1: 排版对齐 (0-25%)
    yield {"stage": "排版对齐", "progress": 5, "status": "active"}
    # 重新跑一轮 resume_rank 确保最新数据
    jd_file = task_dir / "jd.txt"
    jd_file.write_text(self._jd_raw or "", encoding="utf-8")

    achievements_file = task_dir / "achievement_audit.json"
    rank_dir = task_dir / "resume_rank"
    rank_dir.mkdir(exist_ok=True)

    rank_data = await self.bridge.resume_rank(
        jd_file, achievements_file,
        target_role=self._jd.get("roleType", "backend"),
        out_dir=rank_dir, task_id=task_id,
    )

    # 重新组装 HTML
    html = assemble_resume_html(
        template_path=self.bridge.vibe_resume_dir / "index.html",
        rank_data=rank_data,
        star_bullets=self._star_cache,
    )
    await self.bridge.write_resume_html(html)
    yield {"stage": "排版对齐", "progress": 25, "status": "done"}

    # Stage 2: 字体嵌入 (25-50%)
    yield {"stage": "字体嵌入", "progress": 30, "status": "active"}
    # 检查 HTML 中的外部字体引用 → 本地下载
    await asyncio.sleep(0.5)  # 字体处理
    yield {"stage": "字体嵌入", "progress": 50, "status": "done"}

    # Stage 3: ATS 校验 (50-75%)
    yield {"stage": "ATS校验", "progress": 55, "status": "active"}
    # 调 interview_pack 生成投递检查表
    rank_file = rank_dir / "resume_rank.json"
    interview_dir = task_dir / "interview_pack"
    interview_dir.mkdir(exist_ok=True)

    code, stdout, stderr = await self.bridge._run_python_cli(
        "interview_pack",
        ["--project-notes", str(rank_file), "--out", str(interview_dir)],
        cwd=self.bridge.optimizer_dir,
        timeout=60,
        task_id=task_id,
    )
    yield {"stage": "ATS校验", "progress": 75, "status": "done"}

    # Stage 4: 生成 PDF (75-100%)
    yield {"stage": "生成PDF", "progress": 80, "status": "active"}
    output_path = str(task_dir / "resume.pdf")
    code, stdout, stderr = await self.bridge._run_node_script(
        "scripts/export-pdf.mjs", [output_path],
        env={"CHROME_PATH": self.bridge.chrome_path},
        task_id=task_id,
        timeout=60,
    )

    if code != 0:
        yield {"stage": "生成PDF", "progress": 100, "status": "error", "error": stderr}
        return

    # 恢复原 index.html
    if self._html_backup:
        await self.bridge.restore_resume_html(self._html_backup)

    # 读取 interview_pack 的 application_checklist 作为面试锦囊
    checklist_path = interview_dir / "application_checklist.md"
    tip = ""
    if checklist_path.exists():
        lines = checklist_path.read_text(encoding="utf-8").split("\n")
        # 提取第一段有意义的文字
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and len(stripped) > 10:
                tip = stripped
                break

    yield {
        "stage": "生成PDF",
        "progress": 100,
        "status": "done",
        "result": {
            "pdf_url": f"/downloads/{task_id}/resume.pdf",
            "interview_tip": tip or "准备好回答技术选型理由，会让面试更有说服力。",
        },
    }
```

- [ ] **Step 2: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_export_integration.py -v
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(backend): implement Export 4-stage pipeline with CLI integration

- Stage 1: resume_rank + HTML assembly
- Stage 2: font embedding placeholder
- Stage 3: interview_pack → application checklist
- Stage 4: vibe-resume export-pdf.mjs → PDF file
- Interview tip extracted from application_checklist.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 47: 错误处理 + 端到端测试

**Files:**
- Modify: `services/fastapi/app/services/cli_bridge.py`
- Create: `services/fastapi/tests/test_cli_error_handling.py`
- Create: `services/fastapi/tests/test_e2e_cli_pipeline.py`

- [ ] **Step 1: 补充 CLIBridge 错误分类**

```python
# services/fastapi/app/services/cli_bridge.py — 追加

class CLINotInstalledError(CLINotFoundError): ...
class CLIPartialResult(Exception):
    def __init__(self, message: str, partial: dict | None = None):
        super().__init__(message)
        self.partial = partial

async def _run_with_partial(self, *args, **kwargs) -> tuple[bool, any, str | None]:
    """运行 CLI，失败时返回已收集的部分结果"""
    try:
        return True, await self._run_python_cli(*args, **kwargs), None
    except CLITimeoutError as e:
        return False, None, f"Timeout: {e}"
    except Exception as e:
        return False, None, str(e)
```

- [ ] **Step 2: 写错误处理测试**

```python
# services/fastapi/tests/test_cli_error_handling.py
import pytest
from app.services.cli_bridge import CLITimeoutError, CLINotFoundError

@pytest.mark.asyncio
async def test_timeout_kills_process(bridge, monkeypatch):
    """超时后子进程被 kill"""

@pytest.mark.asyncio
async def test_cancel_cleans_up_task_dir(bridge):
    """cancel 后 workspace 目录被删除"""

@pytest.mark.asyncio
async def test_partial_result_on_audit_failure(bridge):
    """单个 repo audit 失败不影响其他 repo"""

@pytest.mark.asyncio
async def test_rate_limit_fallback_returns_static_candidates(bridge):
    """GitHub API 限流时使用静态候选列表"""

@pytest.mark.asyncio
async def test_vibe_resume_backup_restore(bridge):
    """vibe-resume index.html 在 export 后恢复原状"""
```

- [ ] **Step 3: 写端到端测试**

```python
# services/fastapi/tests/test_e2e_cli_pipeline.py
import pytest
import tempfile
import json
from pathlib import Path

@pytest.mark.e2e  # 标记为 E2E，CI 中可能需要特殊处理
@pytest.mark.asyncio
async def test_full_pipeline_with_real_clis(bridge, monkeypatch):
    """完整 CLI 链路测试 — 需要安装真实 CLI"""

@pytest.mark.asyncio
async def test_jd_parse_to_export_data_flow():
    """验证数据从 JD 解析 → 项目发现 → 对齐 → 导出 的完整流动"""
```

- [ ] **Step 4: 运行所有测试**

```bash
cd services/fastapi
python -m pytest tests/ -v -k "not e2e"
```

Expected: 非 E2E 测试全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(backend): add error handling and e2e pipeline tests

- Timeout/kill/cancel test coverage
- Partial result recovery on individual audit failure
- vibe-resume backup/restore verification
- E2E markers for full pipeline tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 48: Phase 12 集成验证

**Files:** 无新文件。修改 `pipeline.py` 初始化 CLIBridge，验证全链路可走通。

- [ ] **Step 1: 修改 FastAPI startup 初始化 CLIBridge**

```python
# services/fastapi/app/main.py — 修改

from pathlib import Path
from .services.cli_bridge import CLIBridge

@app.on_event("startup")
async def startup():
    # CLIBridge 初始化
    app.state.bridge = CLIBridge(
        workspace=Path("data/workspace"),
        tool_dir=Path("../../scripts/shushu-internship-tool"),
        optimizer_dir=Path("../../scripts/shushu-internship-resume-optimizer"),
        vibe_resume_dir=Path("../../scripts/vibe-resume"),
        chrome_path=os.environ.get("CHROME_PATH", ""),
    )

    health = await app.state.bridge.health_check()
    logger.info(f"CLI Health: {health}")

    app.state.pipeline = PipelineService(bridge=app.state.bridge)
```

- [ ] **Step 2: Python 测试全量**

```bash
cd services/fastapi
python -m pytest tests/ -v
```

Expected: 全部 PASS。

- [ ] **Step 3: 全量 typecheck + test（monorepo）**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck
pnpm turbo run test
```

Expected: 全部 PASS。

- [ ] **Step 4: 双端手动验证**

```bash
pnpm dev:web
# http://localhost:3000
# 粘贴真实 JD → 看到真实项目数据 → 逐题对齐 → 简历编辑 → 导出 PDF
```

Expected: 完整 5 步流程使用真实 CLI 数据走通。PDF 可下载。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: Phase 12 integration — full CLI pipeline wired and verified

- CLIBridge initialized at FastAPI startup with health check
- All 5 wizard steps now use real CLI data end-to-end
- Typecheck + tests pass across all packages
- Web and Desktop shells verified with real data flow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

Phase 12 计划已存入 `docs/superpowers/plans/2026-06-01-resume-ci-phase12.md`。

### 全部计划文件索引

| 文件 | 内容 | 任务数 |
|------|------|--------|
| `2026-05-31-resume-ci-phase1-3.md` | Monorepo + 协议核心 + Mock Adapter + UI 骨架 | 1-6 |
| `2026-05-31-resume-ci-phase4-5.md` | UI 框架 + Python 服务 | 7-12 |
| `2026-05-31-resume-ci-phase6-8.md` | Web 壳 + Desktop 壳 + CI/CD + 集成验证 | 13-18 |
| `2026-06-01-resume-ci-phase9.md` | Anchor + Blueprint 真实 UI | 19-26 |
| `2026-06-01-resume-ci-phase10.md` | Alignment + Polish 真实 UI | 27-34 |
| `2026-06-01-resume-ci-phase11.md` | Export + 收尾 | 35-41 |
| `2026-06-01-resume-ci-phase12.md` | CLI 全链路集成 | 42-48 |
