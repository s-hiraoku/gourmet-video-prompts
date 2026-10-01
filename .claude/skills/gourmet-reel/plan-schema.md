# plan.json の書き方

秒数はすべて**完成動画の中の秒数**（`clips[].in` だけは素材の中の秒数）。

```json
{
  "duration": 15,
  "theme": {"font": "rounded", "headFont": "dela", "accent": "#FFD23F", "color": "#FFFFFF", "outline": "#1A1A1A", "grade": "food"},
  "clips": [
    {"source": "v3.mp4", "in": 2.4, "duration": 2.0, "motion": "punch_in", "focus": {"x": 0.45, "y": 0.5}, "transition": {"type": "flash"}},
    {"source": "p1.jpg", "duration": 1.5, "motion": "slow_zoom_in"}
  ],
  "telops": [
    {"type": "hook", "text": "チーズあふれすぎ\nハンバーグ", "start": 0.0, "end": 2.0, "position": "center"}
  ],
  "stickers": [{"type": "steam", "start": 0, "end": 2, "x": 0.5, "y": 0.55}],
  "sfx": [{"type": "pop", "at": 0.05}],
  "cover": {"time": 1.2}
}
```

## clips（出てくる順）
| キー | 必須 | 内容 |
|---|---|---|
| source | ○ | `materials` のファイル名（拡張子つき） |
| duration | ○ | 表示秒数（カット点からカット点まで）。**合計 = duration** |
| in | 動画 | 素材の何秒目から使うか |
| speed | | 0.5 = スロー、1.5 = 早送り。素材は `duration × speed` 秒ぶん使う |
| motion | | `none` `slow_zoom_in` `slow_zoom_out` `punch_in`（冒頭でグッと寄る） `pan_left` `pan_right` `pan_up` `pan_down` `shake`（衝撃）。写真の標準は `slow_zoom_in` |
| focus | | 縦に切り抜くときの中心 `{x, y}`（0〜1）。横長素材では料理の位置に必ず合わせる |
| zoom | | 1.0〜1.6。寄りで切り抜く |
| volume | | 原音 0〜1（標準 1）。カットの頭と終わりは自動で短くフェードする |
| grade | | `food` `warm` `fresh` `moody` `none`（標準は theme.grade） |
| transition | | 次のクリップへのつなぎ `{type, duration?, direction?}`。type: `cut` `fade` `slide` `wipe` `flip` `clock_wipe` `whip` `zoom` `flash`、direction: `left` `right` `up` `down` |

### 画面分割（2〜3品を並べる）
`source` の代わりに `items` を書く。各 item は `source` `in` `speed` `motion` `focus` `zoom` `volume` `grade` を持てる。
```json
{"items": [{"source": "v5.mp4", "in": 1.0}, {"source": "p3.jpg", "motion": "slow_zoom_out"}], "split": "stack", "dividerColor": "#E9C46A", "duration": 2.5}
```
- `split`: `stack`（上下・標準） / `side`（左右）。2つ目以降は少し遅れてワイプで現れる。背景は1つ目のぼかし。
- 原音は1つ目だけ（2つ目以降は `volume` 0。鳴らしたい時は指定）。
- 上下分割は1枠が横長（1080×960）になるので、`focus` で料理の中心を合わせる。

つなぎはカット点をまたいで半分ずつ重なるので、合計の長さは変わらない。
動画で前につなぎがある場合、`in` より少し前（つなぎの半分 × speed）から映る。

## telops
| キー | 必須 | 内容 |
|---|---|---|
| type | ○ | 下の表 |
| text | ○ | 文言。改行は `\n`。`**…**` で囲んだ部分は accent 色で強調。絵文字（✨🍶😭❤️👇）はカラーで表示 |
| start / end | ○ | 表示する秒数 |
| sub | | 補足（price の「税込」、info の2行目以降。改行 `\n`） |
| position | | `top`(17%) `upper`(30%) `center`(50%) `lower`(64%) `bottom`(72%) |
| x / y | | 0〜1 で位置を直接指定（position より優先） |
| font / color / accent | | テーマを上書き |
| size | | 大きさ倍率（標準 1）。長い文は自動で縮む |
| rotate | | 傾き（度） |
| vertical | | `title` / `plain` を縦書きにする（被写体の左右の余白、x 0.15〜0.25 か 0.8〜0.85） |

