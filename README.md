# gourmet-video-prompts

Instagramのグルメリール（縦型ショート動画）を作るためのプロンプト集です。
素材動画（複数本）＋キャプション案・お店情報を渡すと、AIが以下をまとめて作ります。

- 素材の分析（使う/使わないクリップと秒数）
- 秒単位の編集台本（テロップ・演出・効果音）
- カバー（サムネ）案 / BGMの提案
- キャプション（店舗情報ブロック付き）とハッシュタグ
- A/Bテスト用の別パターン

## 使い方

1. `prompts/instagram-gourmet-reel.md` の「プロンプト本文」をコピーしてAIに貼る
2. その下に `templates/input-template.md` を埋めたものを貼る
3. 動画ファイルを添付して送信
4. 出てきた編集台本をもとに、CapCut・VN・Instagramの編集機能などで編集

> 動画を直接読み込めるAI（例：動画入力に対応したモデル）ならクリップの中身まで分析します。
> 動画を読めない場合でも、テンプレートの「クリップメモ」を書けば台本を作れます。

## ファイル構成

| ファイル | 内容 |
|---|---|
| `prompts/instagram-gourmet-reel.md` | メインのプロンプト |
| `templates/input-template.md` | 毎回埋める入力テンプレート |
| `examples/sample-input.md` | 記入例 |
