# Experimental; pin base image by reviewed digest before promotion.
FROM python:3.13-slim
WORKDIR /opt/adphor
COPY backend/requirements-dl.txt /tmp/requirements-dl.txt
RUN python -m pip install --no-cache-dir -r /tmp/requirements-dl.txt \
    && rm /tmp/requirements-dl.txt
COPY backend/src/adphor_ai/ /opt/adphor/adphor_ai/
USER 65532:65532
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["python", "-I", "-B", "/opt/adphor/adphor_ai/_dl_worker.py"]
