# services/fastapi/app/routers/ws.py
import json
import asyncio
from fastapi import APIRouter, WebSocket
from app.services.pipeline import PipelineService

router = APIRouter()
pipeline = PipelineService()

# 活跃任务追踪（用于 cancel）
active_tasks: dict[str, asyncio.Task] = {}
active_procs: dict[str, asyncio.subprocess.Process] = {}


@router.websocket("/")
async def ws_handler(ws: WebSocket):
    await ws.accept()

    async for raw in ws.iter_text():
        msg = json.loads(raw)

        if msg.get("type") == "cancel":
            cmd_id = msg["id"]

            # cancel asyncio task
            task = active_tasks.pop(cmd_id, None)
            if task and not task.done():
                task.cancel()

            # kill subprocess
            proc = active_procs.pop(cmd_id, None)
            if proc and proc.returncode is None:
                try:
                    proc.terminate()
                    await asyncio.wait_for(proc.wait(), timeout=3)
                except asyncio.TimeoutError:
                    proc.kill()

            await ws.send_json({"type": "done", "id": cmd_id, "result": {"cancelled": True}})
            continue

        if msg.get("type") != "cmd":
            continue

        cmd_id = msg["id"]
        method = msg["method"]
        params = msg.get("params", {})

        await ws.send_json({"type": "ack", "id": cmd_id})

        task = asyncio.create_task(execute_method(cmd_id, method, params, ws))
        active_tasks[cmd_id] = task


async def execute_method(cmd_id: str, method: str, params: dict, ws: WebSocket):
    try:
        handler = getattr(pipeline, method.replace(".", "_"))
        result = handler(**params)

        if hasattr(result, "__aiter__"):
            # 流式方法：逐 chunk 推送
            aggregated = []
            async for chunk in result:
                aggregated.append(chunk)
                await ws.send_json({"type": "chunk", "id": cmd_id, "data": chunk, "seq": len(aggregated) - 1})
            final = _aggregate(method, aggregated)
            await ws.send_json({"type": "done", "id": cmd_id, "result": final})
        else:
            awaited = await result if asyncio.iscoroutine(result) else result
            await ws.send_json({"type": "done", "id": cmd_id, "result": awaited})

    except asyncio.CancelledError:
        pass  # cancel 分支已发 done 消息
    except Exception as e:
        await ws.send_json({"type": "err", "id": cmd_id, "code": "INTERNAL", "message": str(e)})
    finally:
        active_tasks.pop(cmd_id, None)
        active_procs.pop(cmd_id, None)


def _aggregate(method: str, chunks: list) -> dict:
    if not chunks:
        return None
    if all(isinstance(c, str) for c in chunks):
        return {"text": "".join(chunks)}
    if all(isinstance(c, dict) for c in chunks):
        return {"items": chunks}
    return {"raw": chunks}
