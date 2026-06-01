# services/fastapi/app/services/github_search.py
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


async def github_search_repos(jd_keywords: list[str], jd_techstack: list[str], limit: int = 10) -> list[dict[str, Any]]:
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
                params={"q": query, "sort": "stars", "order": "desc", "per_page": limit},
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
                    "runnable": True,
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
    fallbacks = [
        {
            "name": "golang/go", "repo_url": "https://github.com/golang/go",
            "license": "BSD-3-Clause", "stars": 120000, "last_commit": "2026-05-28",
            "tags": ["go", "compiler", "stdlib"], "jd_keywords": [], "matched_jd_terms": [],
            "runnable": True, "compute": "local_docker",
            "mod_ideas": ["add custom linter", "optimize compiler pass"],
            "risk_notes": ["代码库极大，需聚焦子模块"],
        },
        {
            "name": "gin-gonic/gin", "repo_url": "https://github.com/gin-gonic/gin",
            "license": "MIT", "stars": 78000, "last_commit": "2026-05-20",
            "tags": ["go", "web", "http", "middleware"], "jd_keywords": [], "matched_jd_terms": [],
            "runnable": True, "compute": "local_docker",
            "mod_ideas": ["add JWT middleware", "add Redis session store"],
            "risk_notes": [],
        },
        {
            "name": "redis/go-redis", "repo_url": "https://github.com/redis/go-redis",
            "license": "BSD-2-Clause", "stars": 20000, "last_commit": "2026-05-25",
            "tags": ["go", "redis", "client"], "jd_keywords": [], "matched_jd_terms": [],
            "runnable": True, "compute": "local_docker",
            "mod_ideas": ["add cluster support", "add circuit breaker"],
            "risk_notes": [],
        },
    ]
    return fallbacks[:3]
