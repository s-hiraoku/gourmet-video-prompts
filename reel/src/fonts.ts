import * as dela from '@remotion/google-fonts/DelaGothicOne';
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
};

const WEIGHTS = FONT_LIST as Record<FontKey, {module: string; weight: string}>;

export const FONT_KEYS = Object.keys(MODULES) as FontKey[];

export const fontFamily = (key: FontKey) =>
  `"${MODULES[key].getInfo().fontFamily}", "Hiragino Sans", "Noto Sans JP", sans-serif`;

export const fontWeight = (key: FontKey) => Number(WEIGHTS[key].weight);

const parseRanges = (ranges: string): Array<[number, number]> =>
  ranges.split(',').map((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
    const start = parseInt(a, 16);
    return [start, b ? parseInt(b, 16) : start];
  });

const loaded = new Set<string>();

// 日本語フォントは100個以上のファイルに分かれているので、実際に使う文字を含むファイルだけ読み込む。
// ファイルは scripts/fetch-fonts.mjs で public/fonts にダウンロード済みのものを使う（ネット不要）
export const loadFonts = (usage: Map<FontKey, string>) => {
  for (const [key, text] of usage) {
    const info = MODULES[key].getInfo();
    const codes = [...new Set(Array.from(text + '0123456789').map((ch) => ch.codePointAt(0)!))];
    for (const [subset, range] of Object.entries(info.unicodeRanges)) {
      const id = `${key}/${subset}`;
      if (loaded.has(id) || !parseRanges(range).some(([s, e]) => codes.some((c) => c >= s && c <= e))) {
        continue;
      }
      loaded.add(id);
      const handle = delayRender(`font ${id}`);
      const face = new FontFace(info.fontFamily, `url(${staticFile(`fonts/${key}/${subset}.woff2`)}) format('woff2')`, {
        weight: WEIGHTS[key].weight,
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
          console.warn(`フォント ${id} が読み込めませんでした（node reel/scripts/fetch-fonts.mjs を実行してください）`);
          continueRender(handle);
        });
    }
  }
};
