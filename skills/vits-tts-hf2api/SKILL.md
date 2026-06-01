---
name: vits-tts-hf2api
description: "VITS Chinese/Japanese anime + game character TTS via HuggingFace Spaces (804 voices, primarily Genshin Impact 原神, Honkai Impact 3rd 崩壞3, and Uma Musume 賽馬娘 — plus the seiyuu line-up for each Genshin character). Use when the user wants to synthesize speech as a Genshin/HI3/Uma Musume character or names a specific seiyuu (早見沙織, 上田麗奈, 高桥李依, etc.). Three drop-in interfaces: a bundled ./vits-tts Go binary (recommended, handles aliases + retry), Python aiohttp helpers, and copy-paste curl/bash. Trigger on: Genshin/HI3/Uma Musume character name, Genshin-cast seiyuu name, 'VITS', '中日 TTS', 'anime voice synthesis', 'character TTS', or any explicit request for one of the catalog voices."
---

# VITS Character TTS

804 voices from the public ikechan8370/AHJoong/OldSecond/zomehwh HuggingFace Spaces. **The fastest path is the bundled `./vits-tts` Go binary** — it ships every alias and resolves seiyuu names for you. Bash and Python are documented below for environments where a binary isn't appropriate.

## Coverage (read this before triggering)

| IP | Coverage | Notes |
|----|----------|-------|
| **原神 Genshin Impact** | CN dub for every released character (up to Sumeru) + JP dub for the same characters (prefix `日语`) | Newer characters past ~3.5 (芙寧娜, 那維萊特, 雷諾爾, etc.) are **NOT** present |
| **崩壞3rd Honkai Impact 3rd** | Major valkyries (琪亚娜, 布洛妮娅, 姬子, 德丽莎, …) +律者 forms | CN only |
| **賽馬娘 Uma Musume** | ~80 horse-girls (特别周, 无声铃鹿, 东海帝皇 … 黄金船) | CN only |
| Genshin NPCs / 千岩军 / 愚人众 | Hundreds of bit-part voices | CN only |
| **NOT supported** | Star Rail, Re:Zero, SAO, Demon Slayer, AOT, Fate, Vocaloid, Wuthering Waves | Do not promise these — agents will hit "unknown speaker". |

If a request names a character outside this set, decline early or use a different TTS skill.

## Upstream API map

Four sibling HF Spaces serve the same VITS model. The Go binary tries them in this order:

| # | Upstream | Transport | `session_hash` | Cold-start | Text limit |
|---|----------|-----------|---------------|------------|------------|
| 1 | `ikechan8370-vits-uma-genshin-honkai.hf.space` | REST `/api/generate/` | optional | warmest | 500 runes |
| 2 | `AHJoong-vits-uma-genshin-honkai.hf.space` | REST | **required** (HTTP 422 otherwise) | 20-40 s | 500 runes |
| 3 | `OldSecond-vits-uma-genshin-honkai.hf.space` | REST | **required** | sometimes returns empty body when cold | 500 runes |
| 4 | `zomehwh-vits-uma-genshin-honkai.hf.space` | **WebSocket only** (`/queue/join`) — REST path returns `{"detail":"Not authorized to skip the queue"}` | sent in queue protocol | warmest | **100 runes** |

All four expose the **same 804 Gradio dropdown choices** — once you know the exact dropdown string, every upstream understands it.

### REST request shape (any of the three REST upstreams)

```json
POST /api/generate/
Content-Type: application/json
{
  "fn_index": 0,
  "session_hash": "abcdef12345",        // required for AHJoong/OldSecond only
  "data": [
    "<text>",                            // [0] text
    "<language Gradio string>",          // [1] one of: 中文 / 日语 / 中日混合（...）
    "<speaker Gradio string>",           // [2] EXACT upstream choice (see catalog)
    0.6,                                 // [3] noise_scale  0.1–1.0
    0.668,                               // [4] noise_scale_w 0.1–1.0
    1.2                                  // [5] length_scale 0.1–2.0 (inverse of speed)
  ]
}
```

