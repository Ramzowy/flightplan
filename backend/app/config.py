from datetime import datetime
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Defaults are demo-only values (see docs/CONTRACT.md §1)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://flightplan:demo_only_change_me@db:5432/flightplan"
    auth_secret: str = "demo_secret_replace_for_production"
    flightplan_demo_mode: bool = True
    demo_password: str = "FlightPlanDemo1!"
    demo_as_of: datetime = datetime.fromisoformat("2026-10-23T15:00:00+00:00")
    clinical_data_provider: str = "mock"
    enable_mychart_login: bool = False
    enable_epic_launch: bool = False
    session_ttl_hours: int = 12
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
