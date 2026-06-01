# services/fastapi/app/services/prompts.py
"""LLM Prompt 模板 — 通过环境变量切换模型"""

import os
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
