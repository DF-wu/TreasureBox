---
name: vits-hf2api
description: Direct access to VITS anime/game character TTS (500+ voices) on HuggingFace Spaces via Gradio 3.x REST API and WebSocket. Use when you need Genshin, Star Rail, Uma Musume, Vocaloid, or anime character voice synthesis - call the HF Space directly with curl, no local server needed. Trigger on any anime voice, game character TTS, or character name mention.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3"]}}}
---

# VITS Character TTS (Direct HF Space API)

500+ anime/game character voices via Gradio 3.x REST API. Two upstream Spaces, each with different API styles.

## Spaces

| Role | Space | Protocol | Endpoint | Text Limit |
|------|-------|----------|----------|------------|
| **Primary** | `ikechan8370-vits-uma-genshin-honkai.hf.space` | REST | `POST /api/generate/` | 500 chars |
| **Fallback** | `zomehwh-vits-uma-genshin-honkai.hf.space` | WebSocket | `wss://.../queue/join` | 100 chars |

Always try REST first. Fall back to WebSocket if REST fails or returns error.

---

## Primary: REST API (ikechan8370)

### One-shot curl

```bash
curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d '{"data":["你好旅行者！","中文",0,0.6,0.668,1.2]}' | python3 -c "
import sys, json
result = json.load(sys.stdin)
if 'error' in result:
    print('ERROR:', result['error'])
    sys.exit(1)
file_path = result['data'][1]
import subprocess
subprocess.run(['curl', '-s', f'https://ikechan8370-vits-uma-genshin-honkai.hf.space/file={file_path}', '-o', 'vits_output.wav'])
print('OK:', result['data'][2])
"
```

### Parameters

`{"data": [text, language, speaker_id, noise_scale, noise_scale_w, length_scale]}`

| Position | Name | Type | Default | Range | Notes |
|----------|------|------|---------|-------|-------|
| 0 | text | string | — | ≤500 chars | Text to speak |
| 1 | language | string | `"中文"` | — | Exact dropdown string |
| 2 | speaker_id | int | `0` | 0-based index | Speaker index from table |
| 3 | noise_scale | float | `0.6` | 0.1–1.0 | Emotional variation (lower=flatter) |
| 4 | noise_scale_w | float | `0.668` | 0.1–1.0 | Phoneme length variation |
| 5 | length_scale | float | `1.2` | 0.1–2.0 | Speed (higher=slower) |

### Response

```json
{"data": ["生成成功!", "/file=/tmp/gradio/xxx.wav", "生成耗时 2.34 s"], "duration": 2.5}
```

- `data[0]`: success/error message
- `data[1]`: file path — download via `GET /file={path}`
- `data[2]`: timing info

Error: `{"error": "error message", "duration": 0.01}`

### Python

```python
import aiohttp, json, asyncio

async def vits_tts(text: str, speaker_id=0, lang="中文", ns=0.6, nsw=0.668, ls=1.2) -> bytes:
    base = "https://ikechan8370-vits-uma-genshin-honkai.hf.space"
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{base}/api/generate/",
            json={"data": [text, lang, speaker_id, ns, nsw, ls]}
        ) as r:
            result = await r.json()
        if "error" in result:
            raise RuntimeError(result["error"])
        file_path = result["data"][1]
        async with s.get(f"{base}/file={file_path}") as r:
            return await r.read()

audio = asyncio.run(vits_tts("你好旅行者！", speaker_id=23, lang="中文"))
with open("out.wav", "wb") as f: f.write(audio)
```

### Languages

| String | Meaning |
|--------|---------|
| `中文` | Chinese — auto-wrapped in `[ZH]...[ZH]` |
| `日语` | Japanese — auto-wrapped in `[JA]...[JA]` |
| `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` | Mixed — provide `[ZH]`/`[JA]` tags yourself |

Mix format: `[ZH]中文[JA]日本語[ZH]又是中文`

### Whisper / Soft Voice

| Parameter | Normal | Whisper |
|-----------|--------|---------|
| noise_scale | 0.6 | **0.3** |
| noise_scale_w | 0.668 | 0.668 |
| length_scale | 1.2 | **1.4** |

---

## Fallback: WebSocket (zomehwh)

Use only when REST API fails. Text limit is 100 characters.

### WebSocket Protocol

