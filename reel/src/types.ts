// plan.json の型。書き方の説明は .claude/skills/gourmet-reel/plan-schema.md を参照

export type Motion =
  | 'none'
  | 'slow_zoom_in'
  | 'slow_zoom_out'
  | 'punch_in'
  | 'pan_left'
  | 'pan_right'
  | 'pan_up'
  | 'pan_down'
  | 'shake';

export type Grade = 'food' | 'warm' | 'fresh' | 'moody' | 'none';

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'slide'
  | 'wipe'
  | 'flip'
  | 'clock_wipe'
  | 'whip'
  | 'zoom'
  | 'flash';

export type Direction = 'left' | 'right' | 'up' | 'down';

export type Clip = {
  source: string; // materials 内のファイル名（例: v3.mp4）
  type: 'video' | 'photo';
  in?: number; // 動画: 素材の何秒目から使うか
  duration: number; // 完成動画での表示秒数（カット点からカット点まで）
  speed?: number; // 0.5 = スロー, 1.5 = 早送り
  motion?: Motion;
  focus?: {x: number; y: number}; // 縦に切り抜くときの中心（0〜1）
  zoom?: number; // 1 = そのまま。1.2 = 寄りで切り抜き
  volume?: number; // 原音の音量 0〜1
  grade?: Grade;
  transition?: {type: TransitionType; duration?: number; direction?: Direction}; // 次のクリップへのつなぎ
};

export type Position = 'top' | 'upper' | 'center' | 'lower' | 'bottom';

export type TelopType =
  | 'hook' // 冒頭のつかみ：1文字ずつ弾んで出る大きい文字
  | 'pop' // ふつうの説明：ポンと出る
  | 'slide' // 帯つきで横からスライド
  | 'marker' // 蛍光ペンが引かれる
  | 'typewriter' // 1文字ずつタイプ
  | 'shake' // ぷるぷる揺れる強調
  | 'onomatopoeia' // 擬音（ジュワッ、とろ〜り）
  | 'price' // 値札スタンプ
  | 'info' // 店舗情報カード
  | 'cta' // 保存してね
  | 'label' // 小さいタグ（PR、限定など）
  | 'caption'; // 字幕テロップ：文章をそのまま読ませる（自動折り返し）

export type Telop = {
  type: TelopType;
  text: string; // 改行は \n
  sub?: string; // 補足（price の「税込」、info の2行目以降など。改行は \n）
  start: number;
  end: number;
  position?: Position;
  x?: number; // 0〜1。指定すると position より優先（擬音・ラベル向け）
  y?: number;
  font?: FontKey;
  color?: string;
  accent?: string;
  size?: number; // 文字の大きさ倍率（1 = 標準）
  rotate?: number; // 度
};

export type StickerType = 'sparkle' | 'steam' | 'circle' | 'arrow' | 'speedlines' | 'hearts';

export type Sticker = {
  type: StickerType;
  start: number;
  end: number;
  x: number; // 0〜1
  y: number;
  size?: number; // 1 = 標準
  color?: string;
  rotate?: number; // arrow の向き（度。0 = 右向き）
};

export type Sfx = {
  type: 'pop' | 'whoosh' | 'ding' | 'shutter' | 'boing';
  at: number;
  volume?: number;
};

export type FontKey =
  | 'dela' // Dela Gothic One: 極太。つかみ・擬音
  | 'rounded' // M PLUS Rounded 1c: 丸ゴシック。カフェ・スイーツ
  | 'maru' // Zen Maru Gothic: やわらかい丸ゴシック
  | 'gothic' // Noto Sans JP: 標準のゴシック
  | 'kaku' // Zen Kaku Gothic New: すっきりしたゴシック
  | 'mincho' // Shippori Mincho: 明朝。和食・高級店
  | 'pop' // Mochiy Pop One: ポップ
  | 'hand' // Yusei Magic: 手書き風
  | 'rocknroll'; // RocknRoll One: 元気・ラーメン

export type Theme = {
  font?: FontKey; // 基本フォント
  headFont?: FontKey; // hook / 擬音 / price 用
  color?: string; // 文字色
  accent?: string; // 強調色（マーカー・値札など）
  outline?: string; // フチの色
  grade?: Grade; // 全クリップ共通の色味
};

export type Plan = {
  fps?: number;
  duration?: number;
  theme?: Theme;
  clips: Clip[];
  telops?: Telop[];
  stickers?: Sticker[];
  sfx?: Sfx[];
  bgm?: {file: string; volume?: number; start?: number};
  cover?: {time: number};
};
