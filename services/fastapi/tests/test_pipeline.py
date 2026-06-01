# services/fastapi/tests/test_pipeline.py
import pytest
from app.services.pipeline import PipelineService


@pytest.mark.asyncio
async def test_jd_parse_returns_structured_data():
    service = PipelineService()
    result = await service.jd_parse("需要熟悉 React")
    assert "keywords" in result
    assert "techStack" in result
    assert result["roleType"] == "frontend"
