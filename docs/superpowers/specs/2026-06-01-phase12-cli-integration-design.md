# Resume CI — Phase 12 真实 CLI 全链路集成设计

> 状态：设计完成，待审阅
> 日期：2026-06-01
> 范围：三个上游 CLI 项目的统一集成层，端到端数据流打通

---

## 一、设计动机

### 1.1 当前状态

Phase 1-11 覆盖了所有 UI 组件和后端管线骨架，但 PipelineService 中的 CLI 调用全是注释掉的硬编码假数据。三个上游项目各自独立可运行，但之间存在格式断裂：

| # | 断裂点 | 后果 |
|---|--------|------|
| 1 | `audit.json` ≠ `achievement_audit.json` | 项目审计结果无法喂给简历优化器 |
| 2 | `candidate_score` 需要 `candidates.json` | 没人生成这个 JSON |
| 3 | `resume_rank` 需要 `achievements` | 对齐问答产生的 STAR bullet 格式不匹配 |
| 4 | `export-pdf.mjs` 硬编码读 `index.html` | ResumeCanvas 编辑后的 HTML 要写回文件 |

### 1.2 三个上游项目

| 项目 | 语言 | CLI 命令 | 核心能力 |
|------|------|---------|---------|
| **shushu-internship-tool** | Python 3.10+ | `shushu-repo-audit`, `shushu-candidate-score`, `shushu-interview-pack` | 仓库审计、候选评分、面试材料 |
| **shushu-internship-resume-optimizer** | Python 3.10+ | `shushu-achievement-audit`, `shushu-resume-rank`, `shushu-interview-pack`, `shushu-doc-knowledge` | 成就提取、简历排名、知识检索 |
| **vibe-resume** | Node.js | `node scripts/export-pdf.mjs` | HTML → 单页 PDF（Playwright + Chromium） |

---

## 二、核心架构：CLIBridge

### 2.1 职责

`CLIBridge` 是 FastAPI PipelineService 中的统一子进程调用层，负责：

1. **参数转换**：将 `IResumeCIAdapter` 接口参数映射为 CLI arguments
2. **子进程管理**：asyncio subprocess 调用，超时控制，cancel 联动
3. **输出解析**：CLI 输出文件 → 统一数据模型（`ProjectCard`, `STARBullet` 等）
4. **中间产物搬运**：CLI A 的输出 JSON → 转换 → CLI B 的输入 JSON

### 2.2 接口

```python
class CLIBridge:
    workspace: Path          # 工作目录（按 task_id 隔离）
    tool_dir: Path           # shushu-internship-tool 根目录
    optimizer_dir: Path      # shushu-internship-resume-optimizer 根目录
    vibe_resume_dir: Path    # vibe-resume 根目录
    chrome_path: str         # Chromium 二进制路径

    # 底层调用
    async def _run_python_cli(module, args, cwd, timeout) -> (int, str, str)
    async def _run_node_script(script, args, cwd, env, timeout) -> (int, str, str)

    # 业务方法
    async def github_search(jd: JDParsed) -> list[dict]
    async def candidate_score(jd_file, candidates_file, out_dir) -> list[dict]
    async def repo_audit(repo_path, name, out_dir) -> dict
    async def achievement_audit(sources_file, out_dir) -> dict
    async def resume_rank(jd_file, achievements_file, target_role, out_dir) -> dict
    async def interview_pack(project_notes_file, target_role, out_dir) -> dict
    async def export_pdf(html_content, output_path) -> tuple[int, str]
    async def cancel(task_id)
```

### 2.3 统一调用模式

```
调用模式（适用于所有 Python CLI）:
  async def _run_python_cli(module, args, cwd, timeout):
      proc = await asyncio.create_subprocess_exec(
          sys.executable, "-m", f"shushu_internship_tool.{module}",
          *args,
          cwd=cwd, stdout=PIPE, stderr=PIPE
      )
      active_procs[task_id] = proc
      try:
          stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout)
          return proc.returncode, stdout.decode(), stderr.decode()
      except asyncio.TimeoutError:
          proc.kill()
          raise CLITimeoutError(module, timeout)

取消联动:
  async def cancel(task_id):
      proc = active_procs.pop(task_id, None)
      if proc:
          proc.terminate()
          try: await asyncio.wait_for(proc.wait(), 3)
          except: proc.kill()
      # 清理 workspace/task_id/
      shutil.rmtree(workspace / task_id, ignore_errors=True)
```

---

## 三、端到端数据流

### 3.1 Step ① Anchor → JD 解析

