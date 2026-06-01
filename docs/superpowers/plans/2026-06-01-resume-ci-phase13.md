# Resume CI 实现计划 — Phase 13: 生产就绪

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FastAPI Docker 部署、SQLite 持久化、Desktop Python 运行时打包、Playwright E2E 测试、LLM Prompt 模板——补齐 MVP 最后五个缺口。

**Architecture:** FastAPI 通过 Docker + Fly.io 部署。SQLite 通过 aiosqlite 异步访问，schema 覆盖用户/会话/审计/编辑历史。Desktop 端 CI 构建 python-runtime.zip 内嵌免安装 Python。E2E 测试覆盖 8 条关键路径。LLM prompt 模板化，通过环境变量切换模型。

**Tech Stack:** Docker, Fly.io, aiosqlite, Playwright, GitHub Actions, Python embeddable

---

### Task 49: FastAPI Docker 化 + Fly.io 部署

**Files:**
- Create: `services/fastapi/Dockerfile`
- Create: `services/fastapi/.dockerignore`
- Create: `services/fastapi/fly.toml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
# services/fastapi/Dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git nodejs npm chromium \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# 三个上游 CLI（假设 CI 中已 checkout submodules）
COPY scripts/shushu-internship-tool/ /app/scripts/shushu-internship-tool/
COPY scripts/shushu-internship-resume-optimizer/ /app/scripts/shushu-internship-resume-optimizer/
COPY scripts/vibe-resume/ /app/scripts/vibe-resume/

RUN pip install -e /app/scripts/shushu-internship-tool \
    && pip install -e /app/scripts/shushu-internship-resume-optimizer \
    && cd /app/scripts/vibe-resume && npm install

# 数据持久化 volume
VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: 创建 .dockerignore**

```
services/fastapi/.dockerignore
__pycache__
*.pyc
.venv
.pytest_cache
tests/
*.md
.git
```

- [ ] **Step 3: 创建 fly.toml**

```toml
# services/fastapi/fly.toml
app = "resume-ci-api"
primary_region = "nrt"  # 东京（离中国最近）

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8000"

[[services]]
  protocol = "tcp"
  internal_port = 8000

  [[services.ports]]
    port = 80
    handlers = ["http"]
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024

[mounts]
  source = "resume_ci_data"
  destination = "/data"
```

- [ ] **Step 4: 添加健康检查端点**

```python
# services/fastapi/app/main.py — 追加
@app.get("/health")
async def health():
    return {"status": "ok", "cli_health": await app.state.bridge.health_check()}
```

- [ ] **Step 5: CI 追加 FastAPI deploy job**

```yaml
# .github/workflows/ci.yml — 追加
deploy-fastapi:
  needs: [quality, python-tests]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  timeout-minutes: 20
  environment:
    name: production
    url: https://resume-ci-api.fly.dev
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    - uses: superfly/flyctl-actions/setup-flyctl@master
    - name: Deploy to Fly.io
      working-directory: services/fastapi
      run: flyctl deploy --remote-only
      env:
        FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(deploy): Dockerize FastAPI + Fly.io deployment

- Dockerfile: Python 3.12-slim + git + node + chromium + 3 CLIs
- fly.toml: Tokyo region, 1GB RAM, /data volume mount
- Health check endpoint at GET /health
- CI job: deploy on push to main

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 50: SQLite 持久化层

**Files:**
- Create: `services/fastapi/app/services/database.py`
- Create: `services/fastapi/tests/test_database.py`
- Modify: `services/fastapi/app/main.py`
- Modify: `services/fastapi/requirements.txt`

- [ ] **Step 1: 安装 aiosqlite**

```bash
cd services/fastapi
pip install aiosqlite
```

```txt
# requirements.txt 追加
aiosqlite>=0.20.0
```

- [ ] **Step 2: 实现 Database 类**

