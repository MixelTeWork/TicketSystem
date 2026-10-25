FROM node:24-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.10-slim
WORKDIR /app
COPY --from=frontend /frontend/build ./build
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY backend/ ./
COPY scripts/vm/manual_app.py ./
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "1", "--threads", "4", "--timeout", "120", "--access-logfile", "-", "manual_app:app"]
