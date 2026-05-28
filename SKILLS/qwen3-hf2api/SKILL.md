---
name: qwen3-hf2api
description: Qwen3 TTS (48 voices) and ASR (32 languages) via HuggingFace Spaces. Use when you need text-to-speech, speech-to-text, voice synthesis, or audio transcription. Includes ready-to-use bash functions and Python functions. Trigger on TTS, STT, ASR, speech, voice, audio generation, transcription.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3"]}}}
---

# Qwen3 TTS & ASR

Direct HF Space access. Copy the functions below, paste into your shell or script — done.

---

## Quick Functions (bash — copy-paste ready)

### TTS

```bash
qwen3_tts() {
  # Usage: qwen3_tts "text" [voice] [lang] [output_file]
  # Voice default: Vivian / 十三
  # Lang default: Auto / 自动
  local text="${1:?Usage: qwen3_tts <text> [voice] [lang] [output]}"
  local voice="${2:-Vivian / 十三}"
  local lang="${3:-Auto / 自动}"
  local out="${4:-tts_output.wav}"
  local event_id=$(curl -sX POST "https://qwen-qwen3-tts-demo.hf.space/gradio_api/call/tts_interface" \
    -H "Content-Type: application/json" \
    -d "{\"data\":[\"$text\",\"$voice\",\"$lang\"]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['event_id'])")
  local file_path=""
  while IFS= read -r line; do
    case "$line" in
      "event: complete")
        read -r data
        file_path=$(echo "$data" | sed 's/^data: //' | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['path'])")
        curl -s "https://qwen-qwen3-tts-demo.hf.space/gradio_api/file=$file_path" -o "$out"
        echo "Saved: $out" ;;
      "event: error")
        read -r data; echo "ERROR: $(echo "$data" | sed 's/^data: //')" >&2; return 1 ;;
    esac
  done < <(curl -sN "https://qwen-qwen3-tts-demo.hf.space/gradio_api/call/tts_interface/$event_id")
}

# Examples:
# qwen3_tts "Hello world!"
# qwen3_tts "你好世界" "Ethan / 晨煦" "Chinese / 中文"
# qwen3_tts "こんにちは" "Ono Anna / 日语-小野杏" "Japanese / 日语" hello_ja.wav
```

### ASR

```bash
qwen3_asr() {
  # Usage: qwen3_asr <audio_file> [lang]
  # Lang default: Auto
  local file="${1:?Usage: qwen3_asr <audio_file> [lang]}"
  local lang="${2:-Auto}"
  local server_path=$(curl -sX POST "https://qwen-qwen3-asr.hf.space/gradio_api/upload" \
    -F "files=@$file;type=audio/wav" | python3 -c "import sys,json;print(json.load(sys.stdin)[0])")
  local event_id=$(curl -sX POST "https://qwen-qwen3-asr.hf.space/gradio_api/call/transcribe" \
    -H "Content-Type: application/json" \
    -d "{\"data\":[{\"path\":\"$server_path\",\"meta\":{\"_type\":\"gradio.FileData\"}},\"$lang\",false]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['event_id'])")
  while IFS= read -r line; do
    case "$line" in
      "event: complete")
        read -r data
        echo "$data" | sed 's/^data: //' | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Lang: {d[0]}\nText: {d[1]}')"
        break ;;
      "event: error")
        read -r data; echo "ERROR: $(echo "$data" | sed 's/^data: //')" >&2; return 1 ;;
    esac
  done < <(curl -sN "https://qwen-qwen3-asr.hf.space/gradio_api/call/transcribe/$event_id")
}

# Examples:
# qwen3_asr recording.wav
# qwen3_asr recording.wav "Chinese"
# qwen3_asr speech.mp3 "Japanese"
```

---

## Python Functions (copy-paste ready)

### TTS