```python
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
            cursor = await db.execute(
                "SELECT * FROM resume_sessions WHERE id = ?", (session_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return None
            return self._row_to_dict(row)

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
                 json.dumps(candidate_score) if candidate_score else None,
                 architecture_dsl),
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
                "SELECT * FROM alignment_sessions WHERE session_id = ? ORDER BY created_at",
                (session_id,),
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
```

- [ ] **Step 3: 写测试**

```python
# services/fastapi/tests/test_database.py
import pytest
import tempfile
from pathlib import Path
from app.services.database import Database

@pytest.fixture
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
```

- [ ] **Step 4: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_database.py -v
```

Expected: 5/5 PASS。

- [ ] **Step 5: 修改 main.py 初始化 Database**

```python
# services/fastapi/app/main.py — 追加
from .services.database import Database

@app.on_event("startup")
async def startup():
    db_path = Path(os.environ.get("DB_PATH", "data/resume-ci.db"))
    app.state.db = Database(db_path)
    await app.state.db.init()
    ...
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): implement SQLite persistence layer with aiosqlite

- Database class: session, audit, alignment, edit_history CRUD
- Schema: users, resume_sessions, project_audits, alignment_sessions, edit_history
- JSON columns auto-serialized/deserialized
- 5 passing tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 51: Desktop Python 运行时打包

**Files:**
- Create: `apps/desktop/scripts/build-python-runtime.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/desktop/src/main/python-bootstrap.ts`

- [ ] **Step 1: 写 build-python-runtime.sh**

```bash
#!/bin/bash
# apps/desktop/scripts/build-python-runtime.sh
set -e

PYTHON_VERSION="${PYTHON_VERSION:-3.12.8}"
PYTHON_MAJOR_MINOR="$(echo "$PYTHON_VERSION" | cut -d. -f1-2 | tr -d .)"
RUNTIME_DIR="python-runtime"
EMBED_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip"
PIP_URL="https://bootstrap.pypa.io/get-pip.py"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

echo "🔨 Building Python runtime v${PYTHON_VERSION}..."

rm -rf "$RUNTIME_DIR" python-embed.zip get-pip.py
mkdir -p "$RUNTIME_DIR"

# 1. 下载 + 解压 Python embeddable
echo "📥 Downloading Python embeddable..."
curl -sL "$EMBED_URL" -o python-embed.zip
unzip -q python-embed.zip -d "$RUNTIME_DIR"

# 2. 启用 pip
PTH_FILE=$(ls "$RUNTIME_DIR"/python*._pth 2>/dev/null | head -1)
if [ -f "$PTH_FILE" ]; then
    echo "import site" >> "$PTH_FILE"
    echo "Lib/site-packages" >> "$PTH_FILE"
    echo "scripts" >> "$PTH_FILE"
fi

# 3. 安装 pip
echo "📦 Installing pip..."
curl -sL "$PIP_URL" -o get-pip.py
"$RUNTIME_DIR/python.exe" get-pip.py --no-wheels --quiet

# 4. 安装依赖
echo "📦 Installing Python dependencies..."
"$RUNTIME_DIR/python.exe" -m pip install --quiet --no-warn-script-location \
    fastapi uvicorn[standard] pydantic openai anthropic gitpython httpx aiosqlite

# 5. 安装两个 Python CLI（开发模式）
"$RUNTIME_DIR/python.exe" -m pip install --quiet --no-warn-script-location \
    -e "$REPO_ROOT/scripts/shushu-internship-tool" \
    -e "$REPO_ROOT/scripts/shushu-internship-resume-optimizer"

# 6. 复制 FastAPI 代码 + CLI 源码
mkdir -p "$RUNTIME_DIR/app"
cp -r "$REPO_ROOT/services/fastapi/app/"* "$RUNTIME_DIR/app/"
cp -r "$REPO_ROOT/scripts/shushu-internship-tool" "$RUNTIME_DIR/scripts/"
cp -r "$REPO_ROOT/scripts/shushu-internship-resume-optimizer" "$RUNTIME_DIR/scripts/"
cp -r "$REPO_ROOT/scripts/vibe-resume" "$RUNTIME_DIR/scripts/"

# 7. 安装 vibe-resume Node 依赖
echo "📦 Installing vibe-resume Node dependencies..."
cd "$RUNTIME_DIR/scripts/vibe-resume" && npm install --silent
cd "$REPO_ROOT"

# 8. 打包
echo "📦 Packaging python-runtime.zip..."
zip -qr python-runtime.zip "$RUNTIME_DIR"

SIZE=$(du -sh python-runtime.zip | cut -f1)
echo "✅ python-runtime.zip built (${SIZE})"
```