Success response (HTTP 200):

```json
{
  "data": [
    "生成成功!",
    {"name": "/tmp/tmpXXX/tmpYYY.wav", "data": null, "is_file": true},
    "生成耗时 0.83 s"
  ],
  "is_generating": false, "duration": 0.83, "average_duration": 4.17
}
```

Then fetch the audio with `GET /file=<that path>`.

### WebSocket protocol (zomehwh)

```
client → wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join
server: {"msg":"send_hash"}
client: {"session_hash":"<11 chars>", "fn_index":0}
server: {"msg":"estimation", ...}            # zero or more, ignore
server: {"msg":"send_data"}
client: {"data":[...], "fn_index":0, "session_hash":"<same>"}
server: {"msg":"process_starts"}              # ignore
server: {"msg":"process_completed", "output":{"data":["生成成功!", "data:audio/wav;base64,..."]}}
```

`output.data[1]` is a `data:audio/wav;base64,...` URI — base64-decode the part after the comma.

## ⚠️ Five gotchas every first-time caller hits

These produce *correct-looking* output that is actually wrong. Memorize them.

### 1. Speaker MUST be the exact Gradio dropdown string

- ✅ `"派蒙"` `"甘雨（椰羊）"` `"日语神里绫华（早见沙织）"` `"东海帝皇（帝宝，帝王）"`
- ❌ Integer IDs (`0`, `13`, `303`) — the dropdown index is not stable
- ❌ `"神里綾華"` (Traditional 綾) — upstream uses Simplified `绫`
- ❌ `"派蒙（古贺葵）"` — invented name, doesn't exist (the real JP voice is `日语派蒙（古贺葵）`)
- ❌ `"黄泉"` `"卡芙卡"` `"流萤"` — Star Rail, not in this Space

When in doubt, run `./vits-tts --search-speakers <substring>` or `curl /config` (see the discovery section).

### 2. Language values are Gradio dropdown strings, in Simplified Chinese

| Key | Gradio string (what you send) | Notes |
|-----|------------------------------|-------|
| `zh` | `中文` | Use with CN voices, or JP voices that happen to accept CN text (often degrades pronunciation) |
| `ja` | `日语` | Simplified `日语`, **NOT** `日本語` |
| `mix` | `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` | See gotcha #3 |

### 3. `mix` requires explicit `[ZH]...[ZH]` / `[JA]...[JA]` markers

Without markers, every upstream returns a **556-byte syntactically-valid WAV** that contains no audible speech. The Go binary detects this and warns; bash/Python do not. **Default to `中文` or `日语` for plain text — only use `mix` when you actually have both languages and have wrapped them.**

```text
# CORRECT mix input
[ZH]你好旅行者[ZH][JA]こんにちは、旅人さん[JA]

# WRONG — produces 556-byte empty WAV
こんにちは、旅人さん                            # raw JP, mix language
```

### 4. JP-only voices (`日语...` prefix) often reject Chinese text

Sending `"你好"` to `日语甘雨（上田丽奈）` gives **HTTP 500 across all four upstreams**. Pair JP voices with `日语` text, or use the CN counterpart (`甘雨（椰羊）` for 甘雨).

### 5. Cold-start latency is real

First request after a Space sleeps takes 20-40 s. The retry chain handles this transparently. If `--list-speakers` from the API returns empty, give it 30 s and retry.

---

## Path A — `./vits-tts` Go binary (recommended)

Pre-compiled static binary at the skill root (~6 MB, zero runtime deps, embeds the speaker JSON).

