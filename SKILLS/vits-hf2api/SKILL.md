---
name: vits-hf2api
description: VITS anime/game character TTS with 500+ voices (Genshin, Star Rail, Uma Musume, Vocaloid, anime) via local OpenAI-compatible API at localhost port 8830. Use this skill when the user wants character voice text-to-speech, mentions any anime/game character name, needs Chinese/Japanese/mixed-language TTS, wants whisper/emotional voice effects, or asks for character voice synthesis. Trigger on any mention of anime voice, game character voice, Genshin voice, HSR voice, 原神语音, 角色语音, VITS, or specific character names. Even if they do not say VITS or hf2api, use this when they need character-based TTS.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# VITS Character TTS

Local OpenAI-compatible API at `http://localhost:8830`. 500+ anime/game character voices spanning Genshin Impact, Honkai Star Rail, Honkai Impact 3rd, Uma Musume, Vocaloid, and dozens of anime series. Dual-upstream with automatic REST→WebSocket fallback. Text limit: 500 characters.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/models` | Speaker list + search (`?search=`) |
| GET | `/health` | Service health check |
| POST | `/v1/audio/speech` | Text → character voice WAV |

## Text-to-Speech

```
POST /v1/audio/speech  |  Content-Type: application/json
```

```json
{
  "input": "你好旅行者！",
  "voice": "派蒙",
  "language": "zh",
  "noise_scale": 0.6,
  "noise_scale_w": 0.668,
  "length_scale": 1.2
}
```

### Parameters

| Parameter | Required | Default | Range | Description |
|-----------|----------|---------|-------|-------------|
| `input` | **Yes** | — | ≤500 chars | Text to speak. Truncated with warning if over limit. |
| `voice` | No | 派蒙 | — | Chinese name, English alias, or partial match |
| `language` | No | mix | zh/ja/mix | Language mode (see below) |
| `speed` | No | — | >0 | Converts to `length_scale = 1/speed` |
| `noise_scale` | No | 0.6 | 0.1–1.0 | Emotional variation. Lower = flatter/monotone. |
| `noise_scale_w` | No | 0.668 | 0.1–1.0 | Phoneme length variation |
| `length_scale` | No | 1.2 | 0.1–2.0 | Speed. Higher = slower. |
| `response_format` | No | wav | — | Only WAV supported |

**Voice resolution**: exact match → prefix match → English alias → case-insensitive → substring. Example: `ayaka` resolves to `神里绫华（龟龟）`.

### Languages

| Code | Meaning | Notes |
|------|---------|-------|
| `zh` | 中文 | Text auto-wrapped in `[ZH]...[ZH]` |
| `ja` | 日语 | Text auto-wrapped in `[JA]...[JA]` |
| `mix` | 中日混合 | Provide `[ZH]`/`[JA]` tags yourself |

**Mix format** (delimiters are the SAME, no `/`):
```
[ZH]中文内容[ZH][JA]日本語[JA][ZH]又是中文[ZH]
```

### Whisper / Soft Voice

| Parameter | Normal | Whisper | Effect |
|-----------|--------|---------|--------|
| `noise_scale` | 0.6 | **0.3** | Calmer, breathier |
| `noise_scale_w` | 0.668 | 0.668 | (unchanged) |
| `length_scale` | 1.2 | **1.4** | Slower, softer |

## Speaker Reference

### Genshin Impact
| ID | Name | Alias |
|:--|:---|:---|
| 0 | 派蒙 | paimon |
| 23 | 钟离 | zhongli |
| 25 | 甘雨 | ganyu |
| 27 | 胡桃 | hutao |
| 29 | 枫原万叶 | kazuha |
| 30 | 神里绫华 | ayaka |
| 33 | 雷电将军 | raiden |
| 39 | 八重神子 | yae |
| 48 | 纳西妲 | nahida |
| 63 | 芙宁娜 | furina |
| 65 | 那维莱特 | neuvillette |
| 76 | 荧 | lumine |
| — | 琴, 丽莎, 凯亚, 安柏, 温迪, 迪卢克, 莫娜, 芭芭拉, 砂糖, 诺艾尔, 班尼特, 菲谢尔, 可莉, 凝光, 北斗, 行秋, 香菱, 重云, 七七, 刻晴, 达达利亚, 阿贝多, 魈, 优菈, 宵宫, 早柚, 珊瑚宫心海, 五郎, 九条裟罗, 托马, 荒泷一斗, 夜兰, 鹿野院平藏, 提纳里, 柯莱, 多莉, 妮露, 赛诺, 坎蒂丝, 莱依拉, 流浪者, 珐露珊, 艾尔海森, 迪希雅, 米卡, 卡维, 白术, 琳妮特, 林尼, 菲米尼, 娜维娅, 夏沃蕾, 莱欧斯利, 夏洛蒂, 克洛琳德, 希格雯, 艾梅莉埃, 玛拉妮, 基尼奇, 卡齐娜, 恰斯卡, 欧洛伦, 伊法, 茜特菈莉, 玛薇卡, 蓝砚, 希诺宁 | — |

### Honkai Star Rail
| ID | Name | Alias |
|:--|:---|:---|
| 100 | 三月七 | march7th |
| 101 | 丹恒 | danheng |
| 102 | 姬子 | himeko |
| 104 | 卡芙卡 | kafka |
| 105 | 银狼 | silverwolf |
| 109 | 布洛妮娅 | bronya |
| 110 | 希儿 | seele |
| 119 | 景元 | jingyuan |
| 121 | 符玄 | fuxuan |
| 131 | 黄泉 | acheron |
| 135 | 流萤 | firefly |
| 139 | 飞霄 | feixiao |
| — | 瓦尔特, 阿兰, 艾丝妲, 黑塔, 杰帕德, 克拉拉, 桑博, 佩拉, 停云, 素裳, 罗刹, 白露, 彦卿, 玲可, 驭空, 桂乃芬, 藿藿, 银枝, 寒鸦, 雪衣, 黑天鹅, 米沙, 加拉赫, 知更鸟, 星期日, 翡翠, 波提欧, 椒丘, 貊泽, 灵砂, 忘归人, 大黑塔, 阿格莱雅, 缇宝, 万敌, 遐蝶, 那刻夏, 赛飞儿, 风堇 | — |

### Honkai Impact 3rd
| ID | Name | Alias |
|:--|:---|:---|
| 300 | 琪亚娜 | kiana |
| 301 | 雷电芽衣 | mei |
| 310 | 爱莉希雅 | elysia |
| 322 | 符华 | fuhua |
| — | 布洛妮娅·扎伊切克, 无量塔姬子, 德丽莎, 八重樱, 卡莲, 丽塔, 幽兰黛尔, 维尔薇, 阿波尼亚, 伊甸, 千劫, 苏, 凯文, 梅比乌斯, 帕朵菲莉丝, 格蕾修, 科斯魔, 樱, 华, 娜塔莎, 罗莎莉亚, 莉莉娅, 希儿（崩坏3）, 黑希儿, 德尔塔, 明日香, 绫波丽, 真嗣, 渚薰, 真希波, 空, 阿晴, 甘雨（原神）, 钟离先生, 雷神, 将军, 小草神, 水神, 火神, 岩王帝君, 往生堂堂主 | — |

### Uma Musume
| ID | Name | Alias |
|:--|:---|:---|
| 200 | 特别周 | specialweek |
| 201 | 无声铃鹿 | silencesuzuka |
| 202 | 东海帝皇 | tokaiteio |
| 205 | 小栗帽 | oguricap |
| 206 | 黄金船 | goldship |
| 212 | 目白麦昆 | mejiroumaikun |
| 248 | 北部玄驹 | kitasan-black |
| — | 丸善斯基, 富士奇石, 伏特加, 大和赤骥, 大树快车, 草上飞, 菱亚马逊, 神鹰, 好歌剧, 成田白仁, 鲁道夫象征, 气槽, 爱丽数码, 青云天空, 玉藻十字, 美妙姿势, 琵琶晨光, 摩耶重炮, 曼城茶座, 美浦波旁, 目白赖恩, 菱曙, 雪之美人, 米浴, 艾尼斯风神, 爱丽速子, 胜利奖券, 荣进闪耀, 真机伶, 川上公主, 黄金城市, 樱花进王, 超级小海湾, 醒目飞鹰, 成田大进, 春丽, 待兼福来, 名将怒涛, 目白多伯, 优秀素质, 帝王光辉, 待兼诗歌剧, 里见光钻 | — |

### Anime Series
| ID | Name | Series | Alias |
|:--|:---|:---|:---|
| 400 | 雪之下雪乃 | やはり俺の青春ラブコメ | yukino |
| 405 | 加藤惠 | 冴えない彼女の育てかた | megumi |
| 409 | 御坂美琴 | とある科学の超電磁砲 | misaka |
| 416 | 立华奏 | Angel Beats! | kanade |
| 420 | 绫小路清隆 | ようこそ実力至上主義の教室へ | ayanokouji |
| 427 | 椎名真白 | さくら荘のペットな彼女 | mashiro |
| 434 | 战场原黑仪 | 物語シリーズ | senjougahara |
| 442 | 蕾姆 | Re:ゼロから始める異世界生活 | rem |
| 457 | 桐人 | ソードアート・オンライン | kirito |
| 458 | 亚丝娜 | ソードアート・オンライン | asuna |
| 472 | 桔梗 | 犬夜叉 | kikyou |
| 483 | 绯村剑心 | るろうに剣心 | kenshin |
| 491 | 鸣人 | NARUTO | naruto |
| 492 | 佐助 | NARUTO | sasuke |
| 524 | 路飞 | ONE PIECE | luffy |
| 525 | 索隆 | ONE PIECE | zoro |
| 551 | 炭治郎 | 鬼滅の刃 | tanjirou |
| 552 | 祢豆子 | 鬼滅の刃 | nezuko |
| 571 | 琦玉 | ワンパンマン | saitama |
| 589 | 五河士道 | デート・ア・ライブ | shidou |
| 593 | 时崎狂三 | デート・ア・ライブ | kurumi |
| 603 | 艾伦 | 進撃の巨人 | eren |
| 604 | 三笠 | 進撃の巨人 | mikasa |
| 606 | 利威尔 | 進撃の巨人 | levi |
| 622 | 卫宫士郎 | Fate/stay night | shirou |
| 625 | Saber/阿尔托莉雅 | Fate/stay night | saber, artoria |
| 637 | 玛修 | Fate/Grand Order | mash |

### Vocaloid
| ID | Name | Alias |
|:--|:---|:---|
| 648 | 初音未来 | hatsune-miku |
| 649 | 镜音铃 | kagamine-rin |
| 650 | 镜音连 | kagamine-len |
| 651 | 巡音流歌 | luka |
| 652 | 洛天依 | luotianyi |
| 653 | 言和 | yanhe |
| 654 | 乐正绫 | yuezheng-ling |

## Examples

### Discover speakers
```bash
curl -s http://localhost:8830/health
curl -s 'http://localhost:8830/v1/models?search=神里' | python3 -m json.tool
curl -s 'http://localhost:8830/v1/models?search=ayaka' | python3 -m json.tool
```

### Basic TTS
```bash
# Genshin — Chinese
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"旅行者，你来了。","voice":"钟离","language":"zh"}' -o zhongli.wav

