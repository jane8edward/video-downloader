from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from auth_store import (
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    authenticate_user,
    create_session,
    create_user,
    delete_session,
    get_request_user,
    public_user,
)


router = APIRouter(prefix="/api/auth", tags=["Auth"])


class AuthRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("请输入有效邮箱")
        return normalized


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )


@router.post("/register")
async def register(req: AuthRequest, response: Response):
    user = create_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=409, detail="该邮箱已经注册，请直接登录")

    token = create_session(user["id"])
    _set_session_cookie(response, token)
    return {"user": public_user(user)}


@router.post("/login")
async def login(req: AuthRequest, response: Response):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码不正确")

    token = create_session(user["id"])
    _set_session_cookie(response, token)
    return {"user": public_user(user)}


@router.post("/logout")
async def logout(request: Request, response: Response):
    delete_session(request.cookies.get(SESSION_COOKIE, ""))
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
async def me(request: Request):
    return {"user": public_user(get_request_user(request))}