```bash
# Quickest possible call: default speaker = 日语神里绫华（早见沙织）, language = ja
./vits-tts "こんにちは、旅人さん"
# → こんにちは旅人さん.wav

# JP voice + seiyuu's signature character
./vits-tts "やあ、旅人" -s ayaka -l ja              # alias → 日语神里绫华（早见沙织）
./vits-tts "おはよう" -s 日语甘雨（上田丽奈） -l ja

# CN voice + Chinese text
./vits-tts "你好旅行者" -s 派蒙 -l zh
./vits-tts "钟离老师，再来一次" -s 钟离 -l zh

# Uma Musume
./vits-tts "今天也要努力训练！" -s 特别周 -l zh
./vits-tts "胜利属于我！" -s 东海帝皇（帝宝，帝王） -l zh

# Honkai 3rd
./vits-tts "为了爱莉希雅" -s 爱莉希雅 -l zh

# Mix language (note the markers — required)
./vits-tts "[ZH]你好[ZH][JA]こんにちは[JA]" -l mix

# Whisper preset (soft voice: noise=0.3, length=1.4)
./vits-tts "ふわぁ…朝ですか…" -s 日语甘雨（上田丽奈） -l ja --whisper

# Speed control: length_scale = 1.0 / speed
./vits-tts "早く話します！" -s 日语胡桃（高桥李依） -l ja --speed 1.6   # faster
./vits-tts "ゆっくり話します…" -s ayaka -l ja --speed 0.7              # slower

# Custom output path + quiet
./vits-tts "test" -o /tmp/test.wav -q

# Override upstream (skip retry chain). REST URL → REST only; wss:// → WS only.
./vits-tts "test" --url https://AHJoong-vits-uma-genshin-honkai.hf.space
./vits-tts "test" --url wss://zomehwh-vits-uma-genshin-honkai.hf.space
```

### Speaker resolution order (Go binary)

1. **Exact upstream choice** wins. `-s 派蒙` → CN voice `派蒙`.
2. **Case-insensitive exact** upstream choice.
3. **Alias** match (e.g. `ayaka`, `ganyu`, `paimon`, `甘雨`). Aliases typically point to the **JP** voice.
4. **Prefix** match against upstream choices (≥2 chars).
5. **Substring** match (last resort, deterministic).

If `-s 派蒙 -l zh` and `-s paimon -l ja` both work — yes, the first is the CN voice, the second is the JP voice. That's by design.

### Discovery commands

```bash
./vits-tts --list-speakers                  # all 804, sorted
./vits-tts --list-speakers | grep ^日语     # only JP voices
./vits-tts --search-speakers 神里            # CN + JP variants of 神里绫华
./vits-tts --search-speakers 上田丽奈        # search by seiyuu
./vits-tts --search-speakers ayaka           # search by alias
./vits-tts --list-languages
```

### Complete flag reference

| Flag | Default | Description |
|------|---------|-------------|
| `-t, --text` | (positional) | Text to synthesize |
| `-s, --speaker` | `日语神里绫华（早见沙织）` | Exact Gradio string, CN short name, or alias |
| `-l, --language` | `ja` | `zh` / `ja` / `mix` (or the Gradio value verbatim) |
| `-o, --output` | derived from first 20 runes | Output WAV path |
| `--noise-scale` | `0.6` | 0.1–1.0 |
| `--noise-scale-w` | `0.668` | 0.1–1.0 |
| `--length-scale` | `1.2` | 0.1–2.0 (inverse of speed) |
| `--speed` | — | Convenience: `length_scale = 1.0 / speed` |
| `--whisper` | false | Preset noise=0.3, length=1.4 |
| `--timeout` | `2m0s` | Per-request timeout |
| `--url` | — | Override upstream base URL |
| `-q, --quiet` | false | Suppress info on stderr |
| `--list-speakers` | — | Print every speaker, sorted |
| `--search-speakers` | — | Print speakers whose name or alias contains the query |
| `--list-languages` | — | Print supported language keys |
| `--version` | — | Print version |

### Default speaker — and why

`日语神里绫华（早见沙织）` (早見沙織 / Hayami Saori — Kamisato Ayaka JP voice). The default language is `ja` so the pairing works out of the box.

