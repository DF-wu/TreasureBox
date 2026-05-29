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

> **⚠️ 以下所有 Gradio 值來自上游 `/config` 即時端點。完整列表：`./vits-tts --list-speakers`**
> **解析規則**：`ResolveSpeaker(name)` → Gradio 精確字串 → API `data` array 第 3 個參數。
> **預設 speaker**：`日语神里绫华（早见沙织）`（早見沙織／Hayami Saori — 原神·神里綾華 JP voice）

---

### 原神 Genshin Impact

| Gradio 值 (用於 API) | 類型 | 聲優 |
|---|---|---|
| `七七` | 🇨🇳 CN | — |
| `丽莎` | 🇨🇳 CN | — |
| `久岐忍` | 🇨🇳 CN | — |
| `九条裟罗` | 🇨🇳 CN | — |
| `云堇` | 🇨🇳 CN | — |
| `五郎` | 🇨🇳 CN | — |
| `优菈` | 🇨🇳 CN | — |
| `八重神子（神子）` | 🇨🇳 CN | — |
| `凝光` | 🇨🇳 CN | — |
| `凝光助手` | 🇨🇳 CN | — |
| `凯亚` | 🇨🇳 CN | — |
| `刻晴` | 🇨🇳 CN | — |
| `北斗` | 🇨🇳 CN | — |
| `可莉` | 🇨🇳 CN | — |
| `坎蒂丝` | 🇨🇳 CN | — |
| `埃洛伊` | 🇨🇳 CN | — |
| `多莉` | 🇨🇳 CN | — |
| `夜兰` | 🇨🇳 CN | — |
| `妮露` | 🇨🇳 CN | — |
| `安柏` | 🇨🇳 CN | — |
| `宵宫` | 🇨🇳 CN | — |
| `托马` | 🇨🇳 CN | — |
| `提纳里` | 🇨🇳 CN | — |
| `早柚` | 🇨🇳 CN | — |
| `枫原万叶（万叶）` | 🇨🇳 CN | — |
| `柯莱` | 🇨🇳 CN | — |
| `深渊使徒` | 🇨🇳 CN | — |
| `温迪` | 🇨🇳 CN | — |
| `烟绯` | 🇨🇳 CN | — |
| `珊瑚宫心海（心海，扣扣米）` | 🇨🇳 CN | — |
| `班尼特` | 🇨🇳 CN | — |
| `琴` | 🇨🇳 CN | — |
| `琴美` | 🇨🇳 CN | — |
| `甘雨（椰羊）` | 🇨🇳 CN | — |
| `申鹤` | 🇨🇳 CN | — |
| `白术` | 🇨🇳 CN | — |
| `砂糖` | 🇨🇳 CN | — |
| `神里绫人（绫人）` | 🇨🇳 CN | — |
| `神里绫华（龟龟）` | 🇨🇳 CN | — |
| `空（空哥）` | 🇨🇳 CN | — |
| `纳西妲（草神）` | 🇨🇳 CN | — |
| `罗莎莉亚` | 🇨🇳 CN | — |
| `胡桃` | 🇨🇳 CN | — |
| `芭芭拉` | 🇨🇳 CN | — |
| `荒泷一斗（一斗）` | 🇨🇳 CN | — |
| `荧（荧妹）` | 🇨🇳 CN | — |
| `莫娜` | 🇨🇳 CN | — |
| `菲谢尔（皇女）` | 🇨🇳 CN | — |
| `行秋` | 🇨🇳 CN | — |
| `诺艾尔（女仆）` | 🇨🇳 CN | — |
| `赛诺` | 🇨🇳 CN | — |
| `辛焱` | 🇨🇳 CN | — |
| `达达利亚（公子）` | 🇨🇳 CN | — |
| `迪卢克` | 🇨🇳 CN | — |
| `迪奥娜（猫猫）` | 🇨🇳 CN | — |
| `重云` | 🇨🇳 CN | — |
| `钟离` | 🇨🇳 CN | — |
| `阿贝多` | 🇨🇳 CN | — |
| `雷泽` | 🇨🇳 CN | — |
| `雷电将军（雷神）` | 🇨🇳 CN | — |
| `香菱` | 🇨🇳 CN | — |
| `魈` | 🇨🇳 CN | — |
| `鹿野苑平藏` | 🇨🇳 CN | — |
| `日语七七（田村由加莉）` | 🇯🇵 JP | 田村由加莉 |
| `日语丽莎（田中理惠）` | 🇯🇵 JP | 田中理惠 |
| `日语久岐忍（水桥香织）` | 🇯🇵 JP | 水桥香织 |
| `日语九条裟罗（濑户麻沙美）` | 🇯🇵 JP | 濑户麻沙美 |
| `日语云堇（小岩井小鸟）` | 🇯🇵 JP | 小岩井小鸟 |
| `日语优菈（佐藤利奈）` | 🇯🇵 JP | 佐藤利奈 |
| `日语八重神子（佐仓绫音）` | 🇯🇵 JP | 佐仓绫音 |
| `日语凝光（大原沙耶香）` | 🇯🇵 JP | 大原沙耶香 |
| `日语凯亚（鸟海浩辅）` | 🇯🇵 JP | 鸟海浩辅 |
| `日语刻晴（喜多村英梨）` | 🇯🇵 JP | 喜多村英梨 |
| `日语北斗（小清水亚美）` | 🇯🇵 JP | 小清水亚美 |
| `日语可莉（久野美咲）` | 🇯🇵 JP | 久野美咲 |
| `日语坎蒂丝（柚木凉香）` | 🇯🇵 JP | 柚木凉香 |
| `日语埃洛伊（高垣彩阳）` | 🇯🇵 JP | 高垣彩阳 |
| `日语多莉（金田朋子）` | 🇯🇵 JP | 金田朋子 |
| `日语夜兰（远藤绫）` | 🇯🇵 JP | 远藤绫 |
| `日语妮露（金元寿子）` | 🇯🇵 JP | 金元寿子 |
| `日语安柏（石见舞菜香）` | 🇯🇵 JP | 石见舞菜香 |
| `日语宵宫（植田佳奈）` | 🇯🇵 JP | 植田佳奈 |
| `日语托马（森田成一）` | 🇯🇵 JP | 森田成一 |
| `日语提纳里（小林沙苗）` | 🇯🇵 JP | 小林沙苗 |
| `日语早柚（洲崎绫）` | 🇯🇵 JP | 洲崎绫 |
| `日语柯莱（前川凉子）` | 🇯🇵 JP | 前川凉子 |
| `日语温迪（村濑步）` | 🇯🇵 JP | 村濑步 |
| `日语烟绯（花守由美里）` | 🇯🇵 JP | 花守由美里 |
| `日语班尼特（逢坂良太）` | 🇯🇵 JP | 逢坂良太 |
| `日语琴（斋藤千和）` | 🇯🇵 JP | 斋藤千和 |
| `日语甘雨（上田丽奈）` | 🇯🇵 JP | 上田丽奈 |
| `日语申鹤（川澄绫子）` | 🇯🇵 JP | 川澄绫子 |
| `日语白术（游佐浩二）` | 🇯🇵 JP | 游佐浩二 |
| `日语砂糖（藤田茜）` | 🇯🇵 JP | 藤田茜 |
| `日语神里绫人（石田彰）` | 🇯🇵 JP | 石田彰 |
| `日语神里绫华（早见沙织）` | 🇯🇵 JP | 早见沙织 |
| `日语空（堀江瞬）` | 🇯🇵 JP | 堀江瞬 |
| `日语纳西妲（田村由加莉）` | 🇯🇵 JP | 田村由加莉 |
| `日语罗莎莉亚（加隈亚衣）` | 🇯🇵 JP | 加隈亚衣 |
| `日语胡桃（高桥李依）` | 🇯🇵 JP | 高桥李依 |
| `日语芭芭拉（鬼头明里）` | 🇯🇵 JP | 鬼头明里 |
| `日语荧（悠木碧）` | 🇯🇵 JP | 悠木碧 |
| `日语莫娜（小原好美）` | 🇯🇵 JP | 小原好美 |
| `日语菲谢尔（内田真礼）` | 🇯🇵 JP | 内田真礼 |
| `日语行秋（皆川纯子）` | 🇯🇵 JP | 皆川纯子 |
| `日语诺艾尔（高尾奏音）` | 🇯🇵 JP | 高尾奏音 |
| `日语赛诺（入野自由）` | 🇯🇵 JP | 入野自由 |
| `日语辛焱（高桥智秋）` | 🇯🇵 JP | 高桥智秋 |
| `日语达达利亚（木村良平）` | 🇯🇵 JP | 木村良平 |
| `日语迪卢克（小野贤章）` | 🇯🇵 JP | 小野贤章 |
| `日语迪奥娜（井泽诗织）` | 🇯🇵 JP | 井泽诗织 |
| `日语重云（齐藤壮马）` | 🇯🇵 JP | 齐藤壮马 |
| `日语钟离（前野智昭）` | 🇯🇵 JP | 前野智昭 |
| `日语阿贝多（野岛健儿）` | 🇯🇵 JP | 野岛健儿 |
| `日语雷泽（内山昂辉）` | 🇯🇵 JP | 内山昂辉 |
| `日语雷电将军（泽城美雪）` | 🇯🇵 JP | 泽城美雪 |
| `日语香菱（小泽亚李）` | 🇯🇵 JP | 小泽亚李 |
| `日语魈（松冈祯丞）` | 🇯🇵 JP | 松冈祯丞 |

