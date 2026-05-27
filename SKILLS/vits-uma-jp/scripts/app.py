#!/usr/bin/env python3
"""
OpenAI-compatible TTS wrapper for vits-uma-genshin-honkai (JP voices only).
"""
import os, json, time, logging, threading, asyncio
from aiohttp import web

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vits-uma-api")

BASE_URL = os.getenv("BASE_URL", "zomehwh/vits-uma-genshin-honkai")
HTTP_PORT = int(os.getenv("HTTP_PORT", "80"))
LANGUAGE = os.getenv("LANGUAGE", "日语")

VOICE_MAP = {}
CLIENT = None
CLIENT_LOCK = threading.Lock()
CLIENT_LAST_USED = 0
CLIENT_TTL = 300


def get_client():
    global CLIENT, CLIENT_LAST_USED
    from gradio_client import Client
    with CLIENT_LOCK:
        now = time.time()
        if CLIENT is None or (now - CLIENT_LAST_USED) > CLIENT_TTL:
            if CLIENT is not None:
                try:
                    CLIENT.close()
                except Exception:
                    pass
            logger.info("Creating new Gradio client...")
            CLIENT = Client(BASE_URL)
            CLIENT_LAST_USED = now
        else:
            CLIENT_LAST_USED = now
    return CLIENT


def init_voices_sync():
    global VOICE_MAP
    client = get_client()
    config = client.config
    for comp in config.get("components", []):
        if comp.get("id") == 13:
            choices = comp.get("props", {}).get("choices", [])
            jp = [c for c in choices if c.startswith("日语")]
            for full_name in jp:
                name_part = full_name[2:]
                if "（" in name_part:
                    char_name = name_part if name_part else "未知".split("（")[0]
                else:
                    char_name = name_part if name_part else "未知"
                VOICE_MAP[char_name] = full_name
            logger.info(f"Loaded {len(VOICE_MAP)} JP voices")
            break


async def handle_models(request):
    return web.json_response({
        "object": "list",
        "data": [{"id": "vits-uma-jp", "object": "model", "owned_by": "community"}],
        "voices": {k: v for k, v in sorted(VOICE_MAP.items())},
    })


async def handle_speech(request):
    if request.content_type == "application/json":
        payload = await request.json()
    else:
        payload = dict(request.query)

    text = payload.get("input", "")
    if not text:
        return web.json_response({"error": "No input text"}, status=400)

    voice_id = payload.get("voice", "")
    voice_name = VOICE_MAP.get(voice_id)
    if not voice_name:
        for k, v in VOICE_MAP.items():
            if voice_id in v:
                voice_name = v
                break
    if not voice_name:
        available = ", ".join(sorted(VOICE_MAP.keys())[:10])
        return web.json_response({
            "error": f"Unknown voice '{voice_id}'. Available: {available}..."
        }, status=400)

    noise_scale = float(payload.get("noise_scale", 0.6))
    noise_scale_w = float(payload.get("noise_scale_w", 0.668))
    length_scale = float(payload.get("speed", 1.2))

    logger.info(f"TTS: voice={voice_id}, text={text[:50]}...")

    def _predict():
        client = get_client()
        with CLIENT_LOCK:
            return client.predict(
                text, LANGUAGE, voice_name,
                noise_scale, noise_scale_w, length_scale,
                fn_index=0,
            )

    try:
        result = await asyncio.to_thread(_predict)
        audio_path = result[1]
        logger.info(f"TTS done: {result[2]}")

        with open(audio_path, "rb") as f:
            audio_data = f.read()

        return web.Response(
            body=audio_data,
            content_type="audio/wav",
            headers={"X-TTS-Info": result[2], "X-TTS-Voice": voice_id},
        )
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def handle_health(request):
    return web.json_response({"status": "ok", "voices": len(VOICE_MAP)})


def main():
    app = web.Application()
    app.router.add_get("/v1/models", handle_models)
    app.router.add_get("/v1/audio/models", handle_models)
    app.router.add_post("/v1/audio/speech", handle_speech)
    app.router.add_get("/v1/audio/speech", handle_speech)
    app.router.add_get("/health", handle_health)

    # Init voices in background before starting
    async def startup(_app):
        await asyncio.to_thread(init_voices_sync)

    app.on_startup.append(startup)

    logger.info(f"Starting on port {HTTP_PORT}")
    web.run_app(app, host="0.0.0.0", port=HTTP_PORT)


if __name__ == "__main__":
    main()