### Rebuild from source

```bash
cd src/go && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../../vits-tts ./cmd/vits-tts/
```

The speaker catalog is embedded via `//go:embed`. To refresh from upstream:

```bash
python3 update_speakers.py    # writes BOTH references/ and src/go/internal/speaker/
cd src/go && go build -o ../../vits-tts ./cmd/vits-tts/
```

---

## Path B — copy-paste bash (curl only)

```bash
# Function: synth one line via ikechan8370, save WAV. No aliases — use exact Gradio strings.
vits_tts() {
  # vits_tts <text> [speaker] [lang] [noise] [output]
  local text="${1:?Usage: vits_tts <text> [speaker] [lang_gradio_value] [noise] [output]}"
  local speaker="${2:-日语神里绫华（早见沙织）}"
  local lang="${3:-日语}"          # use 中文 / 日语 / 中日混合（...）
  local noise="${4:-0.6}"
  local out="${5:-vits_output.wav}"
  local res
  res=$(curl -sm 120 -X POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
    -H "Content-Type: application/json" \
    -d "{\"fn_index\":0,\"data\":[\"$text\",\"$lang\",\"$speaker\",$noise,0.668,1.2]}")
  local fp
  fp=$(printf '%s' "$res" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
except Exception:
  sys.exit(2)
if 'error' in d and not d.get('data'):
  print('ERROR:', d.get('error'), file=sys.stderr); sys.exit(1)
f = d['data'][1]
print(f['name'] if isinstance(f, dict) else f)
") || { echo "Bad upstream response: $res" >&2; return 1; }
  curl -sm 60 "https://ikechan8370-vits-uma-genshin-honkai.hf.space/file=$fp" -o "$out"
  local sz; sz=$(wc -c < "$out")
  if [ "$sz" -lt 2048 ]; then
    echo "Warning: $out is only $sz bytes — likely empty WAV (mix without markers? JP voice + CN text?)." >&2
  fi
  echo "Saved: $out ($sz bytes)"
}

# Examples — every one of these has been verified against upstream
vits_tts "こんにちは、旅人さん"                                    # default
vits_tts "おはよう"            "日语甘雨（上田丽奈）"   "日语"          # JP voice
vits_tts "你好旅行者"          "派蒙"                  "中文"          # CN voice
vits_tts "今天也要努力训练！"  "特别周"                "中文"          # Uma Musume
vits_tts "[ZH]你好[ZH][JA]こんにちは[JA]" "日语神里绫华（早见沙织）" \
        "中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）"   # mix
vits_tts "夜深了呢…" "甘雨（椰羊）" "中文" 0.3 ganyu_whisper.wav      # whisper
```

### Search speakers (curl only)

```bash
vits_speakers() {
  # vits_speakers [query]
  curl -sm 30 "https://ikechan8370-vits-uma-genshin-honkai.hf.space/config" \
    | python3 -c "
import sys, json
c = json.load(sys.stdin).get('components', [])
ch = next((x.get('choices') or x.get('props',{}).get('choices') for x in c
           if x.get('type')=='dropdown' and len(x.get('choices') or x.get('props',{}).get('choices') or [])>100), [])
if not ch: print('Space sleeping — retry in 30s.', file=sys.stderr); sys.exit(2)
q = '${1:-}'.lower()
for i, n in enumerate(ch):
  if not q or q in n.lower():
    print(f'{i:>4}  {n}')
"
}
# vits_speakers              # all 804
# vits_speakers 神里          # CN + JP variants
# vits_speakers 上田丽奈      # by seiyuu
```

---

## Path C — Python (`aiohttp` + `websockets`)

