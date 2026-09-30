# gourmet-video-prompts

Instagram のグルメリールを、**Claude が素材を見て選び、モーショングラフィックス付きの完成動画まで仕上げる**ためのリポジトリです。
動画は縦型 1080×1920、長さは**デフォルト15秒**です。

## できること

- **素材の選定**：動画・写真をコマ単位で見て、ブレや暗いカットを外す。一番おいしそうな瞬間を 0.1 秒単位で切り出す
- **構成**：0〜2秒のつかみ → 全体 → シズル → 価格 → 店舗情報と「保存してね」
- **モーショングラフィックス**
  - テロップ13種類：上品なメインコピー（縦書きも可）、1文字ずつ弾むつかみ、漫画風の擬音（ジュワッ・とろ〜り）、値札スタンプ、蛍光ペン、店舗カード、保存ボタン、文章を読ませる字幕テロップ（絵文字・強調色つき） など
  - ステッカー：湯気、キラキラ、集中線、手書きの丸・矢印、ハート
  - トランジション：フラッシュ、ウィップパン、ズーム、スライド など
  - 画面分割（2〜3品を並べる）、保存ボタンをタップするアニメーション
  - カメラの動き：グッと寄る、ゆっくりズーム、パン、衝撃の揺れ。スローモーションも使える
  - 料理がおいしく見える色補正
  - 効果音：ポン、シュッ、チーン など（著作権フリーの自作音）
- **日本語フォント9種類**：極太、丸ゴシック、明朝、手書き風 など。お店のジャンルに合わせて選ぶ
- **納品物**：`output/reel.mp4`（完成動画）、`output/cover.jpg`（カバー画像）、`output/caption.md`（キャプション・ハッシュタグ）
- Claude が完成動画をコマ送りで見直し、テロップのかぶりやはみ出しを直してから渡す

## 使い方

1. **素材を `materials` フォルダに入れる**
   動画は `v1.mp4`, `v2.mov`…、写真は `p1.jpg`, `p2.jpg`… のように名前を付けると指示しやすいです（iPhone の HEIC 写真もそのまま入れて OK）。
2. **Claude Code に頼む**。例：

   > materials の素材でリールを作って。
   > 店名：チーズキッチン○○ / 渋谷駅徒歩5分 / チーズハンバーグ 1,480円
   > テロップ：「チーズあふれすぎハンバーグ」を最初に、「肉汁もすごい」を割るところで（整えてOK）

   情報が多いときは `templates/input-template.md` を埋めて貼り付けると確実です（記入例：`examples/sample-input.md`）。
   秒数ごとの**構成案**（映像・テロップ）があれば、そのまま貼り付けると構成案どおりに作ります（例：`examples/sample-structure-sushi.md`、`examples/sample-structure-sushi-cinematic.md`）。スタイルは混ぜても大丈夫です。
3. `output/` にできた動画・カバー画像・キャプションを確認して、インスタに投稿します。インスタ内の曲を使う場合は、投稿画面で付けてください。

直したいところは「2つ目のテロップをもっと大きく」「最後をスローに」など、そのまま Claude に伝えれば作り直します。

## 初回セットアップ

Node.js 18 以上と Python 3 が必要です。Claude がやってくれますが、手動なら次を実行します。

```bash
bash scripts/setup.sh
```

## 仕組み

```
materials/（素材）
   │  python3 scripts/analyze.py      素材をコマ一覧画像と音量の変化に変換 → Claude が見て選ぶ
   ▼
work/plan.json                        Claude が書く編集データ（カット・テロップ・演出）
   │  node reel/render.mjs work/plan.json
   ▼
output/reel.mp4                       Remotion（React）で書き出し
   │  python3 scripts/analyze.py output/reel.mp4
   ▼
Claude が見直して修正 → 完成
```

## ファイル構成

| 場所 | 内容 |
|---|---|
| `.claude/skills/gourmet-reel/` | Claude の制作手順（SKILL.md）、演出ガイド、plan.json の仕様 |
| `prompts/instagram-gourmet-reel.md` | 制作方針（構成・テロップ・キャプションのルール） |
| `templates/input-template.md` | 依頼するときの入力テンプレート |
| `examples/` | 入力の記入例と plan.json の例 |
| `scripts/analyze.py` | 素材・完成動画のコマ一覧と音量を出す |
| `scripts/setup.sh` | 初回セットアップ |
| `reel/` | 動画を書き出す Remotion プロジェクト |
| `materials/` `work/` `output/` | 素材・作業ファイル・完成品（Git には入りません） |

## ライセンスについて

- 動画の書き出しに使っている [Remotion](https://www.remotion.dev/license) は、個人や社員3人以下の会社なら無料で使えます。それより大きい会社で使う場合は、有料のライセンスが必要です。
- フォントは Google Fonts（SIL Open Font License）で、商用利用もできます。
- インスタに投稿した後の音楽の扱いは、Instagram の規約に従ってください。