```
用户粘贴 JD 文本
  → adapter.parseJD(raw)
    → PipelineService.jd_parse(raw)
      → LLM (DeepSeek/GPT) 结构化提取
    ← 一次性返回 JDParsed
```
不做 CLI 调用 — JD 解析最适合用 LLM，CLI 工具没有这个能力。

### 3.2 Step ② Blueprint → 项目发现与审计

```
adapter.discoverProjects(jd)
  → PipelineService.discover(jd)
    ├─ t=0-3s:  CLIBridge.github_search(jd)
    │    → GitHub Search API (q=techStack+keywords)
    │    → 返回 top 10 repos → 生成 candidates.json
    │
    ├─ t=3-10s: CLIBridge.candidate_score(jd, candidates)
    │    → subprocess: shushu-candidate-score --jd jd.txt --candidates candidates.json --out ws/
    │    → 解析 candidate_score.json → 取 top 5
    │
    └─ t=10-30s: for each of top 3 repos (逐个流式 yield):
         ├─ git clone --depth=1 <repo_url> ws/_cache/<repo_name>
         ├─ CLIBridge.repo_audit(ws/_cache/<repo_name>, repo_name, ws/)
         │    → subprocess: shushu-repo-audit --repo <path> --out ws/ --name <name>
         │    → 解析 audit.json:
         │      ├─ signals → techStack hints
         │      ├─ tree    → 喂给 LLM 生成 Mermaid DSL
         │      └─ readme_samples + dependency_files → FlashCardData
         └─ yield ProjectCard
```

**类型映射**：`candidate_score.json + audit.json → ProjectCard`

```python
def _to_project_card(candidate: dict, audit: dict | None) -> ProjectCard:
    return ProjectCard(
        id=candidate.get("name", ""),
        title=candidate.get("name", ""),
        description=_extract_description(audit),
        techStack=candidate.get("tags", []),
        jdMatchScore=candidate.get("score", 0) / 100,
        architecture=_signals_to_mermaid(audit),    # LLM 辅助
        challenges=_signals_to_flashcards(audit),    # 确定性规则
    )
```

### 3.3 Step ③ Alignment → 证据对齐

```
adapter.generateAlignmentQuestions(projectId)
  → 从缓存读取 audit.json 的 signals 和 gaps
  → 结合 LLM 生成 5 道情景化选择题
  → SSE 逐题返回 AlignmentQuestion

adapter.submitAlignmentAnswer(questionId, answer)
  → 收集答案 → 所有 5 题答完后:
    → CLIBridge.achievement_audit(sources, out_dir)
      → sources.json 由用户答案 + audit.json 摘要构成
      → subprocess: shushu-achievement-audit --sources sources.json --out ws/
      → 解析 achievement_audit.json:
        achievements[] → STARBullet[] (每个 achievement → 一条 STAR)
    → SSE 逐条返回 STARBullet
```

**类型映射**：`achievement_audit.json → STARBullet[]`

```python
def _to_star_bullets(achievement_audit: dict) -> list[STARBullet]:
    bullets = []
    for ach in achievement_audit.get("achievements", []):
        bullets.append(STARBullet(
            id=ach.get("title", ""),
            situation=ach.get("background", ""),
            task=ach.get("task", ""),
            action="; ".join(ach.get("core_actions", [])),
            result=ach.get("best_metric", "") or ach.get("outcome", ""),
        ))
    return bullets
```

### 3.4 Step ④ Polish → 简历精修

```
adapter.getResumeHTML()
  → CLIBridge.resume_rank(jd_file, achievement_audit_file, target_role, out_dir)
    → subprocess: shushu-resume-rank --jd jd.txt --achievements achievement_audit.json --target-role <role> --out ws/
    → 解析 resume_rank.json:
      achievements[].resume_bullets[] → 简历 bullet 行
  → 组装 HTML:
    ┌─ read vibe-resume/index.html 作为模板
    ├─ 替换个人信息段
    ├─ 用 resume_bullets 填充「项目经验」段
    ├─ 用 STARBullet[] 填充「技术亮点」段
    └─ 写入 vibe-resume/index.html (原地修改)
  → 返回完整 HTML 给 ResumeCanvas 渲染

adapter.updateResumeSection(section, content)
  → 更新内存 HTML → 重新写入 vibe-resume/index.html
  → 返回

adapter.checkPageFit()
  → CLIBridge.export_pdf(html, dry_run=True)
    → 调 vibe-resume export-pdf.mjs，但不保存 PDF
    → 解析 stdout: "Rendered content size: WxHpx"
    → 计算: currentPages = H / (W * sqrt(2))  # A4 比例
    → 返回 { currentPages, status }
  → 缓存结果，编辑后 2s 防抖更新
```

### 3.5 Step ⑤ Export → 仪式导出

