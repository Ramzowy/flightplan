from typing import Literal

from pydantic import BaseModel

from app.enums import ContentDepth, TextSize


class PreferencesOut(BaseModel):
    depth: ContentDepth
    preferred_language: str
    text_size: TextSize
    read_aloud: bool
    high_contrast: bool


class PreferencesUpdate(BaseModel):
    depth: ContentDepth | None = None
    # Only English is supported today; the UI lists Spanish as "coming later".
    preferred_language: Literal["en"] | None = None
    text_size: TextSize | None = None
    read_aloud: bool | None = None
    high_contrast: bool | None = None
