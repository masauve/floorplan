# Image de l'application d'aménagement (FastAPI + interface statique).
FROM registry.access.redhat.com/ubi9/python-312:latest

WORKDIR /opt/app-root/src
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Base SQLite sur le volume persistant monté sur /data (OpenShift : UID arbitraire, groupe 0).
ENV DB_PATH=/data/plans.db \
    PYTHONUNBUFFERED=1
USER 1001
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
