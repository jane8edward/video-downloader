"""
AI 功能路由模块 - 字幕提取、AI总结、AI对话 API
使用 FastAPI APIRouter，通过 include_router 挂载到主应用
"""

import json
import asyncio
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from subtitle_extractor import extract_subtitle
from ai_service import generate_summary_stream, chat_stream

router = APIRouter(prefix="/api", tags=["AI"])


# ──────────────────── Request Models ────────────────────

class SubtitleRequest(BaseModel):
    url: str


class SummarizeRequest(BaseModel):
    title: str
    transcript: str
    duration: Optional[float] = 0


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    title: str
    transcript: str
    summary: Optional[str] = ""
    messages: List[ChatMessage]


# ──────────────────── Endpoints ────────────────────

@router.post("/subtitle")
async def get_subtitle(req: SubtitleRequest):
    """提取视频字幕/转录文本"""
    try:
        result = await asyncio.to_thread(extract_subtitle, req.url)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"字幕提取失败: {str(e)}")


@router.post("/summarize")
async def summarize_video(req: SummarizeRequest):
    """AI 生成视频总结（SSE 流式输出）"""
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="转录文本不能为空")

    async def event_stream():
        try:
            async for text in generate_summary_stream(
                req.title, req.transcript, req.duration
            ):
                data = json.dumps(
                    {"content": text, "done": False}, ensure_ascii=False
                )
                yield f"data: {data}\n\n"
            # Signal completion
            done_data = json.dumps({"content": "", "done": True}, ensure_ascii=False)
            yield f"data: {done_data}\n\n"
        except Exception as e:
            error_data = json.dumps(
                {"error": str(e), "done": True}, ensure_ascii=False
            )
            yield f"data: {error_data}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat")
async def chat_with_video(req: ChatRequest):
    """AI 视频对话（SSE 流式输出）"""
    if not req.messages:
        raise HTTPException(status_code=400, detail="消息不能为空")

    messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_stream():
        try:
            async for text in chat_stream(
                req.title, req.transcript, req.summary, messages_dicts
            ):
                data = json.dumps(
                    {"content": text, "done": False}, ensure_ascii=False
                )
                yield f"data: {data}\n\n"
            done_data = json.dumps({"content": "", "done": True}, ensure_ascii=False)
            yield f"data: {done_data}\n\n"
        except Exception as e:
            error_data = json.dumps(
                {"error": str(e), "done": True}, ensure_ascii=False
            )
            yield f"data: {error_data}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
