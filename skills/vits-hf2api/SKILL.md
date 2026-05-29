---
name: vits-hf2api
description: "VITS anime/game character TTS (800+ voices from Genshin, Star Rail, Uma Musume, Vocaloid, Fate, SAO, Re:Zero, Demon Slayer, AOT, etc.) via HuggingFace Spaces. Use when you need character voice synthesis - call directly with copy-paste bash/Python functions. Trigger on any anime voice, game character TTS, character name, seiyuu mention, or voice synthesis request."
---

# VITS Character TTS

800+ anime/game character voices. Copy the functions below — done.

## Critical: Upstream API Differences

| Upstream | Type | Session Hash | Speaker Format | Response |
|----------|------|-------------|----------------|----------|
| `ikechan8370/vits-uma-genshin-honkai` | REST `/api/generate/` | No | Gradio dropdown string | `data[1]` = `{"name":"/tmp/x.wav"}` → download `/file={name}` |
| `AHJoong/vits-uma-genshin-honkai` | REST `/api/generate/` | **Required** | Gradio dropdown string | same |
| `OldSecond/vits-uma-genshin-honkai` | REST `/api/generate/` | **Required** | Gradio dropdown string | same |
| `zomehwh/vits-uma-genshin-honkai` | WebSocket `/queue/join` | WS protocol | Gradio dropdown string | base64 inline WAV |

### Speaker: MUST use exact Gradio dropdown strings

- ✅ `"神里绫华（龟龟）"` `"甘雨（椰羊）"` `"派蒙"` `"琴"`
- ❌ Integer IDs (Gradio dropdown index ≠ SPEAKERS dict value)
- ❌ `"神里綾華"` (traditional Chinese 綾 ≠ simplified 绫 in dropdown)
- `resolve_speaker_gradio()` handles string-to-dropdown resolution
- All API calls now use Gradio dropdown string (integer IDs deprecated)

### Language: Gradio dropdown values

| API Key | Gradio String |
|---------|---------------|
| `"zh"` | `"中文"` |
| `"ja"` | `"日语"` (**not** `"日本語"`) |
| `"mix"` | `"中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）"` |

### Retry Chain

ikechan8370（无需 session_hash）→ AHJoong（需 session_hash）→ OldSecond（需 session_hash）→ zomehwh WS（100 字限制）

- 只有 retriable error（timeout/5xx/connection）才重试
- 4xx / bad format 立即 502、不 fallback

> **Limits**: REST primary = 500 chars · WS fallback = 100 chars · Cold start 20-40s · 卡芙カ zh fails

---

## curl 一鍵範例（依上游分類）

### ikechan8370（主要，無需 session_hash）

```bash
# 中文 + 派蒙
curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d '{"fn_index":0,"data":["你好旅行者！","中文","派蒙",0.6,0.668,1.2]}'

# 日语 + 神里绫华（早見沙織）
curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d '{"fn_index":0,"data":["おはようございます","日语","神里绫华（龟龟）",0.6,0.668,1.2]}'

# 日语 + 甘雨（上田麗奈）
curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d '{"fn_index":0,"data":["ふわぁ…朝ですか…","日语","甘雨（椰羊）",0.6,0.668,1.2]}'

# 中日混合
curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d '{"fn_index":0,"data":["[ZH]你好[ZH][JA]こんにちは[JA]","中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）","派蒙",0.6,0.668,1.2]}'
```

Response: `{"data":["生成成功!",{"name":"/tmp/xxx.wav",...}]}` → download with `curl -s "https://...hf.space/file={name}" -o out.wav`

### AHJoong / OldSecond（備援，需 session_hash）

```bash
# 需加 session_hash（任意 11 字元亂數）
SH="test1234567"
curl -sX POST "https://AHJoong-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d "{\"fn_index\":0,\"session_hash\":\"$SH\",\"data\":[\"你好\",\"中文\",\"派蒙\",0.6,0.668,1.2]}"

# OldSecond 格式完全相同
curl -sX POST "https://OldSecond-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d "{\"fn_index\":0,\"session_hash\":\"$SH\",\"data\":[\"おはよう\",\"日语\",\"神里绫华（龟龟）\",0.6,0.668,1.2]}"
```

Response 格式與 ikechan8370 相同（dict file path）。

### zomehwh WS（最後手段，100 字限制）

