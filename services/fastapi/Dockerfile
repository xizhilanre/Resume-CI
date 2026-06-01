FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git nodejs npm chromium \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY scripts/shushu-internship-tool/ /app/scripts/shushu-internship-tool/
COPY scripts/shushu-internship-resume-optimizer/ /app/scripts/shushu-internship-resume-optimizer/
COPY scripts/vibe-resume/ /app/scripts/vibe-resume/

RUN pip install -e /app/scripts/shushu-internship-tool \
    && pip install -e /app/scripts/shushu-internship-resume-optimizer \
    && cd /app/scripts/vibe-resume && npm install

VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