- [ ] **Step 2: CI 集成 — ci.yml desktop job 追加**

```yaml
# .github/workflows/ci.yml — desktop job 中 build 之前追加
- name: Build Python Runtime
  shell: bash
  run: bash apps/desktop/scripts/build-python-runtime.sh
- name: Copy Runtime to Resources
  shell: bash
  run: |
    mkdir -p apps/desktop/resources
    cp python-runtime.zip apps/desktop/resources/
- name: Upload Python Runtime Artifact
  uses: actions/upload-artifact@v4
  with:
    name: python-runtime
    path: python-runtime.zip
```

- [ ] **Step 3: 更新 python-bootstrap.ts 支持 CI 构建路径**

```typescript
// apps/desktop/src/main/python-bootstrap.ts — 修改

// 生产模式：resources/python-runtime.zip（CI构建产物）
// 开发模式：用本地 pip venv
function getRuntimeZipPath(): string {
  if (import.meta.env.DEV) {
    // 开发模式不需要解压，直接用本地 venv
    return "";
  }
  return path.join(process.resourcesPath, "python-runtime.zip");
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(desktop): implement Python runtime build script + CI packaging

- build-python-runtime.sh: download embeddable Python, install deps + CLIs, zip
- ~35MB python-runtime.zip with full FastAPI + 3 CLI dependencies
- CI: build runtime → upload artifact → bundle into Electron resources
- Dev mode skips extraction, uses local pip venv

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 52: E2E 测试

**Files:**
- Create: `tests/e2e/specs/happy-path.spec.ts`
- Create: `tests/e2e/fixtures/mock-jd.ts`
- Create: `tests/e2e/playwright.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` (根)

- [ ] **Step 1: 安装 Playwright**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm add -D -w @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: 写 Playwright config**

```typescript
// tests/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'pnpm dev:web',
      port: 3000,
      timeout: 30000,
      reuseExistingServer: true,
    },
    {
      command: 'cd services/fastapi && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      port: 8000,
      timeout: 15000,
      reuseExistingServer: true,
    },
  ],
});
```

- [ ] **Step 3: 写 Mock JD fixture**

```typescript
// tests/e2e/fixtures/mock-jd.ts
export const MOCK_JD = `
我们正在寻找一位后端开发实习生，加入我们的核心服务团队。

【岗位要求】
1. 熟练掌握 Go 或 Java，了解微服务架构设计
2. 有 Redis、消息队列（Kafka/RabbitMQ）的实际使用经验
3. 了解 Docker 容器化部署，熟悉 Kubernetes 优先
4. 理解分布式系统基本概念（CAP、一致性、容错）
5. 有良好的代码习惯，熟悉 Git 工作流

【加分项】
- 有开源项目贡献经验
- 了解 CI/CD 流程
- 熟悉 Linux 环境
`;
```

- [ ] **Step 4: 写 8 条 E2E spec**

```typescript
// tests/e2e/specs/happy-path.spec.ts
import { test, expect } from '@playwright/test';
import { MOCK_JD } from '../fixtures/mock-jd';