```python
import aiohttp, asyncio, base64, json, random, string

REST_URLS = [
    ("https://ikechan8370-vits-uma-genshin-honkai.hf.space", False),  # session_hash NOT required
    ("https://AHJoong-vits-uma-genshin-honkai.hf.space",    True),    # required
    ("https://OldSecond-vits-uma-genshin-honkai.hf.space",  True),    # required
]
WS_URL = "wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join"


def _session_hash() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=11))


async def vits_tts(
    text: str,
    speaker: str = "日语神里绫华（早见沙织）",
    language: str = "日语",         # use 中文 / 日语 / 中日混合（...）
    noise_scale: float = 0.6,
    noise_scale_w: float = 0.668,
    length_scale: float = 1.2,
    timeout: float = 120.0,
) -> bytes:
    """REST path with retry. fn_index=0 is required for AHJoong/OldSecond."""
    payload_data = [text, language, speaker, noise_scale, noise_scale_w, length_scale]
    last_err: Exception | None = None
    async with aiohttp.ClientSession() as s:
        for url, needs_hash in REST_URLS:
            payload = {"fn_index": 0, "data": payload_data}
            if needs_hash:
                payload["session_hash"] = _session_hash()
            try:
                async with s.post(f"{url}/api/generate/", json=payload,
                                  timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                    if r.status == 422:           # missing session_hash on a backup
                        last_err = RuntimeError(f"{url} 422"); continue
                    if r.status >= 500:           # transient / model rejected input
                        last_err = RuntimeError(f"{url} {r.status}"); continue
                    body = await r.json()
                if not body.get("data"):
                    last_err = RuntimeError(f"{url} empty data"); continue
                info = body["data"][1]
                path = info["name"] if isinstance(info, dict) else info
                async with s.get(f"{url}/file={path}",
                                 timeout=aiohttp.ClientTimeout(total=timeout)) as fr:
                    audio = await fr.read()
                if audio[:4] == b"RIFF" and len(audio) < 2048:
                    raise RuntimeError("upstream returned a 556-byte empty WAV "
                                       "(mix without [ZH]/[JA] markers? JP voice + CN text?)")
                return audio
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_err = e; continue
        return await vits_tts_ws(text, speaker, language,
                                 noise_scale, noise_scale_w, length_scale, timeout)


async def vits_tts_ws(text, speaker, language, noise_scale, noise_scale_w,
                       length_scale, timeout: float = 120.0) -> bytes:
    """WebSocket fallback (100-char limit, base64 inline WAV)."""
    import websockets
    if len(text) > 100:
        text = text[:100]
    sh = _session_hash()
    async with websockets.connect(WS_URL, additional_headers={
        "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/143 Safari/537"
    }) as ws:
        while True:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout))
            if m.get("msg") == "send_hash":
                await ws.send(json.dumps({"session_hash": sh, "fn_index": 0})); break
        while True:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout))
            if m.get("msg") == "send_data":
                await ws.send(json.dumps({
                    "fn_index": 0, "session_hash": sh,
                    "data": [text, language, speaker, noise_scale, noise_scale_w, length_scale],
                })); break
        while True:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout))
            if m.get("msg") == "process_completed":
                data = m["output"]["data"][1]
                if isinstance(data, str) and data.startswith("data:audio/wav;base64,"):
                    return base64.b64decode(data.split(",", 1)[1])
                raise RuntimeError(f"unexpected WS payload: {data!r:.120}")


def vits_tts_sync(text: str, **kw) -> bytes:
    return asyncio.run(vits_tts(text, **kw))


# Discovery
async def vits_speakers(search: str = "") -> list[str]:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{REST_URLS[0][0]}/config") as r:
            cfg = await r.json()
    for c in cfg.get("components", []):
        choices = c.get("choices") or c.get("props", {}).get("choices") or []
        if c.get("type") == "dropdown" and len(choices) > 100:
            q = search.lower()
            return [n for n in choices if not q or q in n.lower()]
    return []
```

Usage:

```python
audio = asyncio.run(vits_tts("こんにちは、旅人さん"))
open("ayaka.wav", "wb").write(audio)
```