### 崩壞：星穹鐵道 Honkai Star Rail

| Gradio 值 (用於 API) | 聲優 |
|---|---|

### 崩壞3rd Honkai Impact 3rd

| Gradio 值 (用於 API) | 聲優 |
|---|---|
| `不灭星锚` | — |
| `丽塔` | — |
| `云墨丹心` | — |
| `人之律者` | — |
| `仿犹大` | — |
| `伊甸` | — |
| `克莱因` | — |
| `八重樱` | — |
| `卡莲` | — |
| `圣剑幽兰黛尔` | — |
| `天元骑英` | — |
| `天穹游侠` | — |
| `失落迷迭` | — |
| `妖精爱莉` | — |
| `姬子` | — |
| `尤苏波夫` | — |
| `布洛妮娅` | — |
| `希儿` | — |
| `帕朵菲莉丝` | — |
| `幽兰黛尔` | — |
| `德丽莎` | — |
| `戴因斯雷布` | — |
| `日语戴因斯雷布（津田健次郎）` | 津田健次郎 |
| `断罪影舞` | — |
| `暮光骑士` | — |
| `月下初拥` | — |
| `朔夜观星` | — |
| `极地战刃` | — |
| `格蕾修` | — |
| `梅比乌斯` | — |
| `次生银翼` | — |
| `派蒙bh3` | — |
| `渡鸦` | — |
| `爱莉希雅` | — |
| `爱酱` | — |
| `特斯拉zero` | — |
| `特瓦林` | — |
| `理之律者` | — |
| `理之律者%26希儿` | — |
| `琪亚娜` | — |
| `空之律者` | — |
| `符华` | — |
| `第六夜想曲` | — |
| `绯玉丸` | — |
| `维尔薇` | — |
| `缭乱星棘` | — |
| `芽衣` | — |
| `苍玄` | — |
| `苏西` | — |
| `若水` | — |
| `莉莉娅` | — |
| `萝莎莉娅` | — |
| `薪炎之律者` | — |
| `西琳` | — |
| `识之律者` | — |
| `贝拉` | — |
| `赤鸢` | — |
| `迷城骇兔` | — |
| `镇魂歌` | — |
| `阿波尼亚` | — |
| `雷之律者` | — |
| `魇夜星渊` | — |
| `黑希儿` | — |