```python
import aiohttp, json, asyncio

TTS_BASE = "https://qwen-qwen3-tts-demo.hf.space"

async def qwen3_tts(text: str, voice: str = "Vivian / 十三", lang: str = "Auto / 自动") -> bytes:
    """Returns WAV audio bytes. Raise RuntimeError on upstream error."""
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{TTS_BASE}/gradio_api/call/tts_interface",
                json={"data": [text, voice, lang]}) as r:
            eid = (await r.json())["event_id"]
        async with s.get(f"{TTS_BASE}/gradio_api/call/tts_interface/{eid}") as r:
            async for line in r.content:
                line = line.decode().strip()
                if line == "event: complete":
                    data = json.loads((await r.content.readline()).decode().strip()[6:])
                    path = data[0]["path"]
                    async with s.get(f"{TTS_BASE}/gradio_api/file={path}") as dl:
                        return await dl.read()
                elif line == "event: error":
                    err = (await r.content.readline()).decode().strip()[6:]
                    raise RuntimeError(err)
    raise RuntimeError("No response from TTS endpoint")

# --- Usage ---
# audio = asyncio.run(qwen3_tts("Hello world!"))
# with open("out.wav", "wb") as f: f.write(audio)
# audio = asyncio.run(qwen3_tts("你好", voice="Ethan / 晨煦", lang="Chinese / 中文"))
```

### ASR

```python
ASR_BASE = "https://qwen-qwen3-asr.hf.space"

async def qwen3_asr(audio_path: str, lang: str = "Auto") -> dict:
    """Returns {"language": str, "text": str}. Raise RuntimeError on upstream error."""
    async with aiohttp.ClientSession() as s:
        data = aiohttp.FormData()
        data.add_field("files", open(audio_path, "rb"), filename="audio.wav", content_type="audio/wav")
        async with s.post(f"{ASR_BASE}/gradio_api/upload", data=data) as r:
            server_path = (await r.json())[0]
        async with s.post(f"{ASR_BASE}/gradio_api/call/transcribe",
                json={"data": [{"path": server_path, "meta": {"_type": "gradio.FileData"}}, lang, False]}) as r:
            eid = (await r.json())["event_id"]
        async with s.get(f"{ASR_BASE}/gradio_api/call/transcribe/{eid}") as r:
            async for line in r.content:
                line = line.decode().strip()
                if line == "event: complete":
                    out = json.loads((await r.content.readline()).decode().strip()[6:])
                    return {"language": out[0], "text": out[1]}
                elif line == "event: error":
                    raise RuntimeError((await r.content.readline()).decode().strip()[6:])
    raise RuntimeError("No response from ASR endpoint")

# --- Usage ---
# r = asyncio.run(qwen3_asr("recording.wav", lang="Chinese"))
# print(r["text"])
```

### Sync wrapper (no async needed)

```python
def qwen3_tts_sync(text: str, voice: str = "Vivian / 十三", lang: str = "Auto / 自动") -> bytes:
    """Synchronous wrapper — use when you can't run asyncio."""
    return asyncio.run(qwen3_tts(text, voice, lang))

def qwen3_asr_sync(audio_path: str, lang: str = "Auto") -> dict:
    """Synchronous wrapper."""
    return asyncio.run(qwen3_asr(audio_path, lang))

# audio = qwen3_tts_sync("Hello!")
# r = qwen3_asr_sync("recording.wav")
```

---

## TTS Voices (exact Gradio strings)

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

## TTS Languages

`Auto / 自动`, `Chinese / 中文`, `English / 英文`, `Japanese / 日语`, `Korean / 韩语`, `German / 德语`, `French / 法语`, `Russian / 俄语`, `Portuguese / 葡萄牙语`, `Spanish / 西班牙语`, `Italian / 意大利语`

## ASR Languages

`Auto`, `Chinese`, `Cantonese`, `English`, `Arabic`, `German`, `French`, `Spanish`, `Portuguese`, `Indonesian`, `Italian`, `Korean`, `Russian`, `Thai`, `Vietnamese`, `Japanese`, `Turkish`, `Hindi`, `Malay`, `Dutch`, `Swedish`, `Danish`, `Finnish`, `Polish`, `Czech`, `Filipino`, `Persian`, `Greek`, `Romanian`, `Hungarian`, `Macedonian`

## Gotchas

1. Cold start: first request after idle = 30-60s. Subsequent = fast.
2. Exact strings required for voice/language — no short codes.
3. ASR needs file upload first to get server path.
4. Error null = GPU crash. Retry.
