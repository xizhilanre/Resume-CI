# services/fastapi/app/main.py
import os
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.ws import router as ws_router
from app.services.cli_bridge import CLIBridge
from app.services.database import Database
from app.services.pipeline import PipelineService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Resume CI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://resume-ci.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router, prefix="/ws")

# ─── Startup ───

@app.on_event("startup")
async def startup():
    # Database
    db_path = Path(os.environ.get("DB_PATH", "data/resume-ci.db"))
    app.state.db = Database(db_path)
    await app.state.db.init()

    # CLIBridge
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    scripts_dir = repo_root / "scripts"
    workspace = Path(os.environ.get("WORKSPACE_DIR", "data/workspace"))
    workspace.mkdir(parents=True, exist_ok=True)

    app.state.bridge = CLIBridge(
        workspace=workspace,
        tool_dir=scripts_dir / "shushu-internship-tool",
        optimizer_dir=scripts_dir / "shushu-internship-resume-optimizer",
        vibe_resume_dir=scripts_dir / "vibe-resume",
        chrome_path=os.environ.get("CHROME_PATH", ""),
    )

    # Health check (non-blocking)
    health = await app.state.bridge.health_check()
    failed = [k for k, v in health.items() if not v]
    if failed:
        logger.warning(f"Some CLI tools unavailable: {failed}")
    logger.info(f"CLI Health: {health}")

    # Pipeline
    app.state.pipeline = PipelineService(bridge=app.state.bridge, db=app.state.db)

    logger.info("Resume CI API ready")


@app.get("/health")
async def health():
    bridge = getattr(app.state, "bridge", None)
    cli_health = await bridge.health_check() if bridge else {}
    return {"status": "ok", "cli_health": cli_health}