WS response 是 base64 inline WAV（不需另外下載）：
```python
# WS 需要 Python websockets 庫
import asyncio, json, random, string, base64, websockets
async def ws_tts(text, lang, speaker):
    sh = ''.join(random.choices(string.ascii_letters + string.digits, k=11))
    ws_url = 'wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join'
    async with websockets.connect(ws_url, additional_headers={'User-Agent':'Mozilla/5.0'}) as ws:
        await ws.recv()
        await ws.send(json.dumps({'session_hash':sh, 'fn_index':0}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get('msg') == 'send_data': break
        await ws.send(json.dumps({'data':[text,lang,speaker,0.6,0.668,1.2],'fn_index':0,'session_hash':sh}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get('msg') == 'process_completed':
                return base64.b64decode(msg['output']['data'][1].split(',',1)[1])
```

## 完整 bash 函數（curl only，處理 dict response）

```bash
vits_tts() {
  # Usage: vits_tts "text" [speaker] [lang] [noise] [output]
  local text="${1:?Usage: vits_tts <text> [speaker] [lang] [noise] [output]}"
  local speaker="${2:-神里绫华（龟龟）}"
  local lang="${3:-中文}"
  local noise="${4:-0.6}"
  local out="${5:-vits_output.wav}"
  local result=$(curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
    -H "Content-Type: application/json" \
    -d "{\"fn_index\":0,\"data\":[\"$text\",\"$lang\",\"$speaker\",$noise,0.668,1.2]}")
  if echo "$result" | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(0 if 'data' in d else 1)" 2>/dev/null; then
    local fp=$(echo "$result" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data'][1]
print(d['name'] if isinstance(d,dict) else d)")
    curl -s "https://ikechan8370-vits-uma-genshin-honkai.hf.space/file=$fp" -o "$out"
    echo "Saved: $out ($(wc -c < $out) bytes)" && return 0
  fi
  echo "ERROR: $(echo "$result" | python3 -c "import sys,json;print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null)" >&2
  return 1
}

# vits_tts "你好旅行者！"                          # 神里绫华, 中文
# vits_tts "おやすみなさい" "神里绫华（龟龟）" "日语"  # 神里绫华, 日语
# vits_tts "運命を切り開く" "黄泉" "日语"              # 黄泉, 日语
# vits_tts "夜深了呢…" "甘雨（椰羊）" "中文" 0.3 ganyu.wav  # 甘雨 whisper
```

### Search speakers（curl only）

```bash
vits_speakers() {
  curl -s "https://ikechan8370-vits-uma-genshin-honkai.hf.space/config" | python3 -c "
import sys,json
c=json.load(sys.stdin).get('components',[])
choices=[x['choices']for x in c if x.get('type')=='dropdown'and len(x.get('choices',[]))>100]
if not choices: print('Space sleeping. Retry in 30s.'); exit()
choices=choices[0];q='${1:-}'.lower()
[print(f'{i:>4}  {n}')for i,n in enumerate(choices)if q in n.lower()or not q]
" 2>/dev/null
}

# vits_speakers          # list all 800+
# vits_speakers 神里      # search
```

---

## Python Functions (copy-paste ready)

```python
import aiohttp, json, asyncio, base64, random, string

REST = "https://ikechan8370-vits-uma-genshin-honkai.hf.space"
WS   = "wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join"

async def vits_tts(text: str, speaker: str = "神里绫华（龟龟）", lang: str = "中文",
                    noise: float = 0.6, nsw: float = 0.668, ls: float = 1.2) -> bytes:
    """Primary: REST API (500 chars, Gradio dropdown speaker string). Returns WAV bytes."""
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{REST}/api/generate/",
                json={"data": [text, lang, speaker, noise, nsw, ls]}) as r:
            result = await r.json()
        if "error" in result:
            raise RuntimeError(result["error"])
        file_info = result["data"][1]
        path = file_info["name"] if isinstance(file_info, dict) else file_info
        async with s.get(f"{REST}/file={path}") as r:
            return await r.read()

async def vits_tts_ws(text: str, speaker: str = "神里绫华（龟龟）", lang: str = "中文",
                       noise: float = 0.6, nsw: float = 0.668, ls: float = 1.2) -> bytes:
    """Fallback: WebSocket (100 chars, string speaker name). Requires `websockets` library."""
    import websockets
    if len(text) > 100: text = text[:100]
    sh = ''.join(random.choices(string.ascii_letters + string.digits, k=11))
    async with websockets.connect(WS, additional_headers={"User-Agent":"Mozilla/5.0"}) as ws:
        await ws.recv()
        await ws.send(json.dumps({"session_hash": sh, "fn_index": 0}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("msg") == "send_data": break
        await ws.send(json.dumps({"data":[text,lang,speaker,noise,nsw,ls],"fn_index":0,"session_hash":sh}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("msg") == "process_completed":
                data = msg["output"]["data"]
                if isinstance(data[1], str) and data[1].startswith("data:audio/wav;base64,"):
                    return base64.b64decode(data[1].split(",", 1)[1])
                raise RuntimeError("Unexpected WS output")

async def vits_tts_fallback(text, speaker="神里绫华（龟龟）", ws_speaker="神里绫华（龟龟）", lang="中文", **kw):
    """REST first, auto-fallback to WebSocket."""
    try: return await vits_tts(text, speaker, lang, **kw)
    except: return await vits_tts_ws(text, ws_speaker, lang, **kw)

def vits_tts_sync(text, speaker="神里绫华（龟龟）", **kw):
    return asyncio.run(vits_tts(text, speaker, **kw))
```

