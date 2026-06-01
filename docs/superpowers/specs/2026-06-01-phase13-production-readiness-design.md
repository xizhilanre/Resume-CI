# Resume CI — Phase 13 生产就绪设计

> 状态：设计完成
> 日期：2026-06-01
> 范围：FastAPI 部署 + 数据持久化 + Desktop 运行时打包 + E2E 测试 + LLM Prompt 设计

---

## 一、FastAPI 部署方案

### 1.1 选型

**Docker 单容器 + Fly.io**（不是 Vercel，Vercel 是纯前端平台）。

理由：
- Fly.io 支持 Docker 部署，有免费额度，全球边缘节点
- 单容器够 MVP 用，Phase 9-12 依赖的三个 CLI 可以打进镜像
- 比 Railway/Render 更便宜，比自建 K8s 简单 100 倍

### 1.2 Dockerfile

```dockerfile
# services/fastapi/Dockerfile
FROM python:3.12-slim

# 系统依赖：git (clone repos), chromium (vibe-resume PDF)
RUN apt-get update && apt-get install -y \
    git nodejs npm chromium \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码
COPY app/ ./app/

# 三个上游 CLI（构建时打入镜像）
COPY scripts/shushu-internship-tool/ /app/scripts/shushu-internship-tool/
COPY scripts/shushu-internship-resume-optimizer/ /app/scripts/shushu-internship-resume-optimizer/
COPY scripts/vibe-resume/ /app/scripts/vibe-resume/

# 安装 Python CLI
RUN pip install -e /app/scripts/shushu-internship-tool \
    && pip install -e /app/scripts/shushu-internship-resume-optimizer

# 安装 vibe-resume 的 Node 依赖
RUN cd /app/scripts/vibe-resume && npm install

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 1.3 CI 集成

在 GitHub Actions 的 `ci.yml` 中追加 Job 5：

```yaml
deploy-fastapi:
  needs: [quality]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    - uses: superfly/flyctl-actions/setup-flyctl@master
    - run: |
        cd services/fastapi
        flyctl deploy --remote-only
      env:
        FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### 1.4 Desktop 端不需要部署

Desktop 端的 FastAPI 跑在 Electron Main Process 的 Python 子进程里（localhost:18920），不涉及云部署。

---

## 二、数据持久化

### 2.1 选型

**SQLite**（单文件，零配置，可嵌入 Desktop 端）。

理由：
- MVP 阶段用户量小，SQLite 完全够用
- Desktop 端天然需要本地存储，SQLite 是最优解（Electron 内嵌）
- Web 端用同一个 schema，未来可迁移到 PostgreSQL
- 通过 aiosqlite 保持异步

### 2.2 Schema

```sql
-- 用户
CREATE TABLE users (
    id TEXT PRIMARY KEY,            -- GitHub user ID
    login TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 简历会话（一个用户可以有多个简历版本）
CREATE TABLE resume_sessions (
    id TEXT PRIMARY KEY,            -- UUID
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT,                      -- 简历名称（如"后端实习-2026春招"）
    jd_raw TEXT,                    -- 原始JD文本
    jd_parsed TEXT,                 -- JDParsed JSON
    project_id TEXT,                -- 选中的项目ID
    resume_html TEXT,               -- 当前简历HTML
    page_fit_status TEXT,           -- PageFitStatus JSON
    wizard_step TEXT NOT NULL DEFAULT 'anchor',  -- 当前步骤
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 项目审计结果（跨会话共享，同一repo只审计一次）
CREATE TABLE project_audits (
    id TEXT PRIMARY KEY,            -- repo full_name
    repo_url TEXT NOT NULL,
    audit_json TEXT NOT NULL,       -- audit.json 内容
    candidate_score_json TEXT,      -- candidate_score.json
    architecture_dsl TEXT,          -- Mermaid DSL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 对齐会话
CREATE TABLE alignment_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES resume_sessions(id),
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    star_bullet_json TEXT,          -- STARBullet JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 简历编辑历史（支持 undo）
CREATE TABLE edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES resume_sessions(id),
    section TEXT NOT NULL,
    old_content TEXT,
    new_content TEXT NOT NULL,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 实现策略

- **Web 端**：SQLite 文件存在 Docker volume `/data/resume-ci.db`，Fly.io 提供 1GB 免费 volume
- **Desktop 端**：SQLite 文件存在 `%LOCALAPPDATA%/ResumeCI/data/resume-ci.db`
- 数据层通过 `IDatabase` 接口抽象，两端注入不同路径

```python
# services/fastapi/app/services/database.py
import aiosqlite
from pathlib import Path
from typing import Optional

