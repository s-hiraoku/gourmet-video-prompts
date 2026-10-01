import * as dela from '@remotion/google-fonts/DelaGothicOne';
import * as emoji from '@remotion/google-fonts/NotoColorEmoji';
import * as gothic from '@remotion/google-fonts/NotoSansJP';
import * as hand from '@remotion/google-fonts/YuseiMagic';
import * as kaku from '@remotion/google-fonts/ZenKakuGothicNew';
import * as maru from '@remotion/google-fonts/ZenMaruGothic';
import * as mincho from '@remotion/google-fonts/ShipporiMincho';
import * as pop from '@remotion/google-fonts/MochiyPopOne';
import * as rocknroll from '@remotion/google-fonts/RocknRollOne';
import * as rounded from '@remotion/google-fonts/MPLUSRounded1c';
import type {FontKey} from './types';

import {continueRender, delayRender, staticFile} from 'remotion';
import FONT_LIST from './font-list.json';

type FontModule = {
  getInfo: () => {fontFamily: string; unicodeRanges: Record<string, string>};
};

const MODULES: Record<FontKey, FontModule> = {
  dela: dela as unknown as FontModule,
  rounded: rounded as unknown as FontModule,
  maru: maru as unknown as FontModule,
  gothic: gothic as unknown as FontModule,
  kaku: kaku as unknown as FontModule,
  mincho: mincho as unknown as FontModule,
  pop: pop as unknown as FontModule,
  hand: hand as unknown as FontModule,
  rocknroll: rocknroll as unknown as FontModule,
  gothic_m: gothic as unknown as FontModule,
};

const EMOJI = emoji as unknown as FontModule;
const WEIGHTS = FONT_LIST as Record<FontKey | 'emoji', {module: string; weight: string}>;

export const EMOJI_FONT = '"Noto Color Emoji"';

export const FONT_KEYS = Object.keys(MODULES) as FontKey[];

export const fontFamily = (key: FontKey) =>
  `"${MODULES[key].getInfo().fontFamily}", "Hiragino Sans", "Noto Sans JP", ${EMOJI_FONT}, sans-serif`;

export const fontWeight = (key: FontKey) => Number(WEIGHTS[key].weight);

const parseRanges = (ranges: string): Array<[number, number]> =>
  ranges.split(',').map((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
    const start = parseInt(a, 16);
    return [start, b ? parseInt(b, 16) : start];
  });

const loaded = new Set<string>();

const loadSubsets = (id: string, info: ReturnType<FontModule['getInfo']>, dir: string, weight: string, text: string) => {
  const codes = [...new Set(Array.from(text).map((ch) => ch.codePointAt(0)!))];
  for (const [subset, range] of Object.entries(info.unicodeRanges)) {
    const key = `${id}/${subset}`;
    if (loaded.has(key) || !parseRanges(range).some(([s, e]) => codes.some((c) => c >= s && c <= e))) {
      continue;
    }
    loaded.add(key);
    const handle = delayRender(`font ${key}`);
    const face = new FontFace(info.fontFamily, `url(${staticFile(`fonts/${dir}/${subset}.woff2`)}) format('woff2')`, {
      weight,
      unicodeRange: range,
    });
    face
      .load()
      .then(() => {
        document.fonts.add(face);
        continueRender(handle);
      })
      .catch(() => {
        // フォントがなくても止めずに、代わりのフォントで続ける
        console.warn(`フォント ${key} が読み込めませんでした（node reel/scripts/fetch-fonts.mjs を実行してください）`);
        continueRender(handle);
      });
  }
};

// 日本語フォントは100個以上のファイルに分かれているので、実際に使う文字を含むファイルだけ読み込む。
// ファイルは scripts/fetch-fonts.mjs で public/fonts にダウンロード済みのものを使う（ネット不要）
export const loadFonts = (usage: Map<FontKey, string>) => {
  let all = '';
  for (const [key, text] of usage) {
    loadSubsets(key, MODULES[key].getInfo(), key, WEIGHTS[key].weight, text + '0123456789');
    all += text;
  }
  // 絵文字（✨🍶😭❤️ など）はカラー絵文字フォントで表示する
  const emojiChars = Array.from(all).filter((ch) => /\p{Extended_Pictographic}/u.test(ch)).join('');
  if (emojiChars) {
    loadSubsets('emoji', EMOJI.getInfo(), 'emoji', WEIGHTS.emoji.weight, emojiChars);
  }
};