```
adapter.exportPDF()
  → SSE 流式推送四阶段进度:

  Stage 1 (0-25%): 排版对齐
    → yield { stage: "排版对齐", progress: 10 }
    → CLIBridge.resume_rank() 重新跑一轮确保最新
    → 重新组装 HTML → 写入 vibe-resume/index.html
    → yield { stage: "排版对齐", progress: 25 }

  Stage 2 (25-50%): 字体嵌入
    → yield { stage: "字体嵌入", progress: 30 }
    → 检查 HTML 中的字体引用（Google Fonts → 本地下载嵌入）
    → yield { stage: "字体嵌入", progress: 50 }

  Stage 3 (50-75%): ATS 校验
    → yield { stage: "ATS校验", progress: 55 }
    → CLIBridge.interview_pack(project_notes, target_role, out_dir)
      → subprocess: shushu-interview-pack --project-notes resume_rank.json --target-role <role> --out ws/
      → 解析 application_checklist.md 的投递建议
    → yield { stage: "ATS校验", progress: 75 }

  Stage 4 (75-100%): 生成 PDF
    → yield { stage: "生成PDF", progress: 80 }
    → CLIBridge.export_pdf(html, output_path)
      → subprocess: node scripts/export-pdf.mjs <output_path>
    → yield { stage: "生成PDF", progress: 100 }
    → done: { pdfUrl, interviewTip }
```

---

## 四、工程细节

### 4.1 工作目录结构

```
workspace/
├── _cache/                          # 跨请求共享
│   └── repos/                       # git clone 缓存
│       └── <owner>_<repo>/          # shallow clone
│
└── <task_id>/                       # 每个请求独立
    ├── jd.txt                       # JD 文本文件
    ├── candidates.json              # GitHub search 结果
    ├── candidate_score/             # 评分输出
    │   ├── candidate_score.json
    │   └── candidate_score.md
    ├── audit_<repo>/                # 每个候选 repo 的审计
    │   ├── audit.json
    │   ├── overview.md
    │   └── overview.html
    ├── sources.json                 # 对齐问答组装
    ├── achievement_audit/           # 成就审计输出
    │   └── achievement_audit.json
    ├── resume_rank/                 # 简历排名输出
    │   └── resume_rank.json
    ├── interview_pack/              # 面试材料
    │   └── application_checklist.md
    └── output.pdf                   # 最终 PDF
```

### 4.2 并发隔离

- 每个 `adapter` 方法调用生成一个 `task_id`
- 对应 `workspace/<task_id>/` 目录
- cancel 时删目录 + kill 子进程
- 并发请求通过 `task_id` 完全隔离

### 4.3 Git Clone 缓存策略

```
CLIBridge._clone_or_pull(repo_url):
  cache_key = owner_repo (from URL)
  cache_path = workspace/_cache/repos/<cache_key>

  if cache_path exists:
      git -C cache_path pull --depth=1   # 更新
  else:
      git clone --depth=1 --single-branch repo_url cache_path

  # 复制到 task 工作区（硬链接，节省磁盘）
  cp -rl cache_path workspace/<task_id>/repo
```

### 4.4 vibe-resume 集成策略

不改动 vibe-resume 的代码。而是：

```python
async def _run_vibe_resume_export(self, html_content: str, output_path: str, dry_run: bool = False):
    # 1. 写入 HTML 到 vibe-resume/index.html
    index_path = self.vibe_resume_dir / "index.html"
    backup = index_path.read_text() if index_path.exists() else ""
    index_path.write_text(html_content, encoding="utf-8")

    try:
        # 2. 调用 export-pdf.mjs
        env = os.environ.copy()
        env["CHROME_PATH"] = self.chrome_path

        proc = await asyncio.create_subprocess_exec(
            "node", str(self.vibe_resume_dir / "scripts" / "export-pdf.mjs"),
            output_path if not dry_run else "",
            cwd=self.vibe_resume_dir,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)

        # 3. 恢复原始 index.html
        if backup:
            index_path.write_text(backup, encoding="utf-8")

        return proc.returncode, stdout.decode(), stderr.decode()
    except Exception as e:
        if backup:
            index_path.write_text(backup, encoding="utf-8")
        raise
```

**Desktop 端特殊处理**：Electron 自带 Chromium，不需要用户安装 Chrome。在 Desktop 端，用 `process.env.CHROME_PATH` 指向 Electron 的 Chromium 路径。

### 4.5 LLM 辅助点

CLI 工具都是确定性规则引擎，不需要 LLM。但有两个地方 LLM 有价值：

