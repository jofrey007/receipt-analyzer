FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt /app/

# potrebné knižnice pre psycopg2 a build
RUN apt-get update && apt-get install -y gcc libpq-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
