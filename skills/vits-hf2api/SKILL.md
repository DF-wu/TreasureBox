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
- REST = int ID（旧版已弃用、现在全部用 dropdown 字串）

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

## Quick Functions (bash — copy-paste ready)

```bash
vits_tts() {
  # Usage: vits_tts "text" [speaker_id] [lang] [noise] [output_file]
  local text="${1:?Usage: vits_tts <text> [speaker_id] [lang] [noise] [output]}"
  local sid="${2:-0}"
  local lang="${3:-中文}"
  local noise="${4:-0.6}"
  local out="${5:-vits_output.wav}"
  local result=$(curl -sX POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
    -H "Content-Type: application/json" \
    -d "{\"data\":[\"$text\",\"$lang\",$sid,$noise,0.668,1.2]}")
  if echo "$result" | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(0 if 'data' in d else 1)" 2>/dev/null; then
    local fp=$(echo "$result" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'][1])")
    curl -s "https://ikechan8370-vits-uma-genshin-honkai.hf.space/file=$fp" -o "$out"
    echo "Saved: $out" && return 0
  fi
  echo "ERROR: REST API failed. Try shorter text (<100 chars) or different speaker." >&2
  return 1
}

# vits_tts "你好旅行者！"                          # 派蒙, Chinese
# vits_tts "おやすみなさい" 30 "日语"               # 神里绫华, Japanese
# vits_tts "運命を切り開く" 131 "日语"               # 黄泉, Japanese
# vits_tts "夜深了呢…" 25 "中文" 0.3 ganyu_whisper.wav  # 甘雨 whisper
```

### Search speakers

```bash
vits_speakers() {
  curl -s "https://ikechan8370-vits-uma-genshin-honkai.hf.space/config" | python3 -c "
import sys,json;c=json.load(sys.stdin)['components']
choices=[x['choices']for x in c if x.get('type')=='dropdown'and len(x.get('choices',[]))>100][0]
q='${1:-}'.lower()
[print(f'{i:>4}  {n}')for i,n in enumerate(choices)if q in n.lower()or not q]
" 2>/dev/null || echo "Space sleeping. Retry in 30s."
}

# vits_speakers          # list all 800+
# vits_speakers 神里      # search Chinese
# vits_speakers リサ      # search Japanese
```

---

## Python Functions (copy-paste ready)