### Discover speakers (Python)

```python
async def vits_speakers(search: str = "") -> list:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{REST}/config") as r:
            config = await r.json()
    for c in config["components"]:
        if c.get("type") == "dropdown" and len(c.get("choices",[])) > 100:
            choices = c["choices"]; q = search.lower()
            return [(i,n) for i,n in enumerate(choices) if q in n.lower() or not q]
    return []
```

---

## Speaker Catalog

> **⚠️ 以下清單來自上游 Gradio Space 即時 `/config` 端點，806 個 speaker 中僅列出主要具名角色。**
> 完整列表請用 `./vits-tts --list-speakers`（Go）或 `vits_speakers`（bash）或 `vits_speakers()`（Python）。
> **所有 speaker 必須傳入精確 Gradio dropdown 字串**。

### 原神 Genshin Impact (61)

- `七七`
- `丽莎`
- `久岐忍`
- `九条裟罗`
- `云堇`
- `五郎`
- `优菈`
- `八重神子（神子）`
- `凝光`
- `凯亚`
- `刻晴`
- `北斗`
- `可莉`
- `坎蒂丝`
- `埃洛伊`
- `多莉`
- `夜兰`
- `妮露`
- `安柏`
- `宵宫`
- `托马`
- `提纳里`
- `早柚`
- `枫原万叶（万叶）`
- `柯莱`
- `深渊使徒`
- `温迪`
- `烟绯`
- `珊瑚宫心海（心海，扣扣米）`
- `班尼特`
- `琴`
- `甘雨（椰羊）`
- `申鹤`
- `白术`
- `砂糖`
- `神里绫人（绫人）`
- `神里绫华（龟龟）`
- `空（空哥）`
- `纳西妲（草神）`
- `罗莎莉亚`
- `胡桃`
- `芭芭拉`
- `荒泷一斗（一斗）`
- `荧（荧妹）`
- `莫娜`
- `菲谢尔（皇女）`
- `行秋`
- `诺艾尔（女仆）`
- `赛诺`
- `辛焱`
- `达达利亚（公子）`
- `迪卢克`
- `迪奥娜（猫猫）`
- `重云`
- `钟离`
- `阿贝多`
- `雷泽`
- `雷电将军（雷神）`
- `香菱`
- `魈`
- `鹿野苑平藏`

### 崩坏：星穹铁道 Honkai Star Rail (3)

- `姬子`
- `布洛妮娅`
- `希儿`

### 崩坏3rd Honkai Impact 3rd (38)

- `不灭星锚`
- `丽塔`
- `云墨丹心`
- `人之律者`
- `伊甸`
- `八重樱`
- `卡莲`
- `天元骑英`
- `天穹游侠`
- `姬子`
- `布洛妮娅`
- `希儿`
- `帕朵菲莉丝`
- `幽兰黛尔`
- `德丽莎`
- `断罪影舞`
- `暮光骑士`
- `月下初拥`
- `朔夜观星`
- `格蕾修`
- `梅比乌斯`
- `次生银翼`
- `爱莉希雅`
- `理之律者%26希儿`
- `琪亚娜`
- `空之律者`
- `符华`
- `维尔薇`
- `芽衣`
- `莉莉娅`
- `萝莎莉娅`
- `薪炎之律者`
- `识之律者`
- `迷城骇兔`
- `阿波尼亚`
- `雷之律者`
- `魇夜星渊`
- `黑希儿`

### 赛马娘 Uma Musume (28)