The bundled `vits_tts_hf2api` Python package wraps the same logic behind an OpenAI-shaped REST server (`/v1/audio/speech`) — see `src/python/vits_tts_hf2api/` if you need that.

---

## Speaker catalog (representative subset)

The complete list lives in [`references/vits_speakers.json`](./references/vits_speakers.json) (804 entries). The Go binary embeds it; run `./vits-tts --list-speakers` for the full set. The aggregations below are the highest-traffic IDs.

### Genshin — CN voices (subset)

`派蒙`, `琴`, `丽莎`, `凯亚`, `安柏`, `温迪`, `迪卢克`, `芭芭拉`, `雷泽`, `香菱`, `北斗`, `行秋`, `魈`, `凝光`, `可莉`, `钟离`, `菲谢尔（皇女）`, `班尼特`, `七七`, `重云`, `甘雨（椰羊）`, `阿贝多`, `迪奥娜（猫猫）`, `莫娜`, `刻晴`, `砂糖`, `辛焱`, `罗莎莉亚`, `胡桃`, `烟绯`, `宵宫`, `托马`, `优菈`, `早柚`, `五郎`, `九条裟罗`, `埃洛伊`, `申鹤`, `夜兰`, `久岐忍`, `提纳里`, `柯莱`, `多莉`, `云堇`, `纳西妲（草神）`, `妮露`, `赛诺`, `坎蒂丝`, `神里绫华（龟龟）`, `神里绫人（绫人）`, `荒泷一斗（一斗）`, `雷电将军（雷神）`, `珊瑚宫心海（心海，扣扣米）`, `八重神子（神子）`, `达达利亚（公子）`, `空（空哥）`, `荧（荧妹）`, `枫原万叶（万叶）`, `鹿野苑平藏`, `白术`

### Genshin — JP voices (CN char ⇒ JP seiyuu)

| CN char | JP voice (use exactly) | Seiyuu |
|---------|------------------------|--------|
| 神里绫华 | `日语神里绫华（早见沙织）` | 早見沙織 |
| 甘雨 | `日语甘雨（上田丽奈）` | 上田麗奈 |
| 胡桃 | `日语胡桃（高桥李依）` | 高橋李依 |
| 八重神子 | `日语八重神子（佐仓绫音）` | 佐倉綾音 |
| 雷电将军 | `日语雷电将军（泽城美雪）` | 澤城みゆき |
| 钟离 | `日语钟离（前野智昭）` | 前野智昭 |
| 派蒙 | `日语派蒙（古贺葵）` | 古賀葵 |
| 纳西妲 | `日语纳西妲（田村由加莉）` | 田村ゆかり |
| 万叶 | `日语万叶（岛崎信长）` | 島﨑信長 |
| 优菈 | `日语优菈（佐藤利奈）` | 佐藤利奈 |
| 莫娜 | `日语莫娜（小原好美）` | 小原好美 |
| 温迪 | `日语温迪（村濑步）` | 村瀬歩 |
| 魈 | `日语魈（松冈祯丞）` | 松岡禎丞 |
| 可莉 | `日语可莉（久野美咲）` | 久野美咲 |
| 凯亚 | `日语凯亚（鸟海浩辅）` | 鳥海浩輔 |
| 迪卢克 | `日语迪卢克（小野贤章）` | 小野賢章 |
| 阿贝多 | `日语阿贝多（野岛健儿）` | 野島健児 |
| 达达利亚 | `日语达达利亚（木村良平）` | 木村良平 |
| 神里绫人 | `日语神里绫人（石田彰）` | 石田彰 |

> The reverse lookup (`聲優 → Gradio 值`) is in `references/seiyuu_table.md`. The Go binary also indexes seiyuu names — `./vits-tts --search-speakers 上田` finds 上田麗奈's voices.

### Honkai Impact 3rd (subset)

