# Gradio Space API Reverse Engineering

Comprehensive guide derived from reverse-engineering 3 HF Spaces (Qwen3-TTS, Qwen3-ASR, VITS-UMA) and building production wrappers (https://github.com/DF-wu/hf2api).

## Space Discovery

```bash
# Get Gradio version and component layout
curl -s https://{space}.hf.space/config | python3 -m json.tool

# Get app.py source (usually public on HF)
curl -s https://huggingface.co/spaces/{owner}/{space}/raw/main/app.py
```

The `/config` response contains:
- `components`: all UI components with IDs, types, labels, choices, defaults
- `dependencies`: which components feed into which functions (parameter order)
- `mode`: "blocks" (Gradio 3.7+) or "interface" (legacy)
- `version`: Gradio version string

## Gradio 3.x REST API

### Named API (api_name set)

When `app.py` has `api_name="generate"`:

```python
# Request
POST /api/generate/
Content-Type: application/json
{"data": [param1, param2, ...]}

# Success response
{"data": ["output1", "/file=path.wav", "timing info"], "duration": 2.5}

# Error response  
{"error": "error message", "duration": 0.01}
```

### Unnamed API (fn_index)

When no `api_name`, use fn_index (0-based from config dependencies):

```python
POST /api/predict/
{"fn_index": 0, "data": [param1, param2, ...]}
```

### Dropdown Parameter Behavior (CRITICAL)

Gradio 3.x `gr.Dropdown` with `type="index"` sends the **label string** via REST API, NOT the integer index. Verify by testing — send the string from `choices` array.

### Queue Behavior

`app.queue(concurrency_count=N).launch()` controls parallelism. Spaces with `concurrency_count=1` serialize requests. The REST API waits for queue slot; WebSocket shows queue position.

## Gradio 3.x WebSocket Protocol

Full protocol for `/queue/join`:

```
1. Connect WS to wss://{space}.hf.space/queue/join
2. RECV: {"msg": "send_hash"} 
3. SEND: {"session_hash": "<random_11>", "fn_index": 0}
4. RECV: {"msg": "estimation", ...} (ignore)
5. RECV: {"msg": "send_data"}
6. SEND: {"data": [...], "fn_index": 0, "session_hash": "<same>"}
7. RECV: {"msg": "estimation", ...} (ignore, may repeat)
8. RECV: {"msg": "process_starts"} (optional)
9. RECV: {"msg": "process_completed", "output": {"data": [...]}}
```

Error states:
- `{"msg": "process_completed", "success": false, "output": {"error": "..."}}`
- Early completion before send_data means queue rejected

## Gradio 4+ SSE Protocol

```python
# Step 1: Initiate
POST /gradio_api/call/{function_name}
{"data": [param1, param2, ...]}
# Response: {"event_id": "abc123"}

# Step 2: Listen to SSE stream
GET /gradio_api/call/{function_name}/{event_id}
# SSE events:
# event: generating (progress updates)
# event: complete
# data: [output1, output2, ...]
# event: error  
# data: error message
```

## Audio Output Patterns

### Pattern 1: Standard (file path)

Gradio creates temp WAV, returns path:
```python
# Backend returns
return "成功!", (22050, audio_numpy), "耗时 Xs"

# Gradio postprocess → /tmp/gradio/xxx.wav → returns path string
# API response: ["成功!", "/file=/tmp/gradio/xxx.wav", "耗时 Xs"]
```

Download: `GET {base_url}/file=/tmp/gradio/xxx.wav`

### Pattern 2: Base64 monkeypatch

Some Spaces patch `gr.Audio.postprocess`:
```python
import gradio.processing_utils as gr_processing_utils
audio_postprocess_ori = gr.Audio.postprocess
def audio_postprocess(self, y):
    data = audio_postprocess_ori(self, y)
    if data is None: return None
    return gr_processing_utils.encode_url_or_file_to_base64(data["name"])
gr.Audio.postprocess = audio_postprocess
```

Result: response contains `data:audio/wav;base64,...` instead of file path. Parse with `base64.b64decode(data.split(",", 1)[1])`.

### Pattern 3: Direct numpy (ikechan8370)

No monkeypatch, no API wrapping — returns raw tuple:
```python
return "生成成功!", (22050, audio), f"耗时 {t}s"
```

The REST API response wraps this in standard Gradio format (file path in `data[1]`).

## Speaker/Voice Resolution

When wrapping a Gradio Space with many dropdown choices (e.g., 804 speakers):

```python
# 1. Extract from config
choices = component["choices"]  # ["神里绫华（龟龟）", "派蒙", ...]

# 2. Build alias table
aliases = {"ayaka": "神里绫华"}  # English → Chinese

# 3. Multi-layer resolution
def resolve(name, choices, aliases):
    if name in choices: return name
    for c in choices:
        if c.startswith(name) and len(name) >= 2: return c
    if name.lower() in aliases:
        resolved = aliases[name.lower()]
        for c in choices:
            if c.startswith(resolved): return c
    lower = name.lower()
    for c in choices:
        if c.lower() == lower: return c
        if c.lower().startswith(lower): return c
        if lower in c.lower(): return c
    return name
```

## Text Length Limits

Check `app.py` for hardcoded limits:
```python
# VITS (zomehwh): 100 chars on Spaces
limitation = os.getenv("SYSTEM") == "spaces"
if len(text) > 100 and limitation: return error

# VITS (ikechan8370): 500 chars always
if len(text) > 500: return error

# Qwen3-TTS: no limit (passed to DashScope API)
```

**Watch for misleading error messages** — ikechan8370 says `>100` in error but checks `>500`.

## Multi-Upstream Architecture

Pattern for resilience when multiple Spaces host the same model:

```python
# Primary: REST API (fast, higher limit)
try:
    result = await rest_client.call(base_url, data, timeout)
    return result
except RESTError:
    pass

# Fallback: WebSocket (slower, lower limit)
if len(text) > fallback_limit:
    text = text[:fallback_limit]
result = await ws_client.call(fallback_url, data, timeout)
return result
```

Benefits:
- Primary failure → automatic fallback, user never sees error
- Different text limits per upstream (truncate before fallback)
- Can hot-swap upstreams by changing env vars

## File Upload Pattern

For ASR/transcription Spaces that accept file uploads:

```python
# Upload
POST /upload  (Gradio 3.x)
Content-Type: multipart/form-data
files: <binary>

# Response: ["/tmp/gradio/abc123.wav"]  (server path)

# Use in prediction
POST /api/generate/
{"data": [{"path": "/tmp/gradio/abc123.wav", "meta": {"_type": "gradio.FileData"}}, lang, ...]}
```

## Common Gotchas

1. **`/config` 404**: Space may be private or not started. HF Spaces sleep after inactivity.
2. **Dropdown index vs label**: Gradio 3.x REST sends label, WS sends index. Test both.
3. **`/queue/data` 404**: Not available on Gradio < 4.0.
4. **`/info` 404**: Only on Gradio 4+ (OpenAPI schema).
5. **fn_index starts at 0**: First function in `dependencies` has index 0.
6. **Error `null`**: HF Space GPU crash or queue overflow. Return 503, not 502.
7. **Cold start**: First request after idle may take 30-60s (GPU init).
8. **Space forking**: Forked Spaces (e.g., zomehwh → ikechan8370 → sayashi) may have different limits, features, or speaker lists. Always check `/config` on each.
