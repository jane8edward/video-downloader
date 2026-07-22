import asyncio
import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ai_service import chat_stream, generate_summary_stream
from auth_store import get_membership, get_request_user, refund_ai_quota, reserve_ai_quota
from subtitle_extractor import extract_subtitle


router = APIRouter(prefix="/api", tags=["AI"])


class SubtitleRequest(BaseModel):
    url: str


class SummarizeRequest(BaseModel):
    title: str
    transcript: str
    duration: Optional[float] = 0
    resource_key: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    title: str
    transcript: str
    summary: Optional[str] = ""
    messages: List[ChatMessage]


def _require_active_membership(request: Request):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="AI 对话是会员功能，请先注册或登录")

    membership = get_membership(user["id"])
    if not membership["is_active"]:
        raise HTTPException(status_code=403, detail="AI 对话是会员功能，请先开通会员")
    return user


def _require_summary_access(request: Request, resource_key: Optional[str] = None):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="免费用户每天可用 3 次 AI 总结，请先注册或登录")

    membership = get_membership(user["id"])
    if membership["is_active"]:
        return user, False, ""

    quota = reserve_ai_quota(user["id"], "summary", 3, resource_key)
    if not quota["allowed"]:
        raise HTTPException(status_code=403, detail="今日 3 次免费 AI 总结已用完，请明天再试或开通会员")
    return user, quota["charged"], quota["resource_key"]


@router.post("/subtitle")
async def get_subtitle(req: SubtitleRequest):
    try:
        return await asyncio.to_thread(extract_subtitle, req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"字幕提取失败: {str(e)}")


@router.post("/summarize")
async def summarize_video(req: SummarizeRequest, request: Request):
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="转录文本不能为空")
    user, quota_charged, charged_resource_key = _require_summary_access(request, req.resource_key or req.title)

    async def event_stream():
        try:
            async for text in generate_summary_stream(req.title, req.transcript, req.duration):
                data = json.dumps({"content": text, "done": False}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            done_data = json.dumps({"content": "", "done": True}, ensure_ascii=False)
            yield f"data: {done_data}\n\n"
        except Exception as e:
            if quota_charged:
                refund_ai_quota(user["id"], "summary", charged_resource_key)
            error_data = json.dumps({"error": str(e), "done": True}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat")
async def chat_with_video(req: ChatRequest, request: Request):
    _require_active_membership(request)
    if not req.messages:
        raise HTTPException(status_code=400, detail="消息不能为空")

    messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_stream():
        try:
            async for text in chat_stream(req.title, req.transcript, req.summary, messages_dicts):
                data = json.dumps({"content": text, "done": False}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            done_data = json.dumps({"content": "", "done": True}, ensure_ascii=False)
            yield f"data: {done_data}\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e), "done": True}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
