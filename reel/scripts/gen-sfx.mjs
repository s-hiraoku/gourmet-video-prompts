// 効果音（pop / whoosh / ding / shutter / boing）をプログラムで合成して public/sfx に書き出す。
// 著作権フリーの音を毎回同じように作れる。実行: node scripts/gen-sfx.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SR = 44100;
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx');

let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const make = (sec, fn) => {
  const n = Math.floor(SR * sec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
};

const lowpass = (buf, cutoffAt) => {
  let y = 0;
  return buf.map((x, i) => {
    const fc = cutoffAt(i / SR);
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += a * (x - y);
    return y;
  });
};

const sounds = {
  pop: () => {
    let ph = 0;
    return make(0.12, (t) => {
      ph += (2 * Math.PI * (300 + 900 * Math.exp(-t * 40))) / SR;
      return Math.sin(ph) * Math.exp(-t * 35) * Math.min(1, t * 2000);
    });
  },
  whoosh: () => {
    const len = 0.4;
    const noise = make(len, () => rand() * 2 - 1);
    const env = (t) => Math.sin(Math.PI * Math.min(1, t / len)) ** 2;
    return lowpass(noise, (t) => 400 + 3500 * env(t)).map((v, i) => v * env(i / SR) * 2.2);
  },
  ding: () =>
    make(1.3, (t) =>
      (Math.sin(2 * Math.PI * 1320 * t) + 0.45 * Math.sin(2 * Math.PI * 2640 * t) + 0.2 * Math.sin(2 * Math.PI * 3960 * t)) *
      Math.exp(-t * 3.5) * Math.min(1, t * 800) * 0.5,
    ),
  shutter: () =>
    make(0.16, (t) => {
      const click = (t0) => (t >= t0 ? Math.exp(-(t - t0) * 180) : 0);
      return (rand() * 2 - 1) * (click(0) + 0.8 * click(0.075));
    }),
  boing: () => {
    let ph = 0;
    return make(0.45, (t) => {
      ph += (2 * Math.PI * (180 + 90 * Math.sin(2 * Math.PI * 14 * t) * Math.exp(-t * 5) + 120 * t)) / SR;
      return Math.sin(ph) * Math.exp(-t * 6) * Math.min(1, t * 500);
    });
  },
};

const toWav = (samples) => {
  const peak = Math.max(...samples.map(Math.abs)) || 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round((v / peak) * 0.89 * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
};

fs.mkdirSync(outDir, {recursive: true});
for (const [name, fn] of Object.entries(sounds)) {
  fs.writeFileSync(path.join(outDir, `${name}.wav`), toWav(Array.from(fn())));
  console.log(`sfx/${name}.wav`);
}