`琪亚娜`, `布洛妮娅`, `姬子`, `德丽莎`, `卡莲`, `丽塔`, `芽衣`, `符华`, `希儿`, `黑希儿`, `爱莉希雅`, `阿波尼亚`, `维尔薇`, `帕朵菲莉丝`, `戴因斯雷布`, `识之律者`, `理之律者`, `雷之律者`, `空之律者`, `薪炎之律者`, `人之律者`, `天元骑英`, `幽兰黛尔`, `圣剑幽兰黛尔`, `梅比乌斯`, `渡鸦`, `苏西`, `若水`, `云墨丹心`, `次生银翼`

### Uma Musume (subset)

`特别周`, `无声铃鹿`, `东海帝皇（帝宝，帝王）`, `丸善斯基`, `富士奇迹`, `小栗帽`, `黄金船`, `伏特加`, `大和赤骥`, `大树快车`, `草上飞`, `菱亚马逊`, `目白麦昆`, `神鹰`, `好歌剧`, `成田白仁`, `鲁道夫象征（皇帝）`, `气槽`, `爱丽数码`, `星云天空`, `玉藻十字`, `美妙姿势`, `琵琶晨光`, `摩耶重炮`, `美浦波旁`, `荣进闪耀`, `胜利奖券`, `黄金城（黄金城市）`, `醒目飞鹰（寄寄子）`, `双涡轮（两立直，两喷射，二锅头，逆喷射）`, `骏川手纲（绿帽恶魔）`

### Voice parameters

| Param | Normal | Whisper preset |
|-------|--------|----------------|
| `noise_scale` | 0.6 | **0.3** |
| `noise_scale_w` | 0.668 | 0.668 (unchanged) |
| `length_scale` | 1.2 | **1.4** |

`length_scale` is the **inverse of speed**: 1.0 = normal, 1.5 = slower, 0.7 = faster. The `--speed` flag (Go) and SDK helpers convert for you.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `unknown speaker 'X'` | Name not in upstream choices | `./vits-tts --search-speakers <substring>`; check the catalog file |
| 556 / ~1 KB WAV, no audible speech | `mix` without `[ZH]/[JA]` markers; or JP voice + CN text on a degraded path | Use `-l zh` / `-l ja`; wrap mix segments correctly |
| `all upstreams failed`, all returning 500 | JP-only speaker (prefix `日语`) given Chinese text | Switch to `-l ja`, or use the CN variant (drop `日语` prefix) |
| `HTTP 422` from a backup | `session_hash` missing | Backup REST requires it; the Go binary and the helpers do this for you |
| Empty body, no error | OldSecond cold-starting | Wait 30 s and retry; chain falls through to AHJoong / WS |
| `context deadline exceeded` | First wake-up of a sleeping Space | `--timeout 3m` or just retry |
| Tiny WAV file, agent reports success | All upstreams returned the degenerate WAV | Check the warnings on stderr; pick a different speaker/language combo |
| Chinese text sounds like garbled Japanese | JP voice forced to read CN | Use the CN counterpart (no `日语` prefix) |

---

## "Per-character" Spaces — current status

`zomehwh/vits-models-genshin-bh3` hosts a *different* model with per-character endpoints addressed by `fn_index` and integer `sid` parameters. The bundled Python package (`vits_tts_hf2api`) supports it through `config.VITS_MODELS_URL` when the caller resolves a speaker via `speakers.resolve_vits_model_speaker`. The Go binary and the copy-paste recipes above do **NOT** target this Space — they exclusively use the 804-speaker shared model. If you need a per-character model, run the Python server (`python -m vits_tts_hf2api`) and POST to `/v1/audio/speech`.

## Maintainer notes

For architecture, update procedures, and a full upstream-behavior log, see [`README.md`](./README.md). To refresh the speaker list:

```bash
python3 update_speakers.py    # rewrites BOTH references/ and src/go/internal/speaker/
cd src/go && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../../vits-tts ./cmd/vits-tts/
```
