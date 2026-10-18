FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system opsmind && \
    adduser --system --ingroup opsmind opsmind && \
    mkdir -p /app/data && \
    chown -R opsmind:opsmind /app

COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY migrations ./migrations

RUN python -m pip install --upgrade pip && \
    python -m pip install .

USER opsmind

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
