# VITS-UMA JP Voice Catalog

Complete reference for all 65 Japanese-dubbed character voices from the VITS-UMA Genshin Impact model.

## Voice Key Format

All voice keys are **simplified Chinese** character names. The upstream model config lists them as `日语<character>（<voice actor>）`. This API strips the `日语` prefix and voice actor parenthetical to produce the key.

## Complete Voice Table

| # | Voice Key | Voice Actor | EN Name |
|---|-----------|-------------|---------|
| 1 | `阿贝多` | Nojima Kenji | Albedo |
| 2 | `埃洛伊` | Takagaki Ayahi | Aloy |
| 3 | `安柏` | Iwami Manaka | Amber |
| 4 | `神里绫华` | Hayami Saori | Kamisato Ayaka |
| 5 | `神里绫人` | Ishida Akira | Kamisato Ayato |
| 6 | `白术` | Yusa Koji | Baizhu |
| 7 | `芭芭拉` | Kito Akari | Barbara |
| 8 | `北斗` | Koshimizu Ami | Beidou |
| 9 | `班尼特` | Oosaka Ryouta | Bennett |
| 10 | `坎蒂丝` | Yuzuki Ryoka | Candace |
| 11 | `重云` | Saito Soma | Chongyun |
| 12 | `柯莱` | Maekawa Ryoko | Collei |
| 13 | `赛诺` | Iriya Miyu | Cyno |
| 14 | `戴因斯雷布` | Tsuda Kenjiro | Dainsleif |
| 15 | `迪卢克` | Ono Kensho | Diluc |
| 16 | `迪奥娜` | Izawa Shiori | Diona |
| 17 | `多莉` | Kaneda Tomoko | Dori |
| 18 | `优菈` | Sato Rina | Eula |
| 19 | `菲谢尔` | Uchida Maaya | Fischl |
| 20 | `甘雨` | Ueda Reina | Ganyu |
| 21 | `未知` | Hatanaka Tasuku | Generic/narrator male |
| 22 | `鹿野院平藏` | Iguchi Yuichi | Shikanoin Heizou |
| 23 | `空` | Horie Shun | Aether |
| 24 | `荧` | Yuuki Aoi | Lumine |
| 25 | `胡桃` | Takahashi Rie | Hutao |
| 26 | `一斗` | Nishikawa Takanori | Itto |
| 27 | `凯亚` | Toriumi Kosuke | Kaeya |
| 28 | `万叶` | Shimazaki Nobunaga | Kazuha |
| 29 | `刻晴` | Kitamura Eri | Keqing |
| 30 | `可莉` | Kuno Misaki | Klee |
| 31 | `心海` | Mimori Suzuko | Kokomi |
| 32 | `九条裟罗` | Seto Asami | Kujou Sara |
| 33 | `丽莎` | Tanaka Rie | Lisa |
| 34 | `莫娜` | Kohara Konomi | Mona |
| 35 | `纳西妲` | Tamura Yukari | Nahida |
| 36 | `妮露` | Kanemoto Hisako | Nilou |
| 37 | `凝光` | Ohara Sayaka | Ningguang |
| 38 | `诺艾尔` | Takao Kanon | Noelle |
| 39 | `奥兹` | Masutani Yasunori | Oz |
| 40 | `派蒙` | Koga Aoi | Paimon |
| 41 | `琴` | Saito Chiwa | Jean |
| 42 | `七七` | Tamura Yukari | Qiqi |
| 43 | `雷电将军` | Sawashiro Miyuki | Raiden Shogun |
| 44 | `雷泽` | Uchiyama Koki | Razor |
| 45 | `罗莎莉亚` | Kakumu Ai | Rosaria |
| 46 | `早柚` | Sasaki Aya | Sayu |
| 47 | `散兵` | Kakihara Tetsuya | Scaramouche |
| 48 | `申鹤` | Kawasumi Ayako | Shenhe |
| 49 | `久岐忍` | Mizuhashi Kaori | Shinobu |
| 50 | `女士` | Shoko Yui | Signora |
| 51 | `砂糖` | Fujita Akane | Sucrose |
| 52 | `达达利亚` | Kimura Ryohei | Tartaglia |
| 53 | `托马` | Morita Masakazu | Thoma |
| 54 | `提纳里` | Kobayashi Sanae | Tighnari |
| 55 | `温迪` | Murase Ayumu | Venti |
| 56 | `香菱` | Ozawa Ari | Xiangling |
| 57 | `魈` | Matsuoka Yoshitsugu | Xiao |
| 58 | `行秋` | Minagawa Junko | Xingqiu |
| 59 | `辛焱` | Takahashi Tomomi | Xinyan |
| 60 | `八重神子` | Sakura Ayane | Yae Miko |
| 61 | `烟绯` | Hanamori Yumiri | Yanfei |
| 62 | `夜兰` | Endo Aya | Yelan |
| 63 | `宵宫` | Ueda Kana | Yoimiya |
| 64 | `云堇` | Koiwai Kotori | Yun Jin |
| 65 | `钟离` | Maeno Tomoaki | Zhongli |

