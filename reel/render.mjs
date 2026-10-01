// plan.json から完成動画を書き出す。
//
//   node reel/render.mjs plan.json                 動画を書き出す（output/reel.mp4）
//   node reel/render.mjs plan.json --check         中身のチェックだけ
//   node reel/render.mjs plan.json --stills 0.5,3  指定秒の静止画だけ書き出す（確認用・速い）
//   node reel/render.mjs plan.json --cover         カバー画像だけ書き出す
//   オプション: --out 出力先.mp4 / --materials 素材フォルダ
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getVideoMetadata, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const REEL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(REEL_DIR, '..');

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac']);
const ENUMS = {
  motion: ['none', 'slow_zoom_in', 'slow_zoom_out', 'punch_in', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'shake'],
  grade: ['food', 'warm', 'fresh', 'moody', 'none'],
  transition: ['cut', 'fade', 'slide', 'wipe', 'flip', 'clock_wipe', 'whip', 'zoom', 'flash'],
  direction: ['left', 'right', 'up', 'down'],
  position: ['top', 'upper', 'center', 'lower', 'bottom'],
  telop: ['hook', 'pop', 'slide', 'marker', 'typewriter', 'shake', 'onomatopoeia', 'price', 'info', 'cta', 'label', 'caption', 'title', 'plain'],
  sticker: ['sparkle', 'steam', 'circle', 'arrow', 'speedlines', 'hearts', 'save_tap'],
  sfx: ['pop', 'whoosh', 'ding', 'shutter', 'boing'],
  font: ['dela', 'rounded', 'maru', 'gothic', 'kaku', 'mincho', 'pop', 'hand', 'rocknroll', 'gothic_m'],
};

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = new Set(['--out', '--materials', '--stills']);
const planPath = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1]));
if (!planPath) {
  console.error('使い方: node reel/render.mjs plan.json [--check] [--stills 0.5,3] [--out output/reel.mp4]');
  process.exit(1);
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const readPlan = (p) => {
  let text = fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1];
  return JSON.parse(text);
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const checkEnum = (where, key, value, list) => {
  if (value !== undefined && !list.includes(value)) err(`${where}.${key} は ${list.join(' / ')} のどれかです（今: ${JSON.stringify(value)}）`);
};

const main = async () => {
  const plan = readPlan(path.resolve(planPath));
  const materials = path.resolve(opt('--materials') ?? path.join(ROOT, 'materials'));
  const fps = plan.fps ?? 30;

  if (!Array.isArray(plan.clips) || plan.clips.length === 0) err('clips が空です。');
  if (!fs.existsSync(materials)) err(`素材フォルダ ${materials} がありません。`);
  checkEnum('theme', 'font', plan.theme?.font, ENUMS.font);
  checkEnum('theme', 'headFont', plan.theme?.headFont, ENUMS.font);
  checkEnum('theme', 'grade', plan.theme?.grade, ENUMS.grade);

  const usedFiles = new Set();
  let total = 0;
  // 1つの素材（clip そのもの、または分割表示の items の1つ）をチェック
  const checkPane = async (w, c, duration) => {
    const file = path.join(materials, c.source ?? '');
    const ext = path.extname(c.source ?? '').toLowerCase();
    if (!c.source || !fs.existsSync(file)) {
      err(`${w}: 素材 ${c.source} が materials にありません。`);
      return;
    }
    usedFiles.add(c.source);
    const type = c.type ?? (PHOTO_EXT.has(ext) ? 'photo' : 'video');
    c.type = type;
    if (type === 'photo' && !PHOTO_EXT.has(ext)) err(`${w}: 写真は jpg / png / webp にしてください（HEIC は analyze.py で変換）。`);
    if (type === 'video' && !VIDEO_EXT.has(ext)) err(`${w}: 動画の形式 ${ext} には対応していません。`);
    checkEnum(w, 'motion', c.motion, ENUMS.motion);
    checkEnum(w, 'grade', c.grade, ENUMS.grade);
    if (c.focus && !(isNum(c.focus.x) && isNum(c.focus.y) && c.focus.x >= 0 && c.focus.x <= 1 && c.focus.y >= 0 && c.focus.y <= 1)) {
      err(`${w}.focus は {x: 0〜1, y: 0〜1} で指定してください。`);
    }
    if (type === 'video' && isNum(duration)) {
      const meta = await getVideoMetadata(file);
      const need = (c.in ?? 0) + duration * (c.speed ?? 1);
      if (need > meta.durationInSeconds + 0.05) {
        err(`${w}: ${c.source} は ${meta.durationInSeconds.toFixed(2)} 秒しかありませんが、${(c.in ?? 0)}秒から ${need.toFixed(2)} 秒まで使おうとしています。`);
      }
    }
  };

  for (const [i, c] of (plan.clips ?? []).entries()) {
    const w = `clips[${i}]`;
    if (!isNum(c.duration) || c.duration <= 0) err(`${w}.duration は 0 より大きい数値にしてください。`);
    if (c.transition) {
      checkEnum(`${w}.transition`, 'type', c.transition.type, ENUMS.transition);
      checkEnum(`${w}.transition`, 'direction', c.transition.direction, ENUMS.direction);
    }
    if (c.items !== undefined) {
      if (!Array.isArray(c.items) || c.items.length < 2 || c.items.length > 3) err(`${w}.items は2〜3個にしてください。`);
      checkEnum(w, 'split', c.split, ['stack', 'side']);
      for (const [j, item] of (c.items ?? []).entries()) await checkPane(`${w}.items[${j}]`, item, c.duration);
    } else {
      await checkPane(w, c, c.duration);
    }
    total += isNum(c.duration) ? c.duration : 0;
  }

  const inRange = (w, s, e) => {
    if (!isNum(s) || !isNum(e) || e <= s) err(`${w}: start / end の秒数が正しくありません。`);
    else if (e > total + 0.01) err(`${w}: end (${e}) が動画の長さ (${total.toFixed(2)} 秒) を超えています。`);
  };
  for (const [i, t] of (plan.telops ?? []).entries()) {
    const w = `telops[${i}]`;
    checkEnum(w, 'type', t.type, ENUMS.telop);
    checkEnum(w, 'position', t.position, ENUMS.position);
    checkEnum(w, 'font', t.font, ENUMS.font);
    inRange(w, t.start, t.end);
    if (!t.text) err(`${w}: text が空です。`);
    const plain = String(t.text ?? '').replace(/\*\*/g, '');
    if (t.type === 'caption' || t.type === 'plain') {
      // 字幕テロップは読む速さ（1秒に約8文字）で表示時間をチェック
      const len = [...new Intl.Segmenter('ja', {granularity: 'grapheme'}).segment(plain.replace(/\n/g, ''))].length;
      const need = len / 8 + 0.3;
      const longestLine = Math.max(...plain.split('\n').map((l) => [...new Intl.Segmenter('ja', {granularity: 'grapheme'}).segment(l)].length));
      if (longestLine > 18) warn(`${w}: 1行 ${longestLine} 文字あり、文字が小さくなります（16文字前後で改行推奨）。`);
      if (isNum(t.start) && isNum(t.end) && t.end - t.start < need) {
        warn(`${w}: ${len} 文字を読むには約 ${need.toFixed(1)} 秒必要です（今 ${(t.end - t.start).toFixed(1)} 秒）。`);
      }
    } else {
      const longest = Math.max(...plain.split('\n').map((l) => [...l].length));
      if (longest > 15) warn(`${w}: 1行 ${longest} 文字は長めです（15文字以内推奨。文章を読ませるなら type: caption）。`);
      if (plain.split('\n').length > 2 && t.type !== 'info') warn(`${w}: 3行以上あります。`);
    }
    if (isNum(t.start) && isNum(t.end) && t.end - t.start < 0.8) warn(`${w}: 表示が ${(t.end - t.start).toFixed(2)} 秒と短く、読めない可能性があります。`);
  }
  // 指示レビュー用の自動チェック（制作方針「指示のレビューと代替案」）
  const telops = plan.telops ?? [];
  // テンポ：長すぎるカットと、何カットにもまたがるテロップ（1カット1フレーズが基本）
  for (const [i, c] of (plan.clips ?? []).entries()) {
    if (isNum(c.duration) && c.duration > 3) warn(`clips[${i}]: ${c.duration}秒は長めです（1カット1.0〜2.5秒が目安。動きのあるスローの見せ場は除く）。`);
  }
  const cutsAt = [0];
  (plan.clips ?? []).forEach((c) => cutsAt.push(cutsAt[cutsAt.length - 1] + (isNum(c.duration) ? c.duration : 0)));
  for (const [i, t] of telops.entries()) {
    if (['label', 'title', 'info'].includes(t.type) || !isNum(t.start) || !isNum(t.end)) continue;
    const spanned = cutsAt.slice(0, -1).filter((s, k) => s < t.end - 0.05 && cutsAt[k + 1] > t.start + 0.05).length;
    if (spanned >= 3) warn(`telops[${i}]: ${spanned}カットにまたがっています（フレーズに分けて1カット1フレーズにするとテンポが出ます）。`);
  }
  const RISKY = ['日本一', '世界一', '宇宙一', '絶対', '最強', '最高級', '必ず', '100%', '完璧', '痩せる', '健康に良い', '美肌', '効く', '治る', '業界初', 'No.1', 'ナンバーワン'];
  for (const [i, t] of telops.entries()) {
    const hit = RISKY.filter((word) => String(t.text ?? '').includes(word) || String(t.sub ?? '').includes(word));
    if (hit.length) warn(`telops[${i}]: 「${hit.join('」「')}」は誇大表現・根拠の必要な表現になりやすいです（代替案を検討）。`);
  }
  if (total > 0 && !telops.some((t) => isNum(t.start) && t.start <= 1.0)) {
    warn('最初の1秒以内に出るテロップがありません（フックが弱くなりやすい）。');
  }

  const closers = [...telops.filter((t) => ['cta', 'info', 'title', 'caption'].includes(t.type)), ...(plan.stickers ?? []).filter((st) => st.type === 'save_tap')];
  const closing = closers.filter((x) => isNum(x.end) && x.end >= total - 0.3);
  if (total > 0 && closing.length === 0) warn('最後に締め（CTA・店舗情報・保存タップ）がありません。');
  else if (closing.length && Math.max(...closing.map((x) => x.end - x.start)) < 2) warn('締め（CTA）の表示が2秒未満です。');
  for (let f = 0; f < total; f += 0.25) {
    const n = telops.filter((t) => t.type !== 'label' && t.start <= f && f < t.end).length;
    if (n >= 3) {
      warn(`${f.toFixed(2)}秒付近でテロップが ${n} つ同時に出ています（2つまで推奨）。`);
      break;
    }
  }


  for (const [i, s] of (plan.stickers ?? []).entries()) {
    const w = `stickers[${i}]`;
    checkEnum(w, 'type', s.type, ENUMS.sticker);
    inRange(w, s.start, s.end);
    if (s.type !== 'save_tap' && (!isNum(s.x) || !isNum(s.y))) err(`${w}: x / y（0〜1）が必要です。`);
  }
  for (const [i, s] of (plan.sfx ?? []).entries()) {
    checkEnum(`sfx[${i}]`, 'type', s.type, ENUMS.sfx);
    if (!isNum(s.at) || s.at < 0 || s.at > total) err(`sfx[${i}].at が動画の範囲外です。`);
  }
  if (plan.bgm) {
    const f = path.join(materials, plan.bgm.file ?? '');
    if (!plan.bgm.file || !fs.existsSync(f)) err(`bgm: ${plan.bgm.file} が materials にありません。`);
    else if (!AUDIO_EXT.has(path.extname(f).toLowerCase())) err('bgm: mp3 / wav / m4a / aac にしてください。');
    usedFiles.add(plan.bgm.file);
  }
  if (isNum(plan.duration) && Math.abs(plan.duration - total) > 0.01) {
    err(`clips の合計 ${total.toFixed(2)} 秒が duration ${plan.duration} 秒と一致しません。`);
  }

  console.log(`素材 ${plan.clips?.length ?? 0} カット / テロップ ${plan.telops?.length ?? 0} / ステッカー ${plan.stickers?.length ?? 0} / 効果音 ${plan.sfx?.length ?? 0} / 合計 ${total.toFixed(2)} 秒`);
  warnings.forEach((m) => console.log(`注意: ${m}`));
  if (errors.length) {
    errors.forEach((m) => console.error(`エラー: ${m}`));
    process.exit(1);
  }
  if (args.includes('--check')) {
    console.log('チェックOK');
    return;
  }

  // 使う素材だけを Remotion の public/materials に置く（ハードリンク。できなければコピー）
  const pub = path.join(REEL_DIR, 'public', 'materials');
  fs.rmSync(pub, {recursive: true, force: true});
  fs.mkdirSync(pub, {recursive: true});
  for (const name of usedFiles) {
    const src = path.join(materials, name);
    const dst = path.join(pub, name);
    try {
      fs.linkSync(src, dst);
    } catch {
      fs.copyFileSync(src, dst);
    }
  }
  if (!fs.existsSync(path.join(REEL_DIR, 'public', 'sfx', 'pop.wav'))) {
    execFileSync(process.execPath, [path.join(REEL_DIR, 'scripts', 'gen-sfx.mjs')], {stdio: 'inherit'});
  }
  const fontKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(REEL_DIR, 'src', 'font-list.json'), 'utf8')));
  if (fontKeys.some((k) => !fs.existsSync(path.join(REEL_DIR, 'public', 'fonts', k)))) {
    console.log('フォントをダウンロードしています（初回のみ）…');
    execFileSync(process.execPath, [path.join(REEL_DIR, 'scripts', 'fetch-fonts.mjs')], {
      stdio: 'inherit',
      env: {...process.env, NODE_USE_ENV_PROXY: '1'},
    });
  }

  const browserExecutable =
    process.env.REMOTION_BROWSER_EXECUTABLE ??
    ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => fs.existsSync(p)) ??
    null;

  console.log('準備中…');
  const serveUrl = await bundle({entryPoint: path.join(REEL_DIR, 'src', 'index.ts'), publicDir: path.join(REEL_DIR, 'public')});
  const composition = await selectComposition({serveUrl, id: 'Reel', inputProps: plan, browserExecutable});

  // カバー画像（cover.telops があればその文字入り）。props はコンポジション選択時に確定するので選び直す
  const renderCover = async (dir = path.join(ROOT, 'output')) => {
    if (!plan.cover || !isNum(plan.cover.time)) return;
    const coverOut = path.join(dir, 'cover.jpg');
    const coverProps = {...plan, _cover: true};
    const coverComposition = await selectComposition({serveUrl, id: 'Reel', inputProps: coverProps, browserExecutable});
    const frame = Math.min(coverComposition.durationInFrames - 1, Math.round(plan.cover.time * fps));
    fs.mkdirSync(dir, {recursive: true});
    await renderStill({serveUrl, composition: coverComposition, inputProps: coverProps, frame, output: coverOut, imageFormat: 'jpeg', jpegQuality: 95, browserExecutable});
    console.log(`カバー画像: ${path.relative(ROOT, coverOut)}`);
  };
  if (args.includes('--cover')) {
    await renderCover();
    return;
  }

  const stills = opt('--stills');
  if (stills) {
    const dir = path.join(ROOT, 'output', 'stills');
    fs.mkdirSync(dir, {recursive: true});
    for (const s of stills.split(',').map(Number)) {
      const frame = Math.min(composition.durationInFrames - 1, Math.round(s * fps));
      const output = path.join(dir, `still_${s.toFixed(2)}s.jpg`);
      await renderStill({serveUrl, composition, inputProps: plan, frame, output, imageFormat: 'jpeg', jpegQuality: 90, browserExecutable});
      console.log(`静止画: ${path.relative(ROOT, output)}`);
    }
    return;
  }

  const out = path.resolve(opt('--out') ?? path.join(ROOT, 'output', 'reel.mp4'));
  fs.mkdirSync(path.dirname(out), {recursive: true});
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    inputProps: plan,
    codec: 'h264',
    crf: 17,
    pixelFormat: 'yuv420p',
    colorSpace: 'bt709',
    imageFormat: 'jpeg',
    jpegQuality: 95,
    audioCodec: 'aac',
    audioBitrate: '192k',
    outputLocation: out,
    browserExecutable,
    onProgress: ({progress}) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        last = pct;
        process.stdout.write(`書き出し中 ${pct}%\n`);
      }
    },
  });
  console.log(`完成: ${path.relative(ROOT, out)}`);

  await renderCover();
};

main().catch((e) => {
  console.error(`エラー: ${e.message}`);
  process.exit(1);
});
