# services/fastapi/app/services/pipeline.py
"""封装 3 个 Python CLI 的调用。当前为 skeleton，后续 Task 填充真实 CLI 调用。"""


class PipelineService:
    """封装 3 个 Python CLI 的调用。当前为 skeleton，后续 Task 填充真实 CLI 调用。"""

    async def jd_parse(self, raw: str) -> dict:
        """解析 JD 文本 → 结构化返回"""
        return {
            "keywords": [
                {"word": "React", "weight": 0.9},
                {"word": "TypeScript", "weight": 0.85},
            ],
            "techStack": ["React", "TypeScript", "Node.js"],
            "roleType": "frontend",
            "matchProfile": {"score": 0.88, "gaps": []},
        }

    async def project_discover(self, jd: dict) -> dict:
        """TODO: 调用 shushu-candidate-score CLI"""
        return {"cards": []}

    async def resume_get(self) -> dict:
        """TODO: 返回当前简历 HTML"""
        return {"html": ""}

    async def resume_polish(self, text: str, style: str) -> str:
        """TODO: 调用 LLM 润色"""
        return f"[润色] {text}"

    async def export_pdf(self) -> dict:
        """TODO: 调用 vibe-resume 导出"""
        return {"url": ""}