- `东海帝皇（帝宝，帝王）`
- `丸善斯基`
- `优秀素质`
- `北部玄驹`
- `名将怒涛（名将户仁）`
- `大和赤骥`
- `大树快车`
- `好歌剧`
- `富士奇迹`
- `小栗帽`
- `帝王光辉`
- `待兼诗歌剧`
- `无声铃鹿`
- `春丽（乌拉拉）`
- `气槽`
- `特别周`
- `目白多伯`
- `目白赖恩`
- `目白麦昆`
- `米浴`
- `草上飞`
- `菱亚马逊`
- `菱曙`
- `超级小海湾`
- `醒目飞鹰（寄寄子）`
- `里见光钻（萨托诺金刚石）`
- `鲁道夫象征（皇帝）`
- `黄金船`

## Languages

| String | Meaning |
|--------|---------|
| `中文` | Chinese — auto `[ZH]...[ZH]` |
| `日语` | Japanese — auto `[JA]...[JA]` |
| `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` | Mixed |

Mix: `[ZH]中文[ZH][JA]日本語[JA]` (each language block wrapped with opening+closing markers)

## Whisper Voice

| Param | Normal | Whisper |
|-------|--------|---------|
| noise_scale | 0.6 | **0.3** |
| length_scale | 1.2 | **1.4** |

## Gotchas

1. **Speaker must match Gradio dropdown string exactly.** Use the resolved display name, not integer IDs.
2. **卡芙カ + 中文 fails** — use `日语`.
3. **Cold start 20-40s** — first request after Space idle.
4. **500 chars REST / 100 chars WS** — text truncated on fallback.
5. `vits_speakers` needs Space awake — retry if timeout.

## Retry & Backup

The wrapper API uses a multi-URL retry chain for REST calls:

| Priority | Space URL | Type |
|----------|-----------|------|
| 1 | `ikechan8370/vits-uma-genshin-honkai` | REST (primary) |
| 2 | `AHJoong/vits-uma-genshin-honkai` | REST (backup 1) |
| 3 | `OldSecond/vits-uma-genshin-honkai` | REST (backup 2) |
| Last | `zomehwh/vits-uma-genshin-honkai` | WebSocket (fallback, 100 chars) |

Only retriable errors trigger fallback (timeout, 5xx, connection). Non-retriable errors (4xx, bad format) return 502 immediately.

## Per-Character Models

`zomehwh/vits-models-genshin-bh3` provides dedicated models per character:

| Key | Character | Language | sid |
|-----|-----------|----------|-----|
| `ayaka-jp` | 神里绫华 | 日语 | 303 |
| `nahida-jp` | 纳西妲 | 日语 | 0 |
| `abyssinvoker` | 深渊使徒 | 中文 | 94 |
| `keqing` | 刻晴 | 中文 | 115 |
| `eula` | 优菈 | 中文 | 124 |
| `bronya` | 布洛妮娅 | 中文 | 193 |
| `theresa` | 德丽莎 | 中文 | 193 |

Route by passing `voice=ayaka-jp` (or other key). Standard speakers still use the 804-speaker Space.

---

## Go CLI (vits-tts)

Pre-compiled static binary (`vits-tts`) bundled in this skill directory. Ready to use immediately — no build step needed.

```bash
# Direct use from skill directory
./vits-tts "こんにちは、旅人さん"

# Or build from source
cd vits-hf2api-go && CGO_ENABLED=0 go build -ldflags="-s -w" -o vits-tts .
```

### Quick Start

```bash
# Default: 神里绫华（龟龟）[早見沙織], mix language, auto-named output
./vits-tts "こんにちは、旅人さん"

# Specify speaker (Chinese name, alias, or Gradio dropdown string)
./vits-tts "你好世界！" -s 派蒙 -l zh -o paimon.wav

# Use English alias
./vits-tts "やあ" -s ayaka -l ja
```

### Speaker Resolution

Accepts three formats (resolved in order):
1. **Chinese short name**: `神里绫华`, `甘雨`, `黄泉`
2. **English/romaji alias**: `ayaka`, `rem`, `hutao`, `keqing`
3. **Exact Gradio dropdown string**: `神里绫华（龟龟）`, `甘雨（椰羊）`

Default: `神里绫华（龟龟）` (早見沙織 / Hayami Saori — Kamisato Ayaka, Genshin Impact)

```bash
# Discovery
./vits-tts --list-speakers              # all 491 named characters
./vits-tts --search-speakers 神里        # substring search (name or alias)
./vits-tts --search-speakers ayaka       # finds 神里绫华
```

### Language

| Flag value | Gradio string sent to API |
|-----------|--------------------------|
| `zh` | `中文` |
| `ja` | `日语` |
| `mix` (default) | `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` |

```bash
./vits-tts --list-languages    # show available options
```

Mix format: `[ZH]中文部分[ZH][JA]日本語部分[JA]` (each language block wrapped with matching markers)

