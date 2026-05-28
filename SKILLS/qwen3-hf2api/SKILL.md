---
name: qwen3-hf2api
description: Qwen3 TTS (48 voices, 12 languages) and ASR (32 languages) via local OpenAI-compatible API at localhost:8820. Use this skill whenever you need to generate spoken audio from text, transcribe recordings to text, or work with any voice/audio data. Trigger on: text-to-speech, speech synthesis, voice generation, audio transcription, speech-to-text, STT, TTS, recording transcription, or when the user wants to hear text read aloud. Even if the user doesn't mention "Qwen3" or "hf2api", use this when they need any audio generation or speech recognition task.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# Qwen3 TTS & ASR

Local OpenAI-compatible API at `http://localhost:8820`. TTS: 48 voices in 12 languages. ASR: transcription in 32 languages.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/models` | Available voices + languages |
| GET | `/health` | Service health check |
| POST | `/v1/audio/speech` | Text → WAV audio |
| POST | `/v1/audio/transcriptions` | Audio file → text JSON |

## Text-to-Speech

```
POST /v1/audio/speech  |  Content-Type: application/json
```

| Parameter | Required | Default | Notes |
|-----------|----------|---------|-------|
| `input` | **Yes** | — | Text to speak |
| `voice` | No | `cherry` | 48 options + 6 OpenAI aliases |
| `language` | No | `auto` | 12 language codes |
| `speed` | No | — | Not supported (warning header) |
| `response_format` | No | `wav` | Only WAV supported |

**OpenAI aliases**: `alloy`→vivian, `echo`→ethan, `fable`→momo, `onyx`→kai, `nova`→chelsie, `shimmer`→serena

### All Voices

| ID | Name | | ID | Name |
|:---|:---|---|:---|:---|
| cherry | Cherry / 芊悦 | | serena | Serena / 苏瑶 |
| ethan | Ethan / 晨煦 | | chelsie | Chelsie / 千雪 |
| momo | Momo / 茉兔 | | vivian | Vivian / 十三 |
| moon | Moon / 月白 | | maia | Maia / 四月 |
| kai | Kai / 凯 | | nofish | Nofish / 不吃鱼 |
| bella | Bella / 萌宝 | | jennifer | Jennifer / 詹妮弗 |
| ryan | Ryan / 甜茶 | | katerina | Katerina / 卡捷琳娜 |
| aiden | Aiden / 艾登 | | bodega | Bodega / 西班牙语 |
| alek | Alek / 俄语 | | dolce | Dolce / 意大利语 |
| sohee | Sohee / 韩语 | | onoanna | Ono Anna / 日语 |
| lenn | Lenn / 德语 | | sonrisa | Sonrisa / 拉美西语 |
| emilien | Emilien / 法语 | | andre | Andre / 葡语欧 |
| radiogol | Radio Gol / 葡语巴 | | eldric | Eldric Sage / 沧明子 |
| mia | Mia / 乖小妹 | | mochi | Mochi / 沙小弥 |
| bellona | Bellona / 燕铮莺 | | vincent | Vincent / 田叔 |
| bunny | Bunny / 萌小姬 | | neil | Neil / 阿闻 |
| elias | Elias / 墨讲师 | | arthur | Arthur / 徐大爷 |
| nini | Nini / 邻家妹妹 | | ebona | Ebona / 诡婆婆 |
| seren | Seren / 小婉 | | pip | Pip / 调皮小新 |
| stella | Stella / 美少女阿月 | | li | Li / 南京老李 |
| marcus | Marcus / 陕西秦川 | | roy | Roy / 闽南阿杰 |
| peter | Peter / 天津李彼得 | | eric | Eric / 四川程川 |
| rocky | Rocky / 粤语阿强 | | kiki | Kiki / 粤语阿清 |
| sunny | Sunny / 四川晴儿 | | jada | Jada / 上海阿珍 |
| dylan | Dylan / 北京晓东 |

**Languages (TTS)**: `auto`, `zh`, `en`, `ja`, `ko`, `de`, `fr`, `ru`, `pt`, `es`, `it`

## Speech-to-Text

```
POST /v1/audio/transcriptions  |  Content-Type: multipart/form-data
```

| Field | Required | Notes |
|-------|----------|-------|
| `file` | **Yes** | WAV, MP3, FLAC, OGG, etc. |
| `model` | No | `qwen3-asr` or `qwen3-asr:itn` (formatted output) |
| `language` | No | 32 codes. Improves accuracy. |
| `prompt` | No | Context text to guide style |

Returns: `{"text": "...", "language": "..."}`

**Languages (ASR)**: `auto`, `zh`, `yue`, `en`, `ar`, `de`, `fr`, `es`, `pt`, `id`, `it`, `ko`, `ru`, `th`, `vi`, `ja`, `tr`, `hi`, `ms`, `nl`, `sv`, `da`, `fi`, `pl`, `cs`, `fil`, `fa`, `el`, `ro`, `hu`, `mk`

## Examples

### Discover health + models
```bash
curl -s http://localhost:8820/health
curl -s http://localhost:8820/v1/models | python3 -m json.tool
```

### TTS — multi-language
```bash
# English
curl -sX POST http://localhost:8820/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"The weather is beautiful today.","voice":"serena","language":"en"}' -o en.wav

