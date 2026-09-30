# gourmet-video-prompts

Instagram のグルメリール（縦型 1080x1920、デフォルト15秒）を、素材から完成動画まで Claude が作るリポジトリ。

- 制作の依頼が来たら `.claude/skills/gourmet-reel/SKILL.md` の手順に従う（素材は必ず analyze.py のコマ一覧を見て選ぶ）。
- 制作方針: `prompts/instagram-gourmet-reel.md` / 演出: `.claude/skills/gourmet-reel/motion-design.md` / データ形式: `.claude/skills/gourmet-reel/plan-schema.md`
- レンダラーは `reel/`（Remotion + React + TypeScript）。変更したら `cd reel && npx tsc --noEmit` で型チェックし、`examples/sample-plan.json` 相当の plan で静止画を書き出して目で確認する。
- 素材 `materials/`、作業 `work/`、完成品 `output/` は Git に入れない。
- 事実（価格・店名・営業時間）は入力にあるものだけを使う。