### Voice Parameters

| Parameter | Default | Range | Whisper preset |
|-----------|---------|-------|---------------|
| `--noise-scale` | 0.6 | 0.1–1.0 | 0.3 |
| `--noise-scale-w` | 0.668 | 0.1–1.0 | 0.668 (unchanged) |
| `--length-scale` | 1.2 | 0.1–2.0 | 1.4 |

```bash
# Whisper mode (soft voice) — preset for noise=0.3, length=1.4
./vits-tts "夜深了呢…该休息了" -s 甘雨 --whisper

# Speed control — maps to length_scale = 1.0 / speed
./vits-tts "速く話します" -s ayaka -l ja --speed 1.8    # faster
./vits-tts "ゆっくり話します" -s ayaka -l ja --speed 0.7  # slower

# Manual parameter control
./vits-tts "text" --noise-scale 0.3 --length-scale 1.4    # manual whisper
```

### Output

Default filename derived from first 20 alphanumeric/unicode characters of input text:
- `こんにちは、旅人さん` → `こんにちは旅人さん.wav`
- `你好世界！` → `你好世界_.wav`
- `test` → `test.wav`
- Empty → `vits_output.wav`

```bash
./vits-tts "text" -o /path/to/output.wav    # explicit path
./vits-tts "text" -q                          # suppress info output (WAV to stdout would need pipe)
```

### Text Limits

| Path | Limit | Behavior |
|------|-------|----------|
| REST (ikechan8370, AHJoong, OldSecond) | **500 chars** (rune-safe) | Truncated automatically |
| WebSocket fallback (zomehwh) | **100 chars** (rune-safe) | Truncated automatically in retry layer |

Both limits count Unicode characters (runes), not bytes. CJK text is truncated correctly.

### Upstream Override

```bash
# Use a specific HuggingFace Space directly (skips retry chain)
./vits-tts "text" --url https://my-custom-space.hf.space

# Force WebSocket fallback
./vits-tts "text" --url wss://zomehwh-vits-uma-genshin-honkai.hf.space
```

### Retry Chain (automatic when no --url)

```
ikechan8370 (REST, no session_hash)
  ↓ on timeout/5xx/connection
AHJoong (REST, session_hash required)
  ↓ on timeout/5xx/connection
OldSecond (REST, session_hash required)
  ↓ on timeout/5xx/connection
zomehwh (WebSocket, 100 char limit)
```

- Retries ONLY on: timeout, HTTP 5xx, connection refused/reset, DNS failure
- **4xx errors fail immediately** — no fallback
- When sending via `vits-tts` output, "Synthesized via REST" or "Synthesized via WebSocket fallback" indicates which path was used

### Complete Flag Reference

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t, --text` | string | (positional) | Text to synthesize (can also pass as first positional arg) |
| `-s, --speaker` | string | `神里绫华（龟龟）` | Speaker: Chinese name, alias, or Gradio dropdown string |
| `-l, --language` | string | `mix` | Language: `zh`, `ja`, or `mix` |
| `-o, --output` | string | auto-derived | Output WAV file path |
| `--noise-scale` | float | `0.6` | Noise scale (0.1–1.0) |
| `--noise-scale-w` | float | `0.668` | Noise scale width (0.1–1.0) |
| `--length-scale` | float | `1.2` | Length scale (0.1–2.0) |
| `--speed` | float | — | Speed override: `length_scale = 1.0 / speed` |
| `--whisper` | bool | false | Preset: noise=0.3, length=1.4 |
| `--timeout` | duration | `2m0s` | Request timeout (e.g. `30s`, `1m`) |
| `--url` | string | — | Override upstream base URL (skips retry chain) |
| `-q, --quiet` | bool | false | Suppress info messages (errors still go to stderr) |
| `--list-speakers` | bool | — | Print all 491 speaker names and exit |
| `--search-speakers` | string | — | Search speakers by substring (name or alias) and exit |
| `--list-languages` | bool | — | Print language options and exit |

### Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| `all upstreams failed` | All 4 upstreams down or cold-starting | Retry in 30–60s (HF Spaces sleep when idle) |
| `unknown speaker 'X'` | Name not in speaker map or alias list | Use `--search-speakers` to find correct name |
| `context deadline exceeded` | HF Space cold start (20–60s) or slow GPU | Increase `--timeout 3m` |
| Small WAV file (<2KB) | Upstream returned error page as "audio" | Check if Space is awake; try different upstream with `--url` |
| WS fallback: short audio | Text truncated to 100 chars | Use shorter text or wait for REST upstream to recover |