# Chinese
curl -sX POST http://localhost:8820/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"今天天气真好。","voice":"ethan","language":"zh"}' -o zh.wav

# Japanese
curl -sX POST http://localhost:8820/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"今日はいい天気ですね。","voice":"onoanna","language":"ja"}' -o ja.wav

# Korean
curl -sX POST http://localhost:8820/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"오늘 날씨가 좋네요.","voice":"sohee","language":"ko"}' -o ko.wav
```

### TTS — OpenAI alias (drop-in compatible)
```bash
curl -sX POST http://localhost:8820/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"tts-1","input":"Hello!","voice":"alloy"}' -o openai.wav
```

### ASR — basic + ITN + language hint
```bash
# Basic
curl -sX POST http://localhost:8820/v1/audio/transcriptions -F file=@recording.wav

# ITN: "123" → "one hundred twenty three"
curl -sX POST http://localhost:8820/v1/audio/transcriptions \
  -F file=@recording.wav -F model=qwen3-asr:itn -F language=en

# Language hint + context prompt
curl -sX POST http://localhost:8820/v1/audio/transcriptions \
  -F file=@tech_talk.wav -F language=zh \
  -F prompt="关于机器学习的演讲"
```

### Python (aiohttp)
```python
import aiohttp

async def tts(text: str, voice="vivian", lang="auto") -> bytes:
    async with aiohttp.ClientSession() as s:
        async with s.post("http://localhost:8820/v1/audio/speech",
            json={"input": text, "voice": voice, "language": lang}) as r:
            return await r.read()

async def asr(path: str, lang="auto") -> dict:
    data = aiohttp.FormData()
    data.add_field("file", open(path, "rb"))
    data.add_field("language", lang)
    async with aiohttp.ClientSession() as s:
        async with s.post("http://localhost:8820/v1/audio/transcriptions", data=data) as r:
            return await r.json()
```

### Python (openai SDK compatible)
```python
# Works with openai library if pointed to localhost
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8820/v1", api_key="not-needed")

# TTS
with client.audio.speech.with_streaming_response.create(
    model="tts-1", voice="alloy", input="Hello world!"
) as r:
    r.stream_to_file("output.wav")

# ASR
r = client.audio.transcriptions.create(
    model="qwen3-asr", file=open("recording.wav", "rb"), language="en"
)
print(r.text)
```

## Error Reference

| Code | Meaning | Action |
|:---|:---|:---|
| 400 | Bad request | Check `input` field is present and valid JSON |
| 401 | Auth required | Add `Authorization: Bearer <key>` header |
| 502 | Upstream error | Voice/language combo unavailable. Retry or switch. |
| 503 | Space unavailable | Heavy load. Wait and retry. |

## Known Issues

- `speed` not supported (upstream limitation) — returns `X-Warning` header
- Chelsea, Luna voices occasionally fail — retry or pick another
- Output always WAV — no mp3/opus conversion
- ASR may timeout on first request (cold GPU start)
- Custom voice cloning needs local Qwen3-TTS deployment, not available via HF Space
