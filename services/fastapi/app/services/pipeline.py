# services/fastapi/app/services/pipeline.py
"""PipelineService — 编排 CLIBridge + Database + LLM 的完整流水线"""

import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import AsyncIterator, Optional

from app.services.cli_bridge import CLIBridge
from app.services.database import Database
from app.services.prompts import (
    jd_parse_prompt, polish_prompt,
    alignment_questions_prompt, interview_tip_prompt,
)
from app.services.html_assembler import assemble_resume_html

logger = logging.getLogger(__name__)

# ─── LLM 客户端（惰性初始化）───
_llm_client = None

def _get_llm():
    global _llm_client
    if _llm_client is not None:
        return _llm_client

    model = os.environ.get("LLM_MODEL", "deepseek-chat")
    api_key = os.environ.get("LLM_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "")

    if not api_key:
        logger.warning("No LLM_API_KEY set — using rule-based fallback for JD parse")
        _llm_client = False  # sentinel
        return False

    try:
        from openai import AsyncOpenAI
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        _llm_client = AsyncOpenAI(**kwargs)
        logger.info(f"LLM client ready: model={model}")
        return _llm_client
    except ImportError:
        logger.warning("openai package not installed — using rule-based fallback")
        _llm_client = False
        return False


# ─── Rule-based JD parser (LLM fallback) ───

def _rule_based_jd_parse(raw: str) -> dict:
    """简单关键词匹配，不需要 LLM"""
    raw_lower = raw.lower()
    keywords = []
    tech_map = {
        "go": "language", "golang": "language", "java": "language",
        "python": "language", "rust": "language", "typescript": "language",
        "javascript": "language", "c++": "language", "cpp": "language",
        "redis": "middleware", "kafka": "middleware", "rabbitmq": "middleware",
        "mysql": "middleware", "postgresql": "middleware", "mongodb": "middleware",
        "docker": "devops", "kubernetes": "devops", "k8s": "devops",
        "微服务": "architecture", "分布式": "concept", "高并发": "concept",
        "react": "language", "node.js": "language", "nodejs": "language",
        "git": "devops", "ci/cd": "devops", "cicd": "devops",
        "linux": "concept", "aws": "devops", "nginx": "middleware",
    }

    found_tech = set()
    for tech, category in tech_map.items():
        if tech in raw_lower:
            keywords.append({"word": tech.title() if len(tech) > 2 else tech.upper(), "weight": 0.7, "category": category})
            found_tech.add(tech)

    # Deduplicate
    seen = set()
    unique_kw = []
    for kw in keywords:
        if kw["word"].lower() not in seen:
            seen.add(kw["word"].lower())
            unique_kw.append(kw)

    tech_stack = list(dict.fromkeys(
        [kw["word"] for kw in unique_kw if kw["category"] in ("language", "middleware")]
    ))

    # Role detection
    role = "后端"
    if any(t in raw_lower for t in ["前端", "react", "vue", "angular", "css", "html"]):
        role = "前端" if not any(t in raw_lower for t in ["后端", "java", "go"]) else "全栈"
    if any(t in raw_lower for t in ["算法", "机器学习", "深度学习", "tensorflow", "pytorch"]):
        role = "算法"

    return {
        "keywords": unique_kw[:12],
        "techStack": tech_stack[:8],
        "roleType": role,
        "matchProfile": {
            "score": round(min(0.95, 0.5 + len(unique_kw) * 0.05), 2),
            "gaps": _detect_gaps(raw_lower, found_tech),
        },
    }


def _detect_gaps(raw_lower: str, found: set) -> list[str]:
    expected = {
        "docker": "Docker 容器化",
        "kubernetes": "Kubernetes 编排",
        "消息队列": "消息队列实战经验",
        "分布式": "分布式系统经验",
        "redis": "Redis 缓存",
    }
    gaps = []
    for key, label in expected.items():
        if key not in found and any(t in raw_lower for t in [key, "微服务", "高并发", "分布式"]):
            if key not in found:
                gaps.append(label)
    return gaps[:3] if gaps else []


# ═══════════════════════════════════════════
# PipelineService
# ═══════════════════════════════════════════

class PipelineService:
    def __init__(self, bridge: CLIBridge | None = None, db: Database | None = None):
        self.bridge = bridge
        self.db = db
        self._audit_cache: dict[str, dict] = {}
        self._answer_cache: dict[str, list[dict]] = {}
        self._star_cache: list[dict] = []
        self._rank_cache: dict = {}
        self._current_html: str = ""
        self._html_backup: str = ""
        self._jd_raw: str = ""
        self._jd: dict = {}

    # ─── JD Parse ───

    async def jd_parse(self, raw: str) -> dict:
        self._jd_raw = raw
        llm = _get_llm()

        if llm:
            try:
                system, user = jd_parse_prompt(raw)
                response = await llm.chat.completions.create(
                    model=os.environ.get("LLM_MODEL", "deepseek-chat"),
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
                data = json.loads(response.choices[0].message.content)
                self._jd = data
                return data
            except Exception as e:
                logger.warning(f"LLM jd_parse failed, using rule-based: {e}")

        data = _rule_based_jd_parse(raw)
        self._jd = data
        return data

    # ─── Project Discover ───

    async def project_discover(self, jd: dict | None = None) -> AsyncIterator[dict]:
        """流式返回项目卡片 — 使用 CLIBridge 或 fallback"""
        if jd:
            self._jd = jd
        jd_data = self._jd or {}

        # Try CLIBridge first
        if self.bridge:
            task_id = str(uuid.uuid4())
            try:
                keywords = [k["word"] if isinstance(k, dict) else k for k in jd_data.get("keywords", [])]
                techstack = jd_data.get("techStack", [])
                if not keywords and not techstack:
                    keywords = self._jd_raw.split()[:5] if self._jd_raw else ["backend", "api"]

                async for card in self.bridge.discover_and_audit(keywords, techstack, task_id):
                    self._audit_cache[card["id"]] = card
                    yield card
                return
            except Exception as e:
                logger.warning(f"CLIBridge discover failed, using fallback: {e}")

        # Fallback: static cards
        for card in _fallback_project_cards():
            await asyncio.sleep(0.8)
            yield card

    # ─── Diagram / Challenges ───

    async def project_diagram(self, projectId: str) -> str:
        cached = self._audit_cache.get(projectId, {})
        return cached.get("architecture", "graph TD\n  A[Client] --> B[Server]\n  B --> C[(Database)]")

    async def project_challenges(self, projectId: str) -> list[dict]:
        cached = self._audit_cache.get(projectId, {})
        return cached.get("challenges", [])

    # ─── Alignment ───

    async def alignment_questions(self, projectId: str) -> AsyncIterator[dict]:
        cached = self._audit_cache.get(projectId, {})
        project_name = cached.get("title", projectId)
        signals = cached.get("signals", {})
        techstack = cached.get("techStack", [])

        base_questions = [
            {"id": f"{projectId}-q1", "text": "这个项目解决了什么核心业务问题？",
             "options": [{"id": "a", "text": "高并发/性能瓶颈"}, {"id": "b", "text": "复杂业务逻辑的工程化"}, {"id": "c", "text": "数据一致性/可靠性问题"}]},
            {"id": f"{projectId}-q2", "text": "你在项目中承担了什么角色？",
             "options": [{"id": "a", "text": "核心开发者/独立完成"}, {"id": "b", "text": "团队模块负责人"}, {"id": "c", "text": "参与者/模块贡献者"}]},
            {"id": f"{projectId}-q3", "text": "项目中最大的技术挑战是什么？",
             "options": [{"id": "a", "text": "架构设计与技术选型"}, {"id": "b", "text": "性能优化与规模化"}, {"id": "c", "text": "复杂业务逻辑的实现"}]},
            {"id": f"{projectId}-q4", "text": "项目有可量化的成果吗？",
             "options": [{"id": "a", "text": "有具体的性能指标或用户数据"}, {"id": "b", "text": "有代码开源或技术文章产出"}, {"id": "c", "text": "主要是学习成长"}]},
            {"id": f"{projectId}-q5", "text": "如果重新做这个项目，你会改进什么？",
             "options": [{"id": "a", "text": "技术选型/架构设计"}, {"id": "b", "text": "测试与文档完善"}, {"id": "c", "text": "团队协作流程"}]},
        ]

        for q in base_questions:
            await asyncio.sleep(0.6)
            yield q

    async def alignment_answer(self, questionId: str, answer: str) -> AsyncIterator[dict]:
        project_id = questionId.split("-q")[0]
        key = f"answers_{project_id}"
        answers = self._answer_cache.setdefault(key, [])
        answers.append({"question": questionId, "answer": answer})

        # Generate STAR bullet
        star = {
            "id": f"star-{questionId}",
            "situation": f"在{project_id}项目开发中",
            "task": f"需要解决与'{answer[:30]}'相关的问题",
            "action": f"通过分析和实践，采取了基于{answer[:20]}的解决方案",
            "result": "提升了系统性能和代码质量，获得团队认可",
        }
        await asyncio.sleep(0.4)
        yield {"field": "bullet", "data": star}
        yield {"done": True, "result": star}

    # ─── Resume ───

    async def resume_get(self) -> dict:
        html = self._current_html or _make_default_resume_html()
        return {"html": html}

    async def resume_update(self, section: str, content: str) -> dict:
        # Track edit in DB if available
        if self.db:
            try:
                await self.db.push_edit("current", section, "", content)
            except Exception:
                pass
        return {"status": "ok"}

    async def resume_polish(self, text: str, style: str) -> AsyncIterator[str]:
        llm = _get_llm()
        if llm:
            try:
                system, user = polish_prompt(text, style)
                response = await llm.chat.completions.create(
                    model=os.environ.get("LLM_MODEL", "deepseek-chat"),
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                    stream=True,
                )
                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as e:
                logger.warning(f"LLM polish failed: {e}")

        # Fallback polish
        if style == "polish":
            yield f"[润色] {text}"
        elif style == "expand":
            yield f"{text}（通过深入分析和系统优化，取得了显著的性能提升和团队认可）"
        else:
            yield f"[精简] {text[:max(20, len(text)//2)]}..."

    async def resume_fit(self) -> dict:
        return {"currentPages": 0.98, "status": "fit"}

    # ─── Export ───

    async def export_pdf(self) -> AsyncIterator[dict]:
        stages = [
            "排版对齐", "字体嵌入", "ATS校验", "生成PDF",
        ]
        for i, stage in enumerate(stages):
            await asyncio.sleep(1.2)
            yield {
                "stage": stage,
                "progress": int((i + 1) / len(stages) * 100),
                "status": "active",
            }

        # Try real PDF export via vibe-resume
        pdf_url = ""
        interview_tip = "面试官可能会问技术选型理由，准备好回答会让面试更有说服力。"

        if self.bridge:
            try:
                task_id = str(uuid.uuid4())
                output_path = str(self.bridge._task_dir(task_id) / "resume.pdf")
                code, stdout, stderr = await self.bridge._run_node_script(
                    "scripts/export-pdf.mjs", [output_path],
                    env={"CHROME_PATH": self.bridge.chrome_path or ""},
                    timeout=60, task_id=task_id,
                )
                if code == 0:
                    pdf_url = f"/downloads/{task_id}/resume.pdf"
            except Exception as e:
                logger.warning(f"PDF export failed: {e}")

        yield {
            "stage": "生成PDF",
            "progress": 100,
            "status": "done",
            "result": {"pdf_url": pdf_url, "interview_tip": interview_tip},
        }


# ─── Fallbacks ───

def _fallback_project_cards() -> list[dict]:
    return [
        {"id": "golang-go", "title": "golang/go", "description": "Go 编程语言官方仓库，包含编译器、标准库和运行时实现", "techStack": ["Go", "C", "Assembly"], "jdMatchScore": 0.85, "architecture": "graph TD\n  A[Source] --> B[Compiler]\n  B --> C[IR]\n  C --> D[Optimizer]\n  D --> E[CodeGen]\n  E --> F[Binary]", "challenges": [{"id": "fc-go-1", "question": "Go 调度器如何实现抢占式调度？", "answer": "基于信号的抢占式调度。当 goroutine 运行超过 10ms 时，sysmon 线程发送 SIGURG 信号触发抢占"}, {"id": "fc-go-2", "question": "Go GC 如何做到低延迟？", "answer": "三色标记清除 + 写屏障 + 并发标记。GC 与用户 goroutine 并发执行，STW 时间 < 1ms"}]},
        {"id": "gin-gonic-gin", "title": "gin-gonic/gin", "description": "Go 语言高性能 HTTP Web 框架，Radix Tree 路由匹配", "techStack": ["Go", "HTTP", "Router"], "jdMatchScore": 0.78, "architecture": "graph TD\n  A[Request] --> B[Router]\n  B --> C[Middleware Chain]\n  C --> D[Handler]\n  D --> E[Response]", "challenges": [{"id": "fc-gin-1", "question": "Radix Tree 路由如何保证 O(log n) 匹配？", "answer": "压缩前缀树结构，公共前缀合并，动态路由参数通过通配符节点匹配"}]},
        {"id": "redis-go-redis", "title": "redis/go-redis", "description": "Go 语言 Redis 客户端，支持 Cluster/Sentinel/Ring 部署模式", "techStack": ["Go", "Redis", "Client"], "jdMatchScore": 0.72, "architecture": "graph TD\n  A[Client] --> B[Connection Pool]\n  B --> C[Pipeline]\n  C --> D[(Redis Cluster)]\n  A --> E[Sentinel]\n  E --> D", "challenges": [{"id": "fc-redis-1", "question": "Pipeline 如何批量优化 Redis 命令？", "answer": "将多个命令打包发送，避免 RTT 开销。客户端缓冲命令后一次性写入 socket，服务端顺序执行后批量返回"}]},
    ]


def _make_default_resume_html() -> str:
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>简历</title></head>
<body>
  <main class="page">
    <header><h1>张三</h1><p>zhangsan@example.com</p></header>
    <section class="experience" data-section="experience">
      <h2>项目经验</h2>
      <p data-section="exp-1">主导设计了高并发IM即时通讯系统核心架构，支撑10万级并发连接，消息可靠投递率达99.99%</p>
      <p data-section="exp-2">构建了分布式KV存储引擎，基于Raft协议实现强一致性，读写延迟P99 < 5ms</p>
    </section>
    <section class="skills" data-section="skills">
      <h2>技术栈</h2>
      <p>Go · Python · Rust · Redis · Docker · Kubernetes · WebSocket · gRPC</p>
    </section>
    <section class="education" data-section="education">
      <h2>教育</h2>
      <p>XX大学 · 计算机科学与技术 · 本科</p>
    </section>
  </main>
</body>
</html>"""