```python
import aiohttp, json, asyncio, base64, random, string

REST = "https://ikechan8370-vits-uma-genshin-honkai.hf.space"
WS   = "wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join"

async def vits_tts(text: str, speaker_id: int = 0, lang: str = "中文",
                    noise: float = 0.6, nsw: float = 0.668, ls: float = 1.2) -> bytes:
    """Primary: REST API (500 chars, integer speaker ID). Returns WAV bytes."""
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{REST}/api/generate/",
                json={"data": [text, lang, speaker_id, noise, nsw, ls]}) as r:
            result = await r.json()
        if "error" in result:
            raise RuntimeError(result["error"])
        path = result["data"][1]
        async with s.get(f"{REST}/file={path}") as r:
            return await r.read()

async def vits_tts_ws(text: str, speaker: str = "派蒙", lang: str = "中文",
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

async def vits_tts_fallback(text, sid=0, ws_speaker="派蒙", lang="中文", **kw):
    """REST first, auto-fallback to WebSocket."""
    try: return await vits_tts(text, sid, lang, **kw)
    except: return await vits_tts_ws(text, ws_speaker, lang, **kw)

def vits_tts_sync(text, sid=0, **kw):
    return asyncio.run(vits_tts(text, sid, **kw))
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

Search online with `vits_speakers "name"` or use the tables below. **REST API uses integer ID; WebSocket fallback uses exact Gradio display string.**

### 原神 Genshin Impact (HoYoverse, 2020)

| ID | Name | JP Voice Actor |
|:--|:---|:---|
| 0 | 派蒙 | 古贺葵 |
| 1 | 琴 | 斋藤千和 |
| 2 | 丽莎 | 田中理惠 |
| 3 | 凯亚 | 鸟海浩辅 |
| 4 | 安柏 | 石见舞菜香 |
| 5 | 温迪 | 村濑步 |
| 6 | 迪卢克 | 小野贤章 |
| 7 | 雷泽 | 内山昂辉 |
| 8 | 莫娜 | 小原好美 |
| 9 | 芭芭拉 | 鬼头明里 |
| 10 | 砂糖 | 藤田茜 |
| 11 | 诺艾尔 | 高尾奏音 |
| 12 | 班尼特 | 逢坂良太 |
| 13 | 菲谢尔 | 内田真礼 |
| 14 | 可莉 | 久野美咲 |
| 15 | 凝光 | 大原沙耶香 |
| 16 | 北斗 | 小清水亚美 |
| 17 | 行秋 | 皆川纯子 |
| 18 | 香菱 | 小泽亚李 |
| 19 | 重云 | 齐藤壮马 |
| 20 | 七七 | 田村由加莉 |
| 21 | 刻晴 | 喜多村英梨 |
| 22 | 达达利亚 | 木村良平 |
| 23 | 钟离 | 前野智昭 |
| 24 | 阿贝多 | 野岛健儿 |
| 25 | 甘雨 | 上田丽奈 |
| 26 | 魈 | 松冈祯丞 |
| 27 | 胡桃 | 高桥李依 |
| 28 | 优菈 | 佐藤利奈 |
| 29 | 枫原万叶 | 岛崎信长 |
| 30 | 神里绫华 | 早见沙织 |
| 31 | 宵宫 | 植田佳奈 |
| 32 | 早柚 | 洲崎绫 |
| 33 | 雷电将军 | 泽城美雪 |
| 34 | 珊瑚宫心海 | 三森铃子 |
| 35 | 五郎 | 畠中祐 |
| 36 | 九条裟罗 | 濑户麻沙美 |
| 37 | 托马 | 森田成一 |
| 38 | 荒泷一斗 | 西川贵教 |
| 39 | 八重神子 | 佐仓绫音 |
| 40 | 夜兰 | 远藤绫 |
| 41 | 鹿野院平藏 | 井口祐一 |
| 42 | 提纳里 | 小林沙苗 |
| 43 | 柯莱 | 前川凉子 |
| 44 | 多莉 | 金田朋子 |
| 45 | 妮露 | 金元寿子 |
| 46 | 赛诺 | 入野自由 |
| 47 | 坎蒂丝 | 柚木凉香 |
| 48 | 纳西妲 | 田村由加莉 |
| 49 | 莱依拉 | 富田美忧 |
| 50 | 流浪者 | 柿原彻也 |
| 51 | 珐露珊 | 堀江由衣 |
| 52 | 艾尔海森 | 梅原裕一郎 |
| 53 | 迪希雅 | 福原绫香 |
| 54 | 米卡 | 三瓶由布子 |
| 55 | 卡维 | 内田雄马 |
| 56 | 白术 | 游佐浩二 |
| 57 | 琳妮特 | 筱原侑 |
| 58 | 林尼 | 下野纮 |
| 59 | 菲米尼 | 土岐隼一 |
| 60 | 娜维娅 | 丰崎爱生 |
| 61 | 夏沃蕾 | 石川由依 |
| 62 | 莱欧斯利 | 小野大辅 |
| 63 | 芙宁娜 | 水濑祈 |
| 64 | 夏洛蒂 | 和气杏未 |
| 65 | 那维莱特 | 神谷浩史 |
| 66 | 克洛琳德 | 石川由依 |
| 67 | 希格雯 | 木野日菜 |
| 68 | 艾梅莉埃 | 日笠阳子 |
| 69 | 玛拉妮 | 东山奈央 |
| 70 | 基尼奇 | 杉山纪彰 |
| 71 | 卡齐娜 | 久保由利香 |
| 72 | 恰斯卡 | 甲斐田裕子 |
| 73 | 欧洛伦 | 近藤隆 |
| 74 | 伊法 | 森久保祥太郎 |
| 75 | 茜特菈莉 | 濑户麻沙美 |
| 76 | 荧 | 悠木碧 |
| 77 | 蓝砚 | 若山诗音 |
| 78 | 希诺宁 | ファイルーズあい |

### 崩坏：星穹铁道 Honkai Star Rail (HoYoverse, 2023)

| ID | Name | JP Voice Actor |
|:--|:---|:---|
| 100 | 三月七 | 小仓唯 |
| 101 | 丹恒 | 伊东健人 |
| 102 | 姬子 | 田中理惠 |
| 103 | 瓦尔特 | 细谷佳正 |
| 104 | 卡芙卡 | 伊藤静 |
| 105 | 银狼 | 阿澄佳奈 |
| 106 | 阿兰 | 白石凉子 |
| 107 | 艾丝妲 | 赤崎千夏 |
| 108 | 黑塔 | 山崎遥 |
| 109 | 布洛妮娅 | 阿澄佳奈 |
| 110 | 希儿 | 中原麻衣 |
| 111 | 杰帕德 | 古川慎 |
| 112 | 克拉拉 | 日高里菜 |
| 113 | 桑博 | 平川大辅 |
| 114 | 佩拉 | 诸星堇 |
| 115 | 停云 | 高田忧希 |
| 116 | 素裳 | 福圆美里 |
| 117 | 罗刹 | 石田彰 |
| 118 | 白露 | 加藤英美里 |
| 119 | 景元 | 小野大辅 |
| 120 | 彦卿 | 井上麻里奈 |
| 121 | 符玄 | 伊藤美来 |
| 122 | 玲可 | 照井春佳 |
| 123 | 驭空 | 冬马由美 |
| 124 | 桂乃芬 | 菲鲁兹·蓝 |
| 125 | 藿藿 | 长绳麻理亚 |
| 126 | 银枝 | 立花慎之介 |
| 127 | 寒鸦 | 铃代纱弓 |
| 128 | 雪衣 | 河濑茉希 |
| 129 | 黑天鹅 | 生天目仁美 |
| 130 | 米沙 | 松井惠理子 |
| 131 | 黄泉 | 泽城美雪 |
| 132 | 加拉赫 | 三木真一郎 |
| 133 | 知更鸟 | 名冢佳织 |
| 134 | 星期日 | 大冢刚央 |
| 135 | 流萤 | 楠木灯 |
| 136 | 翡翠 | 三石琴乃 |
| 137 | 波提欧 | 小西克幸 |
| 138 | 椒丘 | 丰永利行 |
| 139 | 飞霄 | 小松未可子 |
| 140 | 貊泽 | 坂泰斗 |
| 141 | 灵砂 | 前田佳织里 |
| 142 | 忘归人 | 伊濑茉莉也 |
| 143 | 大黑塔 | 山崎遥 |
| 144 | 阿格莱雅 | ゆかな |
| 145 | 缇宝 | 远藤绫 |
| 146 | 万敌 | 阿部敦 |
| 147 | 遐蝶 | 斋藤千和 |
| 148 | 那刻夏 | 内山昂辉 |
| 149 | 赛飞儿 | 小野友树 |
| 150 | 风堇 | Lynn |

### 崩坏3rd Honkai Impact 3rd (miHoYo, 2016)

| ID | Name | JP Voice Actor |
|:--|:---|:---|
| 300 | 琪亚娜·卡斯兰娜 | 钉宫理惠 |
| 301 | 雷电芽衣 | 泽城美雪 |
| 302 | 布洛妮娅·扎伊切克 | 阿澄佳奈 |
| 303 | 无量塔姬子 | 田中理惠 |
| 304 | 德丽莎·阿波卡利斯 | 田村由加莉 |
| 305 | 符华 | 高山南 |
| 306 | 八重樱 | 佐仓绫音 |
| 307 | 卡莲·卡斯兰娜 | 水树奈奈 |
| 308 | 丽塔·洛丝薇瑟 | 悠木碧 |
| 309 | 幽兰黛尔 | 能登麻美子 |
| 310 | 爱莉希雅 | 井上麻里奈 |
| 311 | 维尔薇 | 金元寿子 |
| 312 | 阿波尼亚 | 泽城美雪 |
| 313 | 伊甸 | 木村良平 |
| 314 | 千劫 | 小林裕介 |
| 315 | 苏 | 樱井孝宏 |
| 316 | 凯文·卡斯兰娜 | 日野聪 |
| 317 | 梅比乌斯 | 大久保瑠美 |
| 318 | 帕朵菲莉丝 | 芹泽优 |
| 319 | 格蕾修 | 木野日菜 |
| 320 | 科斯魔 | 小林千晃 |

### 赛马娘 Uma Musume Pretty Derby (Cygames, 2021)

| ID | Name | JP Voice Actor |
|:--|:---|:---|
| 200 | 特别周 | 和气杏未 |
| 201 | 无声铃鹿 | 高野麻里佳 |
| 202 | 东海帝皇 | Machico |
| 203 | 丸善斯基 | Lynn |
| 205 | 小栗帽 | 高柳知叶 |
| 206 | 黄金船 | 上田瞳 |
| 207 | 伏特加 | 大桥彩香 |
| 208 | 大和赤骥 | 木村千咲 |
| 209 | 大树快车 | 大坪由佳 |
| 210 | 草上飞 | 前田玲奈 |
| 211 | 菱亚马逊 | 巽悠衣子 |
| 212 | 目白麦昆 | 大西沙织 |
| 214 | 好歌剧 | 德井青空 |
| 216 | 鲁道夫象征 | 田所梓 |
| 217 | 气槽 | 青木瑠璃子 |
| 221 | 美妙姿势 | 桥本千波 |
| 229 | 米浴 | 石见舞菜香 |
| 238 | 超级小海湾 | 优木加奈 |
| 239 | 醒目飞鹰 | 大和田仁美 |
| 248 | 北部玄驹 | 矢野妃菜喜 |
| 249 | 里见光钻 | 立花日菜 |

### Anime Characters

| ID | Name | Series | JP Voice Actor |
|:--|:---|:---|:---|
| 400 | 雪之下雪乃 | やはり俺の青春ラブコメはまちがっている。 | 早见沙织 |
| 401 | 由比滨结衣 | やはり俺の青春ラブコメはまちがっている。 | 东山奈央 |
| 402 | 一色彩羽 | やはり俺の青春ラブコメはまちがっている。 | 佐仓绫音 |
| 405 | 加藤惠 | 冴えない彼女の育てかた | 安野希世乃 |
| 406 | 英梨梨 | 冴えない彼女の育てかた | 大西沙织 |
| 407 | 霞之丘诗羽 | 冴えない彼女の育てかた | 茅野爱衣 |
| 409 | 御坂美琴 | とある科学の超電磁砲 | 佐藤利奈 |
| 410 | 白井黑子 | とある科学の超電磁砲 | 新井里美 |
| 416 | 立华奏 | Angel Beats! | 花泽香菜 |
| 420 | 绫小路清隆 | ようこそ実力至上主義の教室へ | 千叶翔也 |
| 421 | 堀北铃音 | ようこそ実力至上主義の教室へ | 鬼头明里 |
| 427 | 椎名真白 | さくら荘のペットな彼女 | 茅野爱衣 |
| 434 | 战场原黑仪 | 物語シリーズ | 斋藤千和 |
| 435 | 八九寺真宵 | 物語シリーズ | 加藤英美里 |
| 436 | 忍野忍 | 物語シリーズ | 坂本真绫 |
| 442 | 蕾姆 | Re:ゼロから始める異世界生活 | 水濑祈 |
| 443 | 拉姆 | Re:ゼロから始める異世界生活 | 村川梨衣 |
| 444 | 爱蜜莉雅 | Re:ゼロから始める異世界生活 | 高桥李依 |
| 457 | 桐人 | ソードアート・オンライン | 松冈祯丞 |
| 458 | 亚丝娜 | ソードアート・オンライン | 户松遥 |
| 459 | 诗乃 | ソードアート・オンライン | 泽城美雪 |
| 471 | 杀生丸 | 犬夜叉 | 成田剑 |
| 472 | 桔梗 | 犬夜叉 | 日高范子 |
| 483 | 绯村剑心 | るろうに剣心 | 凉风真世 |
| 491 | 漩涡鸣人 | NARUTO -ナルト- | 竹内顺子 |
| 492 | 宇智波佐助 | NARUTO -ナルト- | 杉山纪彰 |
| 493 | 春野樱 | NARUTO -ナルト- | 中村千绘 |
| 494 | 旗木卡卡西 | NARUTO -ナルト- | 井上和彦 |
| 524 | 蒙奇·D·路飞 | ONE PIECE | 田中真弓 |
| 525 | 罗罗诺亚·索隆 | ONE PIECE | 中井和哉 |
| 526 | 娜美 | ONE PIECE | 冈村明美 |
| 528 | 山治 | ONE PIECE | 平田广明 |
| 551 | 灶门炭治郎 | 鬼滅の刃 | 花江夏树 |
| 552 | 灶门祢豆子 | 鬼滅の刃 | 鬼头明里 |
| 553 | 我妻善逸 | 鬼滅の刃 | 下野纮 |
| 555 | 富冈义勇 | 鬼滅の刃 | 樱井孝宏 |
| 556 | 蝴蝶忍 | 鬼滅の刃 | 早见沙织 |
| 557 | 炼狱杏寿郎 | 鬼滅の刃 | 日野聪 |
| 571 | 埼玉 | ワンパンマン | 古川慎 |
| 589 | 五河士道 | デート・ア・ライブ | 岛崎信长 |
| 590 | 夜刀神十香 | デート・ア・ライブ | 井上麻里奈 |
| 593 | 时崎狂三 | デート・ア・ライブ | 真田麻美 |
| 603 | 艾伦·耶格尔 | 進撃の巨人 | 梶裕贵 |
| 604 | 三笠·阿克曼 | 進撃の巨人 | 石川由依 |
| 606 | 利威尔·阿克曼 | 進撃の巨人 | 神谷浩史 |
| 622 | 卫宫士郎 | Fate/stay night | 杉山纪彰 |
| 623 | 远坂凛 | Fate/stay night | 植田佳奈 |
| 625 | Saber / 阿尔托莉雅 | Fate/stay night | 川澄绫子 |
| 626 | 吉尔伽美什 | Fate/stay night | 关智一 |
| 634 | 伊莉雅 | Fate/stay night | 门胁舞以 |
| 637 | 玛修·基列莱特 | Fate/Grand Order | 种田梨沙 |

### Vocaloid / Virtual Singer

| ID | Name | Voice Provider |
|:--|:---|:---|
| 648 | 初音未来 | 藤田咲 |
| 649 | 镜音铃 | 下田麻美 |
| 650 | 镜音连 | 下田麻美 |
| 651 | 巡音流歌 | 浅川悠 |
| 652 | 洛天依 | 山新 (CN) |
| 653 | 言和 | 刘婧荦 (CN) |
| 654 | 乐正绫 | 祈Inory (CN) |

## Languages

| String | Meaning |
|--------|---------|
| `中文` | Chinese — auto `[ZH]...[ZH]` |
| `日语` | Japanese — auto `[JA]...[JA]` |
| `中日混合（中文用[ZH][ZH]包裹起来，日文用[JA][JA]包裹起来）` | Mixed |

Mix: `[ZH]中文[JA]日本語[ZH]又是中文`

## Whisper Voice

| Param | Normal | Whisper |
|-------|--------|---------|
| noise_scale | 0.6 | **0.3** |
| length_scale | 1.2 | **1.4** |

## Gotchas

1. **REST = int ID. WS = exact string.** Don't mix speaker formats.
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