## Special Entries

- **`未知`** (#21): No character name in upstream data, only voice actor (畠中祐). Likely a generic male narrator. API assigns key `未知` as fallback.

## Shared Voice Actors

- **Tamura Yukari**: 纳西妲 (Nahida) and 七七 (Qiqi)

## JP→Voice-Key Mapping

| Japanese | Voice Key |
|----------|-----------|
| アルベド | `阿贝多` |
| アンバー | `安柏` |
| 神里綾華 | `神里绫华` |
| 神里綾人 | `神里绫人` |
| バーバラ | `芭芭拉` |
| 北斗 | `北斗` |
| ベネット | `班尼特` |
| 重雲 | `重云` |
| コレイ | `柯莱` |
| セノ | `赛诺` |
| ダインスレイヴ | `戴因斯雷布` |
| ディルック | `迪卢克` |
| ディオナ | `迪奥娜` |
| ドリー | `多莉` |
| エウルア | `优菈` |
| フィッシュル | `菲谢尔` |
| 甘雨 | `甘雨` |
| 鹿野院平蔵 | `鹿野院平藏` |
| 空 | `空` |
| 蛍 | `荧` |
| 胡桃 | `胡桃` |
| 一斗 | `一斗` |
| ガイヤ | `凯亚` |
| 楓原万葉 | `万叶` |
| 刻晴 | `刻晴` |
| クレー | `可莉` |
| 珊瑚宮心海 | `心海` |
| 九条裟羅 | `九条裟罗` |
| リサ | `丽莎` |
| モナ | `莫娜` |
| ナヒーダ | `纳西妲` |
| ニィロウ | `妮露` |
| 凝光 | `凝光` |
| ノエル | `诺艾尔` |
| オズ | `奥兹` |
| パイモン | `派蒙` |
| ジン | `琴` |
| 七七 | `七七` |
| 電将軍 | `雷电将军` |
| レザー | `雷泽` |
| ロサリア | `罗莎莉亚` |
| 早柚 | `早柚` |
| スカラマシュ | `散兵` |
| 申鶴 | `申鹤` |
| 久岐忍 | `久岐忍` |
| レディ | `女士` |
| スクロース | `砂糖` |
| タルタリヤ | `达达利亚` |
| トーマ | `托马` |
| ティナリ | `提纳里` |
| ウェンティ | `温迪` |
| 香菱 | `香菱` |
| 魈 | `魈` |
| 行秋 | `行秋` |
| 辛焱 | `辛焱` |
| 八重神子 | `八重神子` |
| 煙緋 | `烟绯` |
| 夜蘭 | `夜兰` |
| 宵宮 | `宵宫` |
| 雲菫 | `云堇` |
| 鍾離 | `钟离` |