test.describe('Resume CI — Complete User Journey', () => {

  test('1. JD input → parse → keyword cloud visible', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByTestId('jd-textarea');
    await textarea.fill(MOCK_JD);
    await page.getByTestId('parse-btn').click();
    await expect(page.getByTestId('keyword-cloud')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('kw-tag').first()).toBeVisible();
  });

  test('2. Match radar renders after JD parse', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('jd-textarea').fill(MOCK_JD);
    await page.getByTestId('parse-btn').click();
    await expect(page.getByTestId('radar-chart')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('match-radar')).toContainText(/匹配度/);
  });

  test('3. Navigate to Blueprint → skeletons → cards appear', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('jd-textarea').fill(MOCK_JD);
    await page.getByTestId('parse-btn').click();
    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('skeleton')).toHaveCount(3);
    await expect(page.getByTestId('card').first()).toBeVisible({ timeout: 30000 });
  });

  test('4. Select project → architecture diagram renders', async ({ page }) => {
    // 前置依赖 Task 3
    await page.goto('/?step=blueprint');
    await page.getByTestId('card').first().click({ timeout: 30000 });
    await expect(page.getByTestId('mermaid-container')).toBeVisible({ timeout: 15000 });
  });

  test('5. FlashCard flip interaction', async ({ page }) => {
    await page.goto('/?step=blueprint');
    await page.getByTestId('card').first().click({ timeout: 30000 });
    await page.getByTestId('flash-card').first().click();
    await expect(page.getByText(/点击翻回/)).toBeVisible();
  });

  test('6. Full alignment Q&A flow', async ({ page }) => {
    await page.goto('/?step=alignment');
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId('question-flow')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="question-flow"] button').first().click();
      await page.getByTestId('submit-answer').click();
      await expect(page.getByTestId('star-bullet')).toHaveCount(i + 1, { timeout: 10000 });
    }
  });

  test('7. Resume edit: double-click → type → Enter → saved', async ({ page }) => {
    await page.goto('/?step=polish');
    const paragraph = page.locator('[data-section]').first();
    await paragraph.dblclick();
    await page.keyboard.type(' 测试编辑');
    await page.keyboard.press('Enter');
    await expect(paragraph).toContainText('测试编辑');
  });

  test('8. Export pipeline → download button appears', async ({ page }) => {
    await page.goto('/?step=export');
    await expect(page.getByText('排版对齐')).toBeVisible();
    await expect(page.getByText('下载 PDF')).toBeVisible({ timeout: 60000 });
  });
});
```

- [ ] **Step 5: CI 追加 E2E job**

```yaml
# .github/workflows/ci.yml — 追加
e2e:
  needs: [quality]
  runs-on: ubuntu-latest
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: 'pnpm'
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: pnpm install --frozen-lockfile
    - run: pip install -r services/fastapi/requirements.txt
    - run: pnpm exec playwright install --with-deps chromium
    - name: Run E2E tests
      run: pnpm exec playwright test tests/e2e/
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-traces
        path: test-results/
