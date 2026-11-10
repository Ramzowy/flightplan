from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.models import UserPreferences
from app.schemas.preferences import PreferencesOut, PreferencesUpdate

router = APIRouter(prefix="/me", tags=["preferences"])


def _get_or_create(db, user) -> UserPreferences:
    prefs = db.get(UserPreferences, user.id)
    if prefs is None:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def _out(p: UserPreferences) -> PreferencesOut:
    return PreferencesOut(
        depth=p.depth,
        preferred_language=p.preferred_language,
        text_size=p.text_size,
        read_aloud=p.read_aloud,
        high_contrast=p.high_contrast,
    )


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(db: DbSession, user: CurrentUser) -> PreferencesOut:
    return _out(_get_or_create(db, user))


@router.patch("/preferences", response_model=PreferencesOut)
def update_preferences(body: PreferencesUpdate, db: DbSession, user: CurrentUser) -> PreferencesOut:
    prefs = _get_or_create(db, user)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return _out(prefs)