### 賽馬娘 Uma Musume

| Gradio 值 (用於 API) | 聲優 |
|---|---|
| `mr cb（cb先生）` | — |
| `东商变革` | — |
| `东海帝皇（帝宝，帝王）` | — |
| `东瀛佐敦` | — |
| `中山庆典` | — |
| `丸善斯基` | — |
| `乙名史悦子（乙名记者）` | — |
| `也文摄辉` | — |
| `伏特加` | — |
| `伏特加女孩` | — |
| `优秀素质` | — |
| `八重无敌` | — |
| `北港火山` | — |
| `北部玄驹` | — |
| `双涡轮（两立直，两喷射，二锅头，逆喷射）` | — |
| `名将怒涛（名将户仁）` | — |
| `大和赤骥` | — |
| `大拓太阳神` | — |
| `大树快车` | — |
| `天狼星象征` | — |
| `奇锐骏` | — |
| `好歌剧` | — |
| `安心泽刺刺美` | — |
| `富士奇迹` | — |
| `小小蚕茧` | — |
| `小林历奇` | — |
| `小栗帽` | — |
| `川上公主` | — |
| `帝王光辉` | — |
| `待兼福来` | — |
| `待兼诗歌剧` | — |
| `微光飞驹` | — |
| `成田大进` | — |
| `成田拜仁（成田路）` | — |
| `成田白仁` | — |
| `摩耶重炮` | — |
| `新光风` | — |
| `无声铃鹿` | — |
| `星云天空` | — |
| `春丽（乌拉拉）` | — |
| `曼城茶座` | — |
| `桐生院葵` | — |
| `樫本理子` | — |
| `樱花千代王` | — |
| `樱花进王` | — |
| `气槽` | — |
| `爱丽数码` | — |
| `爱丽速子（爱丽快子）` | — |
| `爱慕织姬` | — |
| `特别周` | — |
| `玉藻十字` | — |
| `琵琶晨光` | — |
| `生野狄杜斯` | — |
| `目白光明` | — |
| `目白善信` | — |
| `目白多伯` | — |
| `目白赖恩` | — |
| `目白阿尔丹` | — |
| `目白麦昆` | — |
| `真机伶` | — |
| `神鹰` | — |
| `秋川弥生（小小理事长）` | — |
| `稻荷一` | — |
| `空中神宫` | — |
| `米浴` | — |
| `美丽周日` | — |
| `美妙姿势` | — |
| `美浦波旁` | — |
| `胜利奖券` | — |
| `艾尼斯风神` | — |
| `苦涩糖霜` | — |
| `草上飞` | — |
| `荒漠英雄` | — |
| `荣进闪耀` | — |
| `菱亚马逊` | — |
| `菱曙` | — |
| `西野花` | — |
| `超级小海湾` | — |
| `醒目飞鹰（寄寄子）` | — |
| `采珠` | — |
| `里见光钻（萨托诺金刚石）` | — |
| `雪中美人` | — |
| `青竹回忆` | — |
| `骏川手纲（绿帽恶魔）` | — |
| `鲁道夫象征（皇帝）` | — |
| `鹤丸刚志` | — |
| `黄金城（黄金城市）` | — |
| `黄金船` | — |

