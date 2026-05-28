---
name: qwen3-hf2api
description: Direct access to Qwen3 TTS (48 voices, 12 languages) and ASR (32 languages) HuggingFace Spaces via Gradio API. Use when you need text-to-speech or speech-to-text - call the HF Space endpoints directly with curl, no local server required. Trigger on TTS, speech synthesis, voice generation, audio transcription, speech-to-text, STT, or any audio task.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3"]}}}
---

# Qwen3 TTS & ASR (Direct HF Space API)

Call Qwen3 HuggingFace Spaces directly via Gradio SSE API. No local server, no Docker — just curl.

## Services

| Service | HF Space URL | Endpoint |
|---------|-------------|----------|
| TTS | `qwen-qwen3-tts-demo.hf.space` | SSE `/gradio_api/call/tts_interface` |
| ASR | `qwen-qwen3-asr.hf.space` | SSE `/gradio_api/call/transcribe` |

## TTS (Text-to-Speech)

### One-shot curl

```bash
EVENT=$(curl -sX POST "https://qwen-qwen3-tts-demo.hf.space/gradio_api/call/tts_interface" \
  -H "Content-Type: application/json" \
  -d '{"data":["Hello world!","Vivian / 十三","Auto / 自动"]}' | python3 -c "import sys,json; print(json.load(sys.stdin)['event_id'])")

curl -sN "https://qwen-qwen3-tts-demo.hf.space/gradio_api/call/tts_interface/$EVENT" | while IFS= read -r line; do
  case "$line" in
    "event: complete")
      read -r data
      FILE=$(echo "$data" | sed 's/^data: //' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['path'])")
      curl -s "https://qwen-qwen3-tts-demo.hf.space/gradio_api/file=$FILE" -o tts_output.wav
      break ;;
    "event: error")
      read -r data; echo "ERROR: $(echo "$data" | sed 's/^data: //')"; break ;;
  esac
done
```

### Parameters

Send as `{"data": [text, voice, language]}`:

| Position | Name | Type | Required | Default |
|----------|------|------|----------|---------|
| 0 | text | string | Yes | — |
| 1 | voice | string | No | `"Vivian / 十三"` |
| 2 | language | string | No | `"Auto / 自动"` |

**CRITICAL**: Voice and language must match EXACT Gradio display strings from tables below.

### Python (aiohttp SSE)

```python
import aiohttp, json, asyncio

async def qwen3_tts(text: str, voice="Vivian / 十三", lang="Auto / 自动") -> bytes:
    async with aiohttp.ClientSession() as s:
        async with s.post(
            "https://qwen-qwen3-tts-demo.hf.space/gradio_api/call/tts_interface",
            json={"data": [text, voice, lang]}
        ) as r:
            eid = (await r.json())["event_id"]
        async with s.get(f"https://qwen-qwen3-tts-demo.hf.space/gradio_api/call/tts_interface/{eid}") as r:
            async for line in r.content:
                line = line.decode().strip()
                if line == "event: complete":
                    data = json.loads((await r.content.readline()).decode().strip().removeprefix("data: "))
                    path = data[0]["path"]
                    async with s.get(f"https://qwen-qwen3-tts-demo.hf.space/gradio_api/file={path}") as dl:
                        return await dl.read()

audio = asyncio.run(qwen3_tts("Hello!", voice="Cherry / 芊悦", lang="English / 英文"))
with open("out.wav", "wb") as f: f.write(audio)
```

### TTS Voices (exact Gradio display strings)

| Voice | | Voice |
|:---|---|:---|
| `Cherry / 芊悦` | | `Serena / 苏瑶` |
| `Ethan / 晨煦` | | `Chelsie / 千雪` |
| `Momo / 茉兔` | | `Vivian / 十三` |
| `Moon / 月白` | | `Maia / 四月` |
| `Kai / 凯` | | `Nofish / 不吃鱼` |
| `Bella / 萌宝` | | `Jennifer / 詹妮弗` |
| `Ryan / 甜茶` | | `Katerina / 卡捷琳娜` |
| `Aiden / 艾登` | | `Bodega / 西班牙语-博德加` |
| `Alek / 俄语-阿列克` | | `Dolce / 意大利语-多尔切` |
| `Sohee / 韩语-素熙` | | `Ono Anna / 日语-小野杏` |
| `Lenn / 德语-莱恩` | | `Sonrisa / 西班牙语拉美-索尼莎` |
| `Emilien / 法语-埃米尔安` | | `Andre / 葡萄牙语欧-安德雷` |
| `Radio Gol / 葡萄牙语巴-拉迪奥·戈尔` | | `Eldric Sage / 精品百人-沧明子` |
| `Mia / 精品百人-乖小妹` | | `Mochi / 精品百人-沙小弥` |
| `Bellona / 精品百人-燕铮莺` | | `Vincent / 精品百人-田叔` |
| `Bunny / 精品百人-萌小姬` | | `Neil / 精品百人-阿闻` |
| `Elias / 墨讲师` | | `Arthur / 精品百人-徐大爷` |
| `Nini / 精品百人-邻家妹妹` | | `Ebona / 精品百人-诡婆婆` |
| `Seren / 精品百人-小婉` | | `Pip / 精品百人-调皮小新` |
| `Stella / 精品百人-美少女阿月` | | `Li / 南京-老李` |
| `Marcus / 陕西-秦川` | | `Roy / 闽南-阿杰` |
| `Peter / 天津-李彼得` | | `Eric / 四川-程川` |
| `Rocky / 粤语-阿强` | | `Kiki / 粤语-阿清` |
| `Sunny / 四川-晴儿` | | `Jada / 上海-阿珍` |
| `Dylan / 北京-晓东` |

