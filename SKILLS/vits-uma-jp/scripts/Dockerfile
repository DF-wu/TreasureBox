FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 HTTP_PORT=80 LANGUAGE=日语

RUN pip install --no-cache-dir aiohttp "gradio_client<1" websockets

WORKDIR /app
COPY app.py .
EXPOSE 80
CMD ["python3", "app.py"]