---

### 聲優反查表（JP voice only）

用聲優名稱查到正確的 Gradio 值：

| 聲優 | Gradio 值 |
|---|---|
| 上田丽奈 | `日语甘雨（上田丽奈）` |
| 久野美咲 | `日语可莉（久野美咲）` |
| 井泽诗织 | `日语迪奥娜（井泽诗织）` |
| 佐仓绫音 | `日语八重神子（佐仓绫音）` |
| 佐藤利奈 | `日语优菈（佐藤利奈）` |
| 入野自由 | `日语赛诺（入野自由）` |
| 内山昂辉 | `日语雷泽（内山昂辉）` |
| 内田真礼 | `日语菲谢尔（内田真礼）` |
| 前川凉子 | `日语柯莱（前川凉子）` |
| 前野智昭 | `日语钟离（前野智昭）` |
| 加隈亚衣 | `日语罗莎莉亚（加隈亚衣）` |
| 喜多村英梨 | `日语刻晴（喜多村英梨）` |
| 堀江瞬 | `日语空（堀江瞬）` |
| 大原沙耶香 | `日语凝光（大原沙耶香）` |
| 小原好美 | `日语莫娜（小原好美）` |
| 小岩井小鸟 | `日语云堇（小岩井小鸟）` |
| 小林沙苗 | `日语提纳里（小林沙苗）` |
| 小泽亚李 | `日语香菱（小泽亚李）` |
| 小清水亚美 | `日语北斗（小清水亚美）` |
| 小野贤章 | `日语迪卢克（小野贤章）` |
| 川澄绫子 | `日语申鹤（川澄绫子）` |
| 悠木碧 | `日语荧（悠木碧）` |
| 斋藤千和 | `日语琴（斋藤千和）` |
| 早见沙织 | `日语神里绫华（早见沙织）` |
| 木村良平 | `日语达达利亚（木村良平）` |
| 村濑步 | `日语温迪（村濑步）` |
| 松冈祯丞 | `日语魈（松冈祯丞）` |
| 柚木凉香 | `日语坎蒂丝（柚木凉香）` |
| 森田成一 | `日语托马（森田成一）` |
| 植田佳奈 | `日语宵宫（植田佳奈）` |
| 水桥香织 | `日语久岐忍（水桥香织）` |
| 泽城美雪 | `日语雷电将军（泽城美雪）` |
| 津田健次郎 | `日语戴因斯雷布（津田健次郎）` |
| 洲崎绫 | `日语早柚（洲崎绫）` |
| 游佐浩二 | `日语白术（游佐浩二）` |
| 濑户麻沙美 | `日语九条裟罗（濑户麻沙美）` |
| 田中理惠 | `日语丽莎（田中理惠）` |
| 田村由加莉 | `日语纳西妲（田村由加莉）`、`日语七七（田村由加莉）` |
| 皆川纯子 | `日语行秋（皆川纯子）` |
| 石田彰 | `日语神里绫人（石田彰）` |
| 石见舞菜香 | `日语安柏（石见舞菜香）` |
| 花守由美里 | `日语烟绯（花守由美里）` |
| 藤田茜 | `日语砂糖（藤田茜）` |
| 远藤绫 | `日语夜兰（远藤绫）` |
| 逢坂良太 | `日语班尼特（逢坂良太）` |
| 野岛健儿 | `日语阿贝多（野岛健儿）` |
| 金元寿子 | `日语妮露（金元寿子）` |
| 金田朋子 | `日语多莉（金田朋子）` |
| 高垣彩阳 | `日语埃洛伊（高垣彩阳）` |
| 高尾奏音 | `日语诺艾尔（高尾奏音）` |
| 高桥智秋 | `日语辛焱（高桥智秋）` |
| 高桥李依 | `日语胡桃（高桥李依）` |
| 鬼头明里 | `日语芭芭拉（鬼头明里）` |
| 鸟海浩辅 | `日语凯亚（鸟海浩辅）` |
| 齐藤壮马 | `日语重云（齐藤壮马）` |


### 語言參數

| API Key | Gradio 值 (傳入 `data[1]`) |
|---|---|
| `zh` | `中文` |
| `ja` | `日语` |
| `mix` | `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` |

Mix 格式：`[ZH]中文部分[ZH][JA]日本語部分[JA]`（每個語言區塊用配對標記包裹）

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