# Genshin — Japanese
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"おやすみなさい。","voice":"神里绫华","language":"ja"}' -o ayaka.wav

# HSR — using English alias
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"運命を切り開く。","voice":"acheron","language":"ja"}' -o acheron.wav
```

### Whisper / soft voice
```bash
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"夜深了呢…你还没睡吗？","voice":"甘雨","language":"zh","noise_scale":0.3,"length_scale":1.4}' -o whisper.wav
```

### Fast / slow speech
```bash
# Fast (speed=1.5)
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"快快快别磨蹭了！","voice":"派蒙","language":"zh","speed":1.5}' -o fast.wav

# Slow, emotional
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"我一定…会保护大家的。","voice":"荧","language":"zh","noise_scale":0.8,"length_scale":1.6}' -o slow.wav
```

### Mix language
```bash
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"[ZH]你好旅行者[JA]私は雷電将軍です[ZH]很高兴认识你","voice":"雷电将军","language":"mix"}' -o mix.wav
```

### Anime / Vocaloid
```bash
# Rem
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"レムはロズワール様のメイドです。","voice":"蕾姆","language":"ja"}' -o rem.wav

# Miku
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"世界で一番お姫様","voice":"初音未来","language":"ja","noise_scale":0.5,"length_scale":1.1}' -o miku.wav