| # | 位置 | LLM 做什么 | 为什么不用规则 |
|---|------|-----------|---------------|
| 1 | JD 解析 | 非结构化 JD → `JDParsed` | 只有 LLM 能做到 |
| 2 | `audit.signals + tree → Mermaid DSL` | 把文件分类信号转成架构图 | 架构推理需要理解业务语义 |

其他所有环节（评分、排名、成就提取、简历生成）直接使用 CLI 的确定性输出，不加 LLM。

### 4.6 错误处理矩阵

| 场景 | 处理 |
|------|------|
| CLI 未安装 | FastAPI 启动时 `health_check()` 预检所有 CLI，缺失则打 warning + 标记对应功能不可用 |
| CLI 超时 | `CLITimeoutError` → 120s 超时 → `proc.kill()` → 返回已收集的 partial result |
| CLI 返回非 0 | 解析 stderr → 分类（网络/权限/格式）→ 返回给前端，不 crash |
| git clone 失败 | 跳过该 repo → 继续下一个，日志记录 |
| GitHub API rate limit | 返回缓存的热门 repo 列表作为 fallback |
| Chromium 未找到 | Desktop: 用 Electron Chromium；Web: 检查系统路径，不可用则隐藏 PDF 预览 |
| 磁盘空间不足 | workspace 总大小 > 500MB → 清理 `_cache/repos/` 中最旧的 N 个 |

---

## 五、类型一致性

### 5.1 CLI 输出 → 核心类型的映射函数

| 来源 | 目标类型 | 映射函数 |
|------|---------|---------|
| `candidate_score.json` → | `ProjectCard` | `_to_project_card()` |
| `audit.json` → | `FlashCardData[]` | `_signals_to_flashcards()` |
| `audit.json` + LLM → | `string` (Mermaid DSL) | `_signals_to_mermaid()` |
| `achievement_audit.json` → | `STARBullet[]` | `_to_star_bullets()` |
| `resume_rank.json` → | HTML 字符串 | `_to_resume_html()` |
| `export-pdf stdout` → | `PageFitStatus` | `_parse_export_stdout()` |
| `application_checklist.md` → | `string` (面试锦囊) | `_extract_interview_tip()` |

### 5.2 数据模型版本

- `candidate_score.json` 的 schema 由 shushu-internship-tool 定义
- `achievement_audit.json` 的 schema 由 shushu-internship-resume-optimizer 定义
- 映射函数内部使用 `dict.get()` + 默认值，容忍 CLI 版本升级新增字段
- Schema codegen (Task 38) 生成的类型与 CLI 输出的解析结果一致

---

## 六、Task 拆分

| # | Task | 内容 | 复杂度 |
|---|------|------|--------|
| **42** | CLIBridge 底层框架 | `_run_python_cli`, `_run_node_script`, workspace 管理, cancel, health check | 大 |
| **43** | Blueprint 集成 | `github_search` → `candidate_score` → `repo_audit` → ProjectCard 流式 yield | 大 |
| **44** | Alignment 集成 | 答案收集 → `sources.json` 组装 → `achievement_audit` → STARBullet 映射 | 中 |
| **45** | Polish 集成 | `resume_rank` → HTML 组装/写回 → `checkPageFit` | 中 |
| **46** | Export 集成 | 四阶段流式 pipeline → `interview_pack` → vibe-resume `export-pdf.mjs` | 中 |
| **47** | 错误处理 + 端到端测试 | 超时/部分失败/cancel 测试 + 真实 CLI 集成测试 | 中 |
| **48** | Phase 12 集成验证 | 全链路 typecheck + test + 双端走通真实 CLI 数据 | 小 |

---

## 七、修正记录

### 修正 1：vibe-resume 不能传参的问题

**问题**：`export-pdf.mjs` 硬编码读取 `index.html`，不接受 HTML 内容参数。

**修正**：不修改 vibe-resume 源码。调用前将 HTML 写入 `vibe-resume/index.html`，调用后恢复原文件。用 try/finally 保证恢复。

### 修正 2：两个项目提供重叠的 CLI

**问题**：`shushu-internship-resume-optimizer` 也包含 `repo_audit`、`candidate_score`、`interview_pack`（alias），容易混淆。

**修正**：项目发现阶段用 `shushu-internship-tool` 的 CLI（专注 repo 分析）；简历优化阶段用 `shushu-internship-resume-optimizer` 的 CLI（专注 achievement/resume）。`interview_pack` 统一用 resume-optimizer 版本（版本 1.1.0 更新）。

### 修正 3：候选项目来源

**问题**：`candidate_score` 需要 `candidates.json`，但没人去生成这个文件。

**修正**：`CLIBridge.github_search()` 调用 GitHub Search API，将结果组装为 `candidates.json` 格式。API rate limit 超时则用预热好的静态候选列表 fallback。
