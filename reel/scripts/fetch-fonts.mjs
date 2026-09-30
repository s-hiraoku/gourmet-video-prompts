// テロップ用の日本語フォント（Google Fonts / SIL OFL）を public/fonts にダウンロードする。
// 1回だけ実行すればOK。レンダリング時はネットにつながなくても使える。
// 実行: node scripts/fetch-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'font-list.json'), 'utf8'));
const outRoot = path.join(here, '..', 'public', 'fonts');

const jobs = [];
for (const [key, {module, weight}] of Object.entries(list)) {
  const {getInfo} = await import(`@remotion/google-fonts/${module}`);
  const urls = getInfo().fonts.normal[weight];
  for (const [subset, url] of Object.entries(urls)) {
    jobs.push({file: path.join(outRoot, key, `${subset}.woff2`), url});
  }
}

let done = 0;
let failed = 0;
const worker = async () => {
  while (jobs.length) {
    const {file, url} = jobs.pop();
    if (!fs.existsSync(file)) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      } catch (e) {
        failed++;
        console.error(`失敗: ${url} (${e.message})`);
      }
    }
    if (++done % 100 === 0) console.log(`フォント ${done} ファイル…`);
  }
};
await Promise.all(Array.from({length: 12}, worker));
console.log(failed ? `フォントの取得で ${failed} 件失敗しました。もう一度実行してください。` : 'フォントの準備ができました。');
process.exit(failed ? 1 : 0);