| type | 見た目・動き | 使いどころ |
|---|---|---|
| hook | 極太文字が1文字ずつ弾んで出る。1行目は accent 色 | 冒頭のつかみ |
| pop | ポンと出る白文字 | ふつうの説明 |
| slide | accent 色の帯が伸びて文字がスライド | 場所・メニュー名 |
| marker | 蛍光ペンが引かれる | 感想・推しポイント |
| typewriter | 1文字ずつタイプ（黒い帯） | 会話っぽい一言 |
| shake | accent 色でぷるぷる揺れる | 「うまっ！」などの強調 |
| onomatopoeia | 漫画風の擬音が1文字ずつ飛び出す | ジュワッ、とろ〜り、パリッ |
| price | 円形の値札スタンプ（text=価格, sub=税込など） | 価格 |
| info | ピン付きの白カード（text=店名, sub=駅・時間など） | 締めの店舗情報 |
| cta | しおりアイコン付きのボタン | 「保存して行ってみて」 |
| label | 小さい枠付きタグ | PR、限定、数量限定 |
| plain | **基本のテロップ**。帯なしの白文字（影だけ）。1カット1フレーズで、カットの切り替わりと同時に出す。`vertical: true` で縦書き。font は `gothic_m` がおすすめ | ほぼすべて |
| title | 上品なメインコピー。文字がぼかしから浮かび、字間がゆっくり締まる。金の細線つき。`vertical: true` で縦書き、`sub` で小さい添え書き | 高級店の冒頭・締めのコピー |
| caption | 半透明の帯に文章。1文字ずつふわっと出る。長い行は自動で縮小・バランスよく折り返し（標準位置 `lower`） | 字幕テロップ。構成案のテロップ、高級店のナレーション的な文 |

## stickers
`{type, start, end, x, y, size?, color?, rotate?}`
| type | 内容 |
|---|---|
| sparkle | キラキラ（ツヤ・新鮮さ） |
| steam | 湯気（y は湯気の根元＝料理の表面） |
| circle | 手書き風の丸で囲む（x, y が中心） |
| arrow | 矢印が (x, y) を指す。rotate で向き（0 = 右向きに指す） |
| speedlines | 漫画の集中線（x, y が中心）。0.5〜0.8秒だけ |
| hearts | ハートがふわっと上がる |
| save_tap | しおり（保存）アイコンが出て、指がタップ → 塗りつぶし＋波紋。x, y を省略すると右下（0.86, 0.78）。1.3秒以上表示 |

## sfx
`{type, at, volume?}`。type: `pop`（ポン） `whoosh`（シュッ） `ding`（チーン） `shutter`（カシャ） `boing`（ボヨン）

## その他
- `bgm`: `{file, volume?, start?}`（materials にある音楽ファイル。インスタの曲を使う場合は入れない）
- `cover`: `{time, telops?}` → その瞬間を `output/cover.jpg` に書き出す。`telops` を書くと、動画のテロップの代わりにカバー専用の文字が入る（動画には出ない）
  - 例: `{"time": 1.9, "telops": [{"type": "title", "text": "人生で一番の\n江戸前すし", "sub": "兵庫・明石　店名", "position": "top", "y": 0.21}]}`
  - プロフィールの一覧では縦 3:4 に切り抜かれるので、文字は y 0.15〜0.85 の間に置く
- `theme.font` / `headFont`: `dela`（極太） `rounded`（丸ゴ） `maru`（やわらか丸ゴ） `gothic`（ゴシック・極太） `gothic_m`（ゴシック・中太。plain 向け） `kaku`（すっきりゴシック） `mincho`（明朝） `pop`（ポップ） `hand`（手書き風） `rocknroll`（元気）
