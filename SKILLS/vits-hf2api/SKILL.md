---
name: vits-hf2api
description: VITS anime/game character TTS (500+ voices) via HuggingFace Spaces. Use when you need Genshin, Star Rail, Uma Musume, Vocaloid, or anime character voice synthesis. Includes ready-to-use bash and Python functions. Trigger on any anime voice, game character TTS, character name mention, or voice synthesis request.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3"]}}}
---

# VITS Character TTS

500+ anime/game character voices. Copy the functions below — done.

Two upstreams with auto-fallback: REST API (500 chars, integer speaker ID) then WebSocket (100 chars, string speaker name).

---

## Quick Functions (bash — copy-paste ready)

```bash
vits_tts() {
  # Usage: vits_tts "text" [speaker_id] [lang] [noise] [output_file]
  # speaker_id default: 0 (派蒙)
  # lang default: 中文
  local text="${1:?Usage: vits_tts <text> [speaker_id] [lang] [noise] [output]}"
  local sid="${2:-0}"
  local lang="${3:-中文}"
  local noise="${4:-0.6}"
  local out="${5:-vits_output.wav}"

  # Try REST API (ikechan8370, 500 char limit)
  local result=$(curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
    -H "Content-Type: application/json" \
    -d "{\"data\":[\"$text\",\"$lang\",$sid,$noise,0.668,1.2]}")
  if echo "$result" | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(0 if 'data' in d else 1)" 2>/dev/null; then
    local file_path=$(echo "$result" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'][1])")
    curl -s "https://ikechan8370-vits-uma-genshin-honkai.hf.space/file=$file_path" -o "$out"
    echo "Saved: $out (REST)"
    return 0
  fi

  # Fallback: would need websocket. For now, report error.
  echo "ERROR: REST API failed. Try shorter text (<100 chars) or different speaker." >&2
  echo "Response: $result" >&2
  return 1
}

# Examples:
# vits_tts "你好旅行者！"
# vits_tts "おやすみなさい" 30 "日语"                           # 神里绫华, Japanese
# vits_tts "運命を切り開く" 131 "日语"                           # 黄泉, Japanese
# vits_tts "夜深了呢…你还没睡吗？" 25 "中文" 0.3 ganyu_whisper.wav  # 甘雨 whisper
```

### Discover speakers

```bash
vits_speakers() {
  # Usage: vits_speakers [search_term]
  # Lists speaker IDs and names. Optional search filter.
  curl -s "https://ikechan8370-vits-uma-genshin-honkai.hf.space/config" | \
    python3 -c "
import sys, json
config = json.load(sys.stdin)
choices = [c['choices'] for c in config['components'] if c.get('type') == 'dropdown' and len(c.get('choices',[])) > 100][0]
query = '${1:-}'.lower()
for i, name in enumerate(choices):
    if query in name.lower() or not query:
        print(f'{i:>4}  {name}')
" 2>/dev/null || echo "Space may be sleeping. Try again in 30s."
}

# Examples:
# vits_speakers              # list all 800+ speakers
# vits_speakers 神里          # search Chinese
# vits_speakers ayaka         # won't match — use Chinese name
# vits_speakers 甘雨          # find Ganyu
```

---

## Python Functions (copy-paste ready)

```python
import aiohttp, json, asyncio, base64, random, string
import websockets

REST_BASE = "https://ikechan8370-vits-uma-genshin-honkai.hf.space"
WS_BASE = "wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join"

# === REST API (primary, 500 chars) ===

async def vits_tts_rest(text: str, speaker_id: int = 0, lang: str = "中文",
                         noise: float = 0.6, nsw: float = 0.668, ls: float = 1.2) -> bytes:
    """Primary: ikechan8370 REST API. Returns WAV bytes."""
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{REST_BASE}/api/generate/",
                json={"data": [text, lang, speaker_id, noise, nsw, ls]}) as r:
            result = await r.json()
        if "error" in result:
            raise RuntimeError(result["error"])
        path = result["data"][1]
        async with s.get(f"{REST_BASE}/file={path}") as r:
            return await r.read()

# === WebSocket fallback (100 chars) ===

async def vits_tts_ws(text: str, speaker: str = "派蒙", lang: str = "中文",
                       noise: float = 0.6, nsw: float = 0.668, ls: float = 1.2) -> bytes:
    """Fallback: zomehwh WebSocket. Speaker must be exact Gradio dropdown string."""
    if len(text) > 100:
        text = text[:100]
    sh = ''.join(random.choices(string.ascii_letters + string.digits, k=11))
    async with websockets.connect(WS_BASE, additional_headers={
        "User-Agent": "Mozilla/5.0"
    }) as ws:
        await ws.recv()  # send_hash
        await ws.send(json.dumps({"session_hash": sh, "fn_index": 0}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("msg") == "send_data": break
        await ws.send(json.dumps({"data": [text, lang, speaker, noise, nsw, ls],
                                   "fn_index": 0, "session_hash": sh}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("msg") == "process_completed":
                if not msg.get("success", True):
                    raise RuntimeError(msg.get("output", {}).get("error", "Unknown error"))
                data = msg["output"]["data"]
                if isinstance(data[1], str) and data[1].startswith("data:audio/wav;base64,"):
                    return base64.b64decode(data[1].split(",", 1)[1])
                raise RuntimeError("Unexpected WS output format")

# === Combined (auto-fallback) ===

async def vits_tts(text: str, speaker_id: int = 0,
                    ws_speaker: str = "派蒙", lang: str = "中文",
                    noise: float = 0.6, nsw: float = 0.668, ls: float = 1.2) -> bytes:
    """Try REST first, fall back to WebSocket."""
    try:
        return await vits_tts_rest(text, speaker_id, lang, noise, nsw, ls)
    except Exception:
        return await vits_tts_ws(text, ws_speaker, lang, noise, nsw, ls)

# Sync wrapper
def vits_tts_sync(text: str, speaker_id: int = 0, ws_speaker: str = "派蒙",
                  lang: str = "中文", noise: float = 0.6) -> bytes:
    return asyncio.run(vits_tts(text, speaker_id, ws_speaker, lang, noise))

# --- Usage ---
# audio = asyncio.run(vits_tts("你好旅行者！", speaker_id=0))  # 派蒙, REST
# audio = asyncio.run(vits_tts("おやすみ", speaker_id=30, lang="日语"))  # 神里绫华
# audio = vits_tts_sync("Hello!", speaker_id=442, lang="日语")  # Rem, sync
# audio = asyncio.run(vits_tts("text", ws_speaker="神里绫华（龟龟）", lang="日语"))  # force WS
```

