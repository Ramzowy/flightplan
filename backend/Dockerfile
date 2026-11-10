# FlightPlan API image (FastAPI + SQLAlchemy + Alembic), dependencies managed by uv.
# One image is reused by the compose `migrate`, `seed` and `api` services.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR=/tmp/uv-cache \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    # The venv is fully synced at build time (no dev deps); never resync at runtime.
    UV_NO_SYNC=1 \
    PATH="/app/.venv/bin:$PATH"

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --no-create-home app \
    && mkdir /app && chown app:app /app

WORKDIR /app
USER app

# Dependency layer (cached until pyproject.toml / uv.lock change).
COPY --chown=app:app pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/tmp/uv-cache,uid=10001,gid=10001 \
    uv sync --locked --no-install-project --no-dev

# Application code, then install the project itself.
COPY --chown=app:app . .
RUN --mount=type=cache,target=/tmp/uv-cache,uid=10001,gid=10001 \
    uv sync --locked --no-dev

EXPOSE 8080

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
