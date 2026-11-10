from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import CurrentUser, DbSession, get_current_session
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: DbSession) -> AuthResponse:
    return auth_service.register(db, body)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: DbSession) -> AuthResponse:
    return auth_service.login(db, body)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DbSession, current: Annotated[tuple, Depends(get_current_session)]) -> Response:
    auth_service.logout(db, current[1])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return auth_service.user_out(user)