```

- [ ] **Step 6: 根 package.json 追加脚本**

```jsonc
{
  "scripts": {
    "test:e2e": "playwright test tests/e2e/",
    "test:e2e:ui": "playwright test tests/e2e/ --ui"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test(e2e): add Playwright E2E tests covering all 5 wizard steps

- 8 test specs: JD parse, radar, skeleton→cards, diagram, flashcards, alignment, edit, export
- Playwright config with dual webServer (Next.js + FastAPI)
- CI e2e job with artifact upload on failure
- Mock JD fixture for reproducible tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 53: LLM Prompt 模板

**Files:**
- Create: `services/fastapi/app/services/prompts.py`
- Create: `services/fastapi/tests/test_prompts.py`

- [ ] **Step 1: 实现 prompts.py**

```python
# services/fastapi/app/services/prompts.py
"""LLM Prompt 模板 — 通过环境变量切换模型"""

import os
import json
import logging

logger = logging.getLogger(__name__)

MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")

# ═══════════════════════════════════════════
# 1. JD 解析
# ═══════════════════════════════════════════

JD_PARSE_SYSTEM = """你是一个专业的职位描述(JD)分析师。从用户提供的JD文本中提取结构化信息。
严格按JSON格式返回，不要添加额外说明。

规则：
1. keywords: 从JD中提取关键技术词，每个词赋予0-1权重
   - weight > 0.8: JD明确要求且反复出现
   - weight 0.5-0.8: JD提及一次
   - weight < 0.5: 加分项/软性要求
   - category: language|architecture|middleware|devops|concept
2. techStack: 具体的技术/工具名称列表
3. roleType: 后端|前端|算法|全栈|移动端|测试|数据|DevOps|安全|系统
4. matchProfile.score: 综合评估典型候选人匹配度(0-1)
5. matchProfile.gaps: 典型候选人可能缺失的关键技能/经验

返回示例：
{"keywords":[{"word":"Go","weight":0.95,"category":"language"}],"techStack":["Go","Redis"],"roleType":"后端","matchProfile":{"score":0.87,"gaps":["消息队列实战经验"]}}"""


def jd_parse_prompt(raw_jd: str) -> tuple[str, str]:
    return (JD_PARSE_SYSTEM, raw_jd)


# ═══════════════════════════════════════════
# 2. Mermaid DSL 生成
# ═══════════════════════════════════════════

MERMAID_SYSTEM = """你是一个软件架构分析师。根据项目文件结构信号，生成一个Mermaid架构图DSL。

规则：
- 使用 graph TD 格式
- 节点命名用英文标签，反映真实组件
- 只包含能从 signals 中推断的组件，不要编造
- 最多10个节点
- 数据库节点用 [(name)] 圆柱形
- signals=空时返回极简结构: graph TD\n    A[Project]"""


def mermaid_prompt(signals: dict, tree_preview: str) -> str:
    sig_summary = "\n".join(f"- {k}: {len(v)} 文件" for k, v in signals.items() if v)
    return (
        f"{MERMAID_SYSTEM}\n\n"
        f"Signals:\n{sig_summary or '(空)'}\n\n"
        f"文件树 (前100行):\n{tree_preview[:3000]}\n\n"
        "Return mermaid DSL only:"
    )


# ═══════════════════════════════════════════
# 3. AI 润色
# ═══════════════════════════════════════════

POLISH_SYSTEM = """你是简历润色专家。根据指令修改简历文本。

规则：
1. polish: 保持原意，优化措辞使其更专业。被动改主动，模糊改具体。
2. expand: 扩展细节，增加技术深度，字数增加30-50%。
3. shorten: 精简到核心要点，删除冗余，字数减少30-50%。
4. 不要编造用户未提及的技术或经验。
5. 输出只包含修改后的文本。"""


def polish_prompt(text: str, style: str) -> tuple[str, str]:
    style_labels = {"polish": "润色（优化表达）", "expand": "扩写（增加深度）", "shorten": "精简（删除冗余）"}
    return (
        POLISH_SYSTEM,
        f"操作: {style_labels.get(style, style)}\n原文: \"{text}\"\n\n修改后文本:",
    )


# ═══════════════════════════════════════════
# 4. 对齐问题生成
# ═══════════════════════════════════════════

ALIGNMENT_SYSTEM = """你是技术面试辅导专家。基于项目审计报告，生成5道情景化选择题，
帮助候选人将项目经验转化为STAR格式的面试证据。

规则：
1. 每道题3个选项(A/B/C)，有区分度
2. 覆盖5个维度：业务问题、个人角色、技术挑战、量化成果、改进反思
3. 如果项目有具体 signals，优先围绕 signals 出题
4. JSON数组格式返回：{"id","text","options":[{"id","text"}]}"""


def alignment_questions_prompt(project_name: str, signals: dict, tech_stack: list[str]) -> str:
    sig_keys = [k for k, v in signals.items() if v]
    return (
        f"{ALIGNMENT_SYSTEM}\n\n"
        f"项目: {project_name}\n"
        f"技术信号: {', '.join(sig_keys) if sig_keys else '通用'}\n"
        f"技术栈: {', '.join(tech_stack[:5])}\n\n"
        "Return JSON array of 5 questions:"
    )


# ═══════════════════════════════════════════
# 5. 面试锦囊
# ═══════════════════════════════════════════

INTERVIEW_TIP_SYSTEM = """你是面试教练。基于JD和项目信息，给出一条具体的面试准备建议。

规则：
- 只输出一条建议（2-3句话）
- 具体到"面试官可能问XX，准备好YY"
- 语气温暖鼓励，像教练而非考官"""


def interview_tip_prompt(role_type: str, tech_stack: list[str], project_name: str, score: float, gaps: list[str]) -> str:
    return (
        f"{INTERVIEW_TIP_SYSTEM}\n\n"
        f"岗位: {role_type}, 技术栈: {', '.join(tech_stack[:4])}\n"
        f"项目: {project_name}, 匹配度: {int(score*100)}%\n"
        f"缺口: {', '.join(gaps) if gaps else '无'}\n\n"
        "面试锦囊:"
    )
```

- [ ] **Step 2: 写测试**

```python
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
```

- [ ] **Step 3: 运行测试**

```bash
cd services/fastapi
python -m pytest tests/test_prompts.py -v
```

Expected: 5/5 PASS。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(llm): implement 5 prompt templates with tests

- JD parse: structured extraction with weight/category rules
- Mermaid DSL: signal-driven architecture diagram generation
- AI polish: polish/expand/shorten with style-specific instructions
- Alignment questions: 5-dimension coverage from project signals
- Interview tip: personalized coaching advice
- Model configurable via LLM_MODEL env var

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 54: Phase 13 集成验证

**Files:** 无新文件。

- [ ] **Step 1: Docker build 验证**

```bash
cd services/fastapi
docker build -t resume-ci-api .
docker run -p 8000:8000 resume-ci-api
curl http://localhost:8000/health
```

Expected: `{"status":"ok","cli_health":{...}}`。

- [ ] **Step 2: 全量 Python 测试**

```bash
cd services/fastapi
python -m pytest tests/ -v
```

Expected: 全部 PASS（含 database + prompts + pipeline + cli_bridge）。

- [ ] **Step 3: 全量 Monorepo typecheck + test**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck
pnpm turbo run test
```

Expected: 全部 PASS。

- [ ] **Step 4: E2E 测试**

```bash
pnpm test:e2e
```

Expected: 8/8 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: Phase 13 integration — Docker, DB, prompts, E2E all verified

- Docker build successful with all 3 CLIs
- SQLite CRUD tests passing
- 5 prompt templates tested
- 8 Playwright E2E specs passing
- Typecheck + unit tests green across monorepo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

Phase 13 计划已存入 `docs/superpowers/plans/2026-06-01-resume-ci-phase13.md`。

### 全部计划文件索引

| 文件 | 内容 | 任务数 |
|------|------|--------|
| `2026-05-31-resume-ci-phase1-3.md` | Monorepo + Core + UI骨架 | 1-6 |
| `2026-05-31-resume-ci-phase4-5.md` | WizardShell + FastAPI | 7-12 |
| `2026-05-31-resume-ci-phase6-8.md` | Web/Desktop壳 + CI/CD | 13-18 |
| `2026-06-01-resume-ci-phase9.md` | Anchor + Blueprint UI | 19-26 |
| `2026-06-01-resume-ci-phase10.md` | Alignment + Polish UI | 27-34 |
| `2026-06-01-resume-ci-phase11.md` | Export + 收尾 | 35-41 |
| `2026-06-01-resume-ci-phase12.md` | CLI 全链路集成 | 42-48 |
| `2026-06-01-resume-ci-phase13.md` | 生产就绪 | 49-54 |