class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path

    async def init(self):
        """建表 + 迁移"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(SCHEMA_SQL)
            await db.commit()

    async def save_session(self, session: dict): ...
    async def load_session(self, session_id: str) -> Optional[dict]: ...
    async def save_audit(self, repo_name: str, audit: dict): ...
    async def load_audit(self, repo_name: str) -> Optional[dict]: ...
    async def save_alignment_answer(self, answer: dict): ...
    async def push_edit_history(self, session_id: str, section: str, old: str, new: str): ...
```

---

## 三、Desktop Python 运行时打包

### 3.1 实现

```bash
# apps/desktop/scripts/build-python-runtime.sh
#!/bin/bash
set -e

RUNTIME_DIR="python-runtime"
PYTHON_VERSION="3.12.8"
EMBED_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip"
PIP_URL="https://bootstrap.pypa.io/get-pip.py"

rm -rf "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR"

# 1. 下载 Python Embeddable
curl -L "$EMBED_URL" -o python-embed.zip
unzip python-embed.zip -d "$RUNTIME_DIR"

# 2. 启用 pip（修改 python*._pth 文件）
echo "import site" >> "$RUNTIME_DIR/python312._pth"

# 3. 安装 pip
curl -L "$PIP_URL" -o get-pip.py
"$RUNTIME_DIR/python.exe" get-pip.py --no-wheels

# 4. 安装依赖
"$RUNTIME_DIR/python.exe" -m pip install \
    --target "$RUNTIME_DIR/Lib/site-packages" \
    fastapi uvicorn pydantic openai anthropic gitpython httpx aiosqlite \
    -e "../../scripts/shushu-internship-tool" \
    -e "../../scripts/shushu-internship-resume-optimizer"

# 5. 复制三个上游CLI源码 + FastAPI代码
cp -r "../../scripts/shushu-internship-tool" "$RUNTIME_DIR/scripts/"
cp -r "../../scripts/shushu-internship-resume-optimizer" "$RUNTIME_DIR/scripts/"
cp -r "../../services/fastapi/app" "$RUNTIME_DIR/app/"

# 6. 打包
zip -r python-runtime.zip "$RUNTIME_DIR"
echo "✅ python-runtime.zip built ($(du -sh python-runtime.zip | cut -f1))"
```

### 3.2 CI 集成

在 `ci.yml` 的 `desktop` job 中，`Build Desktop` 之前增加：

```yaml
- name: Build Python Runtime
  shell: bash
  run: bash apps/desktop/scripts/build-python-runtime.sh
- name: Copy runtime to Electron resources
  run: cp python-runtime.zip apps/desktop/resources/
```

### 3.3 Desktop 启动时序

```
用户双击 Resume CI.exe
  → ensurePythonRuntime()
    → 检查 %LOCALAPPDATA%\ResumeCI\python\python.exe 存在？
      → NO → 从 resources\python-runtime.zip 解压（~5-10s，一次性）
      → YES → 跳过
  → PythonExecutor.start()
    → spawn python.exe -m uvicorn app.main:app --port 18920
    → stdout 等待 "Uvicorn running"（~2-3s）
  → WindowManager.createMainWindow() → 渲染 UI
  → LocalAdapter 连接 ws://localhost:18920/ws
```

---

## 四、E2E 测试

### 4.1 测试范围

8 条关键用户路径，覆盖所有 5 个步骤：

| # | 路径 | 验证点 |
|---|------|--------|
| 1 | 粘贴 JD → 看到解析结果 | 关键词云可见，雷达图渲染 |
| 2 | 关键词云 → 下一步 → 项目蓝图 | 3 张骨架屏 → 卡片逐个亮起 |
| 3 | 选中项目 → 架构图渲染 | Mermaid SVG 可见，pan-zoom 可用 |
| 4 | 闪卡翻转 | 点击翻转 → 背面内容可见 → 翻回 |
| 5 | 完整对齐流程 | 5 道题逐个作答 → STAR 证据链更新 |
| 6 | 简历编辑 | 双击段落 → 编辑 → Enter 确认 → 文本更新 |
| 7 | AI 润色 | 划选文字 → 悬浮条 → 点润色 → 流式替换 |
| 8 | 导出 PDF | 4 阶段动画 → 下载按钮出现 |

### 4.2 实现

```typescript
// tests/e2e/specs/happy-path.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Resume CI — Full User Journey', () => {

  test('Step ①: JD input → parse → keyword cloud + radar', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // 粘贴 JD
    const textarea = page.getByTestId('jd-textarea');
    await textarea.fill(mockJD);

    // 点击解析
    await page.getByTestId('parse-btn').click();

    // 等待关键词云出现
    await expect(page.getByTestId('keyword-cloud')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('kw-tag').first()).toBeVisible();

    // 雷达图渲染
    await expect(page.getByTestId('radar-chart')).toBeVisible();
  });

  test('Step ②: project cards stream in with skeleton', async ({ page }) => {
    // 前置：已解析 JD
    await page.goto('http://localhost:3000/?step=blueprint');

    // 骨架屏先出现
    await expect(page.getByTestId('skeleton')).toHaveCount(3);

    // 第一张卡片到达（最多等 30s，真实 CLI 耗时长）
    await expect(page.getByTestId('card').first()).toBeVisible({ timeout: 30000 });

    // 点击第一张卡片选中
    await page.getByTestId('card').first().click();

    // 架构图渲染
    await expect(page.getByTestId('mermaid-container')).toBeVisible({ timeout: 10000 });
  });

  test('Step ③: alignment Q&A flow', async ({ page }) => {
    // 5 道题完整作答
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByTestId('question-flow')).toBeVisible();
      // 选第一个选项
      await page.locator('[data-testid="question-flow"] button').first().click();
      await page.getByTestId('submit-answer').click();
      // 等待 STAR 证据出现
      await expect(page.getByTestId('star-bullet').nth(i - 1)).toBeVisible({ timeout: 10000 });
    }
  });

  test('Step ④: resume editing with contentEditable', async ({ page }) => {
    // 双击段落进入编辑
    const paragraph = page.locator('[data-section]:first-child');
    await paragraph.dblclick();
    await page.keyboard.type(' 新增内容');
    await page.keyboard.press('Enter');

    // 确认更新
    await expect(paragraph).toContainText('新增内容');
  });

  test('Step ④: AI polish via selection floating bar', async ({ page }) => {
    // 划选文字
    const paragraph = page.locator('[data-section]').first();
    await paragraph.selectText();

    // 悬浮条出现
    await expect(page.getByTestId('floating-bar')).toBeVisible();

    // 点击润色
    await page.getByText('润色').click();
    // 流式替换（等待内容变化）
    await expect(paragraph).not.toHaveText(/* 原文本 */);
  });

  test('Step ⑤: export PDF pipeline', async ({ page }) => {
    await page.goto('http://localhost:3000/?step=export');

    // 4 阶段节点可见
    await expect(page.getByText('排版对齐')).toBeVisible();
    await expect(page.getByText('生成PDF')).toBeVisible();

    // 等待完成
    await expect(page.getByText('导出完成')).toBeVisible({ timeout: 60000 });

    // 下载按钮可见
    await expect(page.getByText('下载 PDF')).toBeVisible();
  });
});
```

### 4.3 CI 集成

```yaml
# ci.yml 中追加 E2E job
e2e:
  needs: [quality, web, deploy-fastapi]
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: pnpm install
    - run: pnpm exec playwright install --with-deps chromium
    - name: Start services
      run: |
        pnpm dev:web &
        cd services/fastapi && uvicorn app.main:app --host 0.0.0.0 --port 8000 &
        sleep 10  # 等待服务就绪
    - name: Run E2E tests
      run: pnpm exec playwright test tests/e2e/
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-traces
        path: test-results/
```

---

## 五、LLM Prompt 设计

### 5.1 JD 解析 Prompt

```
System:
你是一个专业的职位描述(JD)分析师。从用户提供的JD文本中提取结构化信息。
严格按JSON格式返回，不要添加额外说明。

规则：
1. keywords: 从JD中提取关键技术词，每个词赋予0-1权重
   - weight > 0.8: JD明确要求且反复出现
   - weight 0.5-0.8: JD提及一次
   - weight < 0.5: 加分项/软性要求
   - category: language|architecture|middleware|devops|concept
2. techStack: 具体的技术/工具名称列表
3. roleType: 后端|前端|算法|全栈|移动端|测试|数据|DevOps|安全|系统
4. matchProfile.score: 根据JD要求综合评估0-1
   - 注意：JD是从雇主视角写的，score评估的是"典型候选人匹配度"
5. matchProfile.gaps: 候选人可能缺失的关键技能/经验

User:
{raw_jd_text}

Return ONLY valid JSON:
{"keywords":[{"word":"Go","weight":0.95,"category":"language"},...],"techStack":["Go","Redis",...],"roleType":"后端","matchProfile":{"score":0.87,"gaps":["消息队列实战经验"]}}
```

### 5.2 Mermaid DSL 生成 Prompt

```
System:
你是一个软件架构分析师。根据项目文件结构信号，生成一个Mermaid架构图DSL。

规则：
- 使用 graph TD 格式
- 节点命名用清晰的英文标签
- 只包含能从 signals 中推断出的组件，不要编造
- 最多10个节点
- 节点形状规则：API类用圆角矩形，数据库用圆柱形[(name)]，前端用方框

signals 含义：
- api_backend: 后端API路由/控制器
- database_state: 数据库模型/迁移/存储
- frontend_mobile: 前端/移动端代码
- async_jobs: 异步任务/消息队列
- devops_deploy: Docker/K8s/CI配置
- model: 机器学习模型
- training: 训练代码
- security_auth: 认证/授权代码
- testing_quality: 测试代码
- config: 配置文件

User:
项目 signals:
{signals_summary}

项目文件树（前100行）:
{tree_preview}

Return ONLY the Mermaid DSL, no markdown code block:
```

### 5.3 AI 润色 Prompt

```
System:
你是简历润色专家。根据用户的指令修改简历文本。

规则：
1. polish: 保持原意，优化措辞，使其更专业、更有影响力。把被动语态改主动，把模糊描述改具体。
2. expand: 在原内容基础上扩展细节，增加技术深度和专业术语，字数增加30-50%。
3. shorten: 精简到核心要点，删除冗余修饰词，保持信息的完整性，字数减少30-50%。
4. 不要编造用户没有提到的技术或经验。
5. 输出只包含修改后的文本，不要解释。

User:
操作: {style}  # "polish" | "expand" | "shorten"
原文: "{selected_text}"

Return the modified text only:
```

### 5.4 对齐问题生成 Prompt

```
System:
你是技术面试辅导专家。基于项目的审计报告，生成5道精心设计的情景化选择题，
帮助候选人将项目经验转化为STAR格式的面试证据。

规则：
1. 每道题3个选项(A/B/C)，必须有区分度
2. 问题应覆盖: 业务问题、个人角色、技术挑战、量化成果、改进反思
3. 选项引导候选人深入思考，而不是简单选"是/否"
4. 如果项目有具体的 signals，优先围绕 signals 出题
5. 返回 JSON 数组格式

User:
项目名称: {project_name}
项目信号: {signals_summary}
文件数: {file_count}
技术栈: {tech_stack}

Return ONLY a JSON array of 5 questions:
[
  {
    "id": "q1",
    "text": "这个项目解决了什么核心问题？",
    "options": [
      {"id": "a", "text": "高并发场景下的性能瓶颈"},
      {"id": "b", "text": "复杂业务逻辑的工程化实现"},
      {"id": "c", "text": "数据一致性/可靠性问题"}
    ]
  },
  ...
]
```

### 5.5 面试锦囊生成 Prompt

```
System:
你是面试教练。基于JD和项目匹配信息，给出一条具体的、可操作的面试准备建议。

规则：
- 只输出一条建议（2-3句话），不要列表
- 建议要具体到"面试官可能会问XX，你应该准备好YY"
- 语气温暖鼓励，像教练而不是考官

User:
目标岗位: {role_type}, 技术栈: {tech_stack}
项目: {project_name}, 匹配分数: {score}%
JD 缺口: {gaps}

面试锦囊:
```

---

## 六、Task 拆分

| # | Task | 内容 | 复杂度 |
|---|------|------|--------|
| **49** | FastAPI Docker 化 + Fly.io 部署 | Dockerfile, fly.toml, CI deploy job | 中 |
| **50** | SQLite 持久化层 | Database 类, schema, session/audit CRUD | 中 |
| **51** | Desktop Python 运行时打包 | build-python-runtime.sh, CI 集成, Electron 启动时序 | 大 |
| **52** | E2E 测试 | 8 条 Playwright spec, CI e2e job, test fixtures | 中 |
| **53** | LLM Prompt 模板 | 5 组 prompt, 模板渲染函数, 响应解析 | 小 |
| **54** | Phase 13 集成验证 | Docker build, E2E pass, Desktop 端到端验证 | 小 |