# Levi
curl -sX POST http://localhost:8830/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"心臓を捧げよ。","voice":"利威尔","language":"ja"}' -o levi.wav
```

### Python (aiohttp)
```python
import aiohttp

async def vits_tts(text: str, voice="派蒙", lang="mix", noise=0.6, nsw=0.668, ls=1.2) -> bytes:
    async with aiohttp.ClientSession() as s:
        async with s.post("http://localhost:8830/v1/audio/speech", json={
            "input": text, "voice": voice, "language": lang,
            "noise_scale": noise, "noise_scale_w": nsw, "length_scale": ls
        }) as r:
            return await r.read()

async def search_speaker(query: str) -> list:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"http://localhost:8830/v1/models?search={query}") as r:
            data = await r.json()
            return data.get("speakers", [])

# Usage
audio = await vits_tts("你好旅行者！", voice="派蒙", lang="zh")
with open("paimon.wav", "wb") as f: f.write(audio)

# Whisper effect
audio = await vits_tts("秘密を教える…", voice="ayaka", lang="ja", noise=0.3, ls=1.4)
```

## Error Reference

| Code | Meaning | Action |
|:---|:---|:---|
| 400 | Missing `input` or invalid JSON | `input` is required |
| 401 | Auth required | Add `Authorization: Bearer <key>` |
| 502 | Upstream error | Auto-falls back to secondary upstream |

Warning: `X-Warning: text-truncated` (over 500 chars), `X-Warning: format-conversion-not-supported`

## Known Issues

- **卡芙卡 + zh fails**: Upstream bug. Use `language=ja` instead.
- **Text limit**: 500 chars (primary) / 100 chars (fallback). Split long text.
- **Name matching**: Partial names resolve via prefix. Use `/v1/models?search=` to find exact names.
- **Slow under load**: HF Space cold start. First request may take 10-30s.