```
1. Connect: wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join
2. RECV: {"msg": "send_hash"}
3. SEND: {"session_hash": "<random_11>", "fn_index": 0}
4. RECV: {"msg": "estimation"} (ignore)
5. RECV: {"msg": "send_data"}
6. SEND: {"data": [text, lang_str, speaker_str, ns, nsw, ls], "fn_index": 0, "session_hash": "<same>"}
7. RECV: {"msg": "process_completed", "output": {"data": [...]}}
```

Key difference from REST: **speaker is a STRING** (exact Gradio dropdown value), not integer ID. Also: this space monkeypatches audio output to base64 data URI, so `data[1]` contains `data:audio/wav;base64,...` directly — no separate download.

### Python (websockets)

```python
import websockets, json, random, string, base64, asyncio

async def vits_ws(text: str, speaker="派蒙", lang="中文", ns=0.6, nsw=0.668, ls=1.2) -> bytes:
    url = "wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join"
    sh = ''.join(random.choices(string.ascii_letters + string.digits, k=11))
    async with websockets.connect(url) as ws:
        # Step 2: wait for send_hash
        await ws.recv()
        # Step 3: send hash
        await ws.send(json.dumps({"session_hash": sh, "fn_index": 0}))
        # Step 4-5: wait for send_data
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("msg") == "send_data": break
        # Step 6: send data
        await ws.send(json.dumps({"data": [text, lang, speaker, ns, nsw, ls], "fn_index": 0, "session_hash": sh}))
        # Step 7-8: wait for process_completed
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("msg") == "process_completed":
                data = msg["output"]["data"]
                if isinstance(data[1], str) and data[1].startswith("data:audio/wav;base64,"):
                    return base64.b64decode(data[1].split(",", 1)[1])
                raise RuntimeError("Unexpected WS output format")
```

### WS Speaker Strings (Gradio dropdown values)

The WebSocket requires exact Gradio dropdown strings. Key examples:

| Simplified | WS String | ID (REST) |
|:---|:---|:--|
| 派蒙 | `派蒙` | 0 |
| 钟离 | `钟离` | 23 |
| 甘雨 | `甘雨（椰羊）` | 25 |
| 胡桃 | `胡桃` | 27 |
| 神里绫华 | `神里绫华（龟龟）` | 30 |
| 雷电将军 | `雷电将军（雷神）` | 33 |
| 纳西妲 | `纳西妲（草神）` | 48 |
| 芙宁娜 | `芙宁娜` | 63 |
| 三月七 | `三月七` | 100 |
| 卡芙卡 | `卡芙卡` | 104 |
| 黄泉 | `黄泉` | 131 |
| 流萤 | `流萤` | 135 |

---

## Speaker Reference (REST integer IDs)

### Genshin Impact
| ID | Name | | ID | Name |
|:--|:---|---|:--|:---|
| 0 | 派蒙 | | 1 | 琴 |
| 23 | 钟离 | | 25 | 甘雨 |
| 27 | 胡桃 | | 29 | 万叶 |
| 30 | 神里绫华 | | 33 | 雷电将军 |
| 39 | 八重神子 | | 48 | 纳西妲 |
| 63 | 芙宁娜 | | 65 | 那维莱特 |
| 76 | 荧 | | 5 | 温迪 |

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
| 551 | 炭治郎 | 鬼滅之刃 |
| 603 | 艾伦 | 進撃の巨人 |
| 604 | 三笠 | 進撃の巨人 |
| 606 | 利威尔 | 進撃の巨人 |
| 625 | 阿尔托莉雅 | Fate |

### Vocaloid
| ID | Name |
|:--|:---|
| 648 | 初音未来 |
| 652 | 洛天依 |

Full speaker list: 500+ entries. Search with `curl -s 'https://ikechan8370-vits-uma-genshin-honkai.hf.space/config'` → component ID 13 `choices` array.

## Common Gotchas

1. **REST vs WS speaker format**: REST uses integer ID; WS uses exact dropdown string. Watch the difference.
2. **Cold start**: First request after idle may take 20-40s.
3. **卡芙卡 + zh**: Fails on both Spaces. Use `日语` language instead.
4. **Text limit**: REST = 500 chars, WS = 100 chars. Truncate before WS call.
5. **REST response**: Audio is a separate file download. WS response: base64 inline.