### TTS Languages (exact Gradio display strings)

`Auto / 自动`, `Chinese / 中文`, `English / 英文`, `Japanese / 日语`, `Korean / 韩语`, `German / 德语`, `French / 法语`, `Russian / 俄语`, `Portuguese / 葡萄牙语`, `Spanish / 西班牙语`, `Italian / 意大利语`

## ASR (Speech-to-Text)

### One-shot curl

```bash
# Upload
SERVER_PATH=$(curl -sX POST "https://qwen-qwen3-asr.hf.space/gradio_api/upload" \
  -F "files=@recording.wav;type=audio/wav" | python3 -c "import sys,json; print(json.load(sys.stdin)[0])")

# Initiate
EVENT=$(curl -sX POST "https://qwen-qwen3-asr.hf.space/gradio_api/call/transcribe" \
  -H "Content-Type: application/json" \
  -d "{\"data\":[{\"path\":\"$SERVER_PATH\",\"meta\":{\"_type\":\"gradio.FileData\"}},\"Auto\",false]}" | python3 -c "import sys,json; print(json.load(sys.stdin)['event_id'])")

# Stream result
curl -sN "https://qwen-qwen3-asr.hf.space/gradio_api/call/transcribe/$EVENT" | while IFS= read -r line; do
  case "$line" in
    "event: complete")
      read -r data
      echo "$data" | sed 's/^data: //' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Lang: {d[0]}\nText: {d[1]}')"
      break ;;
    "event: error")
      read -r data; echo "ERROR: $(echo "$data" | sed 's/^data: //')"; break ;;
  esac
done
```

### Parameters

`{"data": [file_obj, language_str, return_timestamps]}`

| Position | Type | Default | Notes |
|----------|------|---------|-------|
| 0 | FileData | required | `{"path":"...","meta":{"_type":"gradio.FileData"}}` |
| 1 | string | `"Auto"` | Exact display string |
| 2 | bool | `false` | Timestamp toggle |

### Python (aiohttp)

```python
async def qwen3_asr(audio_path: str, lang="Auto") -> dict:
    async with aiohttp.ClientSession() as s:
        data = aiohttp.FormData()
        data.add_field("files", open(audio_path, "rb"), filename="audio.wav", content_type="audio/wav")
        async with s.post("https://qwen-qwen3-asr.hf.space/gradio_api/upload", data=data) as r:
            server_path = (await r.json())[0]
        async with s.post(
            "https://qwen-qwen3-asr.hf.space/gradio_api/call/transcribe",
            json={"data": [{"path": server_path, "meta": {"_type": "gradio.FileData"}}, lang, False]}
        ) as r:
            eid = (await r.json())["event_id"]
        async with s.get(f"https://qwen-qwen3-asr.hf.space/gradio_api/call/transcribe/{eid}") as r:
            async for line in r.content:
                line = line.decode().strip()
                if line == "event: complete":
                    data = json.loads((await r.content.readline()).decode().strip().removeprefix("data: "))
                    return {"language": data[0], "text": data[1]}
```

### ASR Languages (exact Gradio display strings)

`Auto`, `Chinese`, `Cantonese`, `English`, `Arabic`, `German`, `French`, `Spanish`, `Portuguese`, `Indonesian`, `Italian`, `Korean`, `Russian`, `Thai`, `Vietnamese`, `Japanese`, `Turkish`, `Hindi`, `Malay`, `Dutch`, `Swedish`, `Danish`, `Finnish`, `Polish`, `Czech`, `Filipino`, `Persian`, `Greek`, `Romanian`, `Hungarian`, `Macedonian`

## Common Gotchas

1. **Cold start**: First request after Space idle may take 30-60s (GPU init).
2. **SSE parsing**: Read line-by-line. `event: complete` → next line is `data: [...]`. Don't read ahead.
3. **Exact strings**: Voice/language must match Gradio display strings exactly — short codes (`vivian`, `zh`) only work through the local wrapper.
4. **File upload first**: ASR requires uploading to get a server path, then pass that path in transcribe call.
5. **Error null**: GPU crash or queue overflow. Retry after a few seconds.
