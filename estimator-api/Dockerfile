# Build from the repository root:
#   docker build -f estimator-api/Dockerfile -t housing-estimator-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY estimator-api/requirements.txt .
RUN pip install -r requirements.txt
COPY estimator-api/app ./app

RUN useradd --system --uid 10001 --home-dir /app appuser
USER appuser

# MONGODB_URI must be provided at runtime (never baked into the image).
ENV ML_API_URL=http://ml-api:8000
EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=2).status == 200 else 1)"

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8001"]