### Discover speakers (Python)

```python
async def vits_speakers(search: str = "") -> list:
    """Returns [(id, name), ...] for all 800+ speakers. Optional search filter."""
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{REST_BASE}/config") as r:
            config = await r.json()
    for c in config["components"]:
        if c.get("type") == "dropdown" and len(c.get("choices", [])) > 100:
            choices = c["choices"]
            q = search.lower()
            return [(i, n) for i, n in enumerate(choices) if q in n.lower() or not q]
    return []

# speakers = asyncio.run(vits_speakers())
# ganyu = asyncio.run(vits_speakers("甘雨"))  # find Ganyu's ID
```

---

## Speaker Reference (REST integer IDs)

### Genshin Impact
| ID | Name | | ID | Name |
|:--|:---|---|:--|:---|
| 0 | 派蒙 | | 23 | 钟离 |
| 25 | 甘雨 | | 27 | 胡桃 |
| 29 | 枫原万叶 | | 30 | 神里绫华 |
| 33 | 雷电将军 | | 39 | 八重神子 |
| 48 | 纳西妲 | | 63 | 芙宁娜 |
| 65 | 那维莱特 | | 76 | 荧 |

### Honkai Star Rail
| ID | Name | | ID | Name |
|:--|:---|---|:--|:---|
| 100 | 三月七 | | 101 | 丹恒 |
| 104 | 卡芙卡 | | 105 | 银狼 |
| 109 | 布洛妮娅 | | 110 | 希儿 |
| 119 | 景元 | | 131 | 黄泉 |
| 135 | 流萤 | | 139 | 飞霄 |

### Honkai Impact 3rd
| ID | Name | | ID | Name |
|:--|:---|---|:--|:---|
| 300 | 琪亚娜 | | 301 | 雷电芽衣 |
| 310 | 爱莉希雅 | | 322 | 符华 |

### Uma Musume
| ID | Name | | ID | Name |
|:--|:---|---|:--|:---|
| 200 | 特别周 | | 201 | 无声铃鹿 |
| 202 | 东海帝皇 | | 205 | 小栗帽 |
| 206 | 黄金船 | | 212 | 目白麦昆 |

### Anime
| ID | Name | Series |
|:--|:---|:---|
| 442 | 蕾姆 | Re:Zero |
| 457 | 桐人 | SAO |
| 458 | 亚丝娜 | SAO |
| 491 | 鸣人 | Naruto |
| 524 | 路飞 | One Piece |
| 551 | 炭治郎 | 鬼滅の刃 |
| 603 | 艾伦 | 進撃の巨人 |
| 604 | 三笠 | 進撃の巨人 |
| 606 | 利威尔 | 進撃の巨人 |
| 625 | 阿尔托莉雅 | Fate |

### Vocaloid
| ID | Name |
|:--|:---|
| 648 | 初音未来 |
| 652 | 洛天依 |

Full speaker list (800+): `vits_speakers` function above.

## WebSocket Speaker Strings

The WS fallback uses Gradio dropdown display strings (not IDs). Key examples:

| REST ID | WS String |
|:--|:---|
| 0 | `派蒙` |
| 23 | `钟离` |
| 25 | `甘雨（椰羊）` |
| 30 | `神里绫华（龟龟）` |
| 33 | `雷电将军（雷神）` |
| 48 | `纳西妲（草神）` |
| 104 | `卡芙卡` |
| 131 | `黄泉` |

## Languages

| String | Meaning |
|--------|---------|
| `中文` | Chinese — auto-wrapped `[ZH]...[ZH]` |
| `日语` | Japanese — auto-wrapped `[JA]...[JA]` |
| `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` | Mixed — provide tags |

Mix format: `[ZH]中文[JA]日本語[ZH]又是中文`

## Whisper Voice

| Param | Normal | Whisper |
|-------|--------|---------|
| noise_scale | 0.6 | **0.3** |
| length_scale | 1.2 | **1.4** |

## Gotchas

1. REST = integer speaker ID. WS = exact Gradio dropdown string. Don't mix them.
2. 卡芙卡 + 中文: fails upstream. Use `日语`.
3. Cold start: 20-40s first request.
4. REST text limit: 500 chars. WS: 100 chars (truncated).
5. `vits_speakers` may timeout if Space sleeping — retry.
