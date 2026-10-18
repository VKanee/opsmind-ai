from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models import Organization, User
from app.schemas import LoginRequest, TokenResponse, UserResponse
from app.security import create_access_token, verify_password
from app.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["登录认证"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    organization = db.scalar(
        select(Organization).where(Organization.slug == payload.organization_slug)
    )
    if organization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

    user = db.scalar(
        select(User).where(
            User.organization_id == organization.id,
            User.email == payload.email.lower(),
            User.is_active.is_(True),
        )
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

    token, expires_in = create_access_token(user, request.app.state.settings)
    record_audit(
        db,
        organization_id=organization.id,
        actor_id=user.id,
        action="auth.login",
        resource_type="session",
        resource_id=user.id,
        details={"role": user.role.value},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)
