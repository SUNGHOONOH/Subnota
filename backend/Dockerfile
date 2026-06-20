FROM python:3.11-slim

WORKDIR /app

# 빌드에 필요한 시스템 종속성 설치 (kiwipiepy 등 빌드 시 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성 설치
COPY pyproject.toml .
RUN pip install --no-cache-dir .
RUN playwright install --with-deps chromium

# 소스코드 복사
COPY app ./app

# Cloud Run 기본 포트인 8080으로 가동
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
