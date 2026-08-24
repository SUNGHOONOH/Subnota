/**
 * 브랜드 래스터 자산 생성기 — Glass mark · tray.png · icon.ico · DMG 배경.
 *
 * 왜 qlmanage를 안 쓰는가: macOS의 Quick Look 썸네일은 투명 배경을 흰색으로
 * 채운다. 메뉴바 아이콘이 흰 사각형으로 보이던 원인이고, 앱 아이콘의 둥근
 * 모서리도 같은 이유로 흰색이 된다. sharp는 알파를 그대로 보존한다.
 * (sharp는 이미 의존성이다 — 새로 추가한 것이 아니다.)
 *
 *   node scripts/generate-brand-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCES = path.join(ROOT, 'resources');
const GLASS_ICON_PATH = path.join(RESOURCES, 'icon-glass-1024.png');
const GLASS_MARK_PATH = path.join(RESOURCES, 'icon-glass-mark-1024.png');

/** 오른쪽 잎 한 장만 다른 색이다(말라카이트). app-color-brand-petal 과 같은 값. */
const BRAND_PETAL = '#0b6e4f';
/** 강조 잎의 자리. SubnotaMark.tsx 의 SUBNOTA_ACCENT_PETAL 과 같아야 한다. */
const ACCENT_INDEX = 1;

const PETAL =
  'M0,-4 C-10,-11 -15,-30 -11,-41 C-8,-48 8,-48 11,-41 C15,-30 10,-11 0,-4 Z';
const PLACEMENTS = [
  [49.7, 47, -6, 1.04],
  [52.8, 48.9, 68, 0.97],
  [51.7, 52.5, 145, 1.06],
  [48.5, 52.6, 210, 0.98],
  [47.2, 48.9, 292, 1.02],
];

/**
 * `accent`가 false면 다섯 장이 같은 색이다 — 트레이 템플릿 이미지처럼 색을
 * 버리는 자리에서는 잎을 나눌 이유가 없다.
 */
const petals = (fill, transform = '', accent = true) =>
  `<g fill="${fill}"${transform ? ` transform="${transform}"` : ''}>` +
  PLACEMENTS.map(
    ([x, y, rotate, scale], index) =>
      `<path d="${PETAL}"${accent && index === ACCENT_INDEX ? ` fill="${BRAND_PETAL}"` : ''}` +
      ` transform="translate(${x},${y}) rotate(${rotate}) scale(${scale})"/>`,
  ).join('') +
  '</g>';

/** 마크만. 배경 없음 — 메뉴바·파비콘용. */
const markSvg = (fill, accent = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 112 112">${petals(fill, '', accent)}</svg>`;

/**
 * PNG들을 ICO 컨테이너로 묶는다. Vista 이상은 ICO 안의 PNG를 그대로 읽으므로
 * BMP로 다시 인코딩할 필요가 없다.
 *   ICONDIR(6) + ICONDIRENTRY(16) * N + PNG 데이터
 */
const buildIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ data, size }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 256은 0으로 적는다
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // 팔레트 없음
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
};

/** 이미 배경이 있는 웹 UI용 Glass mark. 앱 아이콘 바탕만 투명화한다. */
const renderGlassMark = async () => {
  const { data, info } = await sharp(GLASS_ICON_PATH)
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    const darkness = 255 - Math.min(red, green, blue);
    const alpha = Math.min(255, Math.max(spread * 8, (darkness - 12) * 4));
    data[index + 3] = Math.round(data[index + 3] * (alpha / 255));
  }

  await sharp(data, { raw: info }).png().toFile(GLASS_MARK_PATH);
};

/**
 * 워드마크 "Subnota" 를 Alegreya Sans 700 아웃라인으로 굳혀 둔 것.
 *
 * 왜 텍스트가 아닌가: 이 SVG는 sharp(librsvg)가 굽는데, librsvg는 시스템에
 * 설치된 폰트만 쓴다. Alegreya Sans는 앱 번들 안의 woff2일 뿐이라 텍스트로
 * 두면 빌드 머신에서 Helvetica로 떨어진다 — 설치 창에서만 로고가 다른 얼굴이
 * 되는 셈이다. 글자를 path로 굳히면 폰트 의존이 사라진다.
 *
 * 좌표계는 1000 upem, 베이스라인이 y=0이고 글자는 위(음수 y)로 자란다.
 * HarfBuzz로 셰이핑해 커닝(GPOS)까지 반영했다.
 * 다시 뽑으려면: fontTools + uharfbuzz 로 woff2 → ttf → SVGPathPen.
 */
const WORDMARK_ADVANCE = 3379.0;
const WORDMARK_PATHS =
  '<path transform="translate(0.0,0.0) scale(1.0000,-1.0000)" d="M448.0 619.0 426.0 502.0 406.0 494.0Q372.0 518.0 335.5 532.0Q299.0 546.0 269.0 546.0Q229.0 546.0 205.0 524.5Q181.0 503.0 181.0 475.0Q181.0 446.0 207.5 426.0Q234.0 406.0 291.0 379.0Q346.0 354.0 380.5 332.5Q415.0 311.0 439.5 276.0Q464.0 241.0 464.0 190.0Q464.0 135.0 434.0 89.5Q404.0 44.0 349.0 17.5Q294.0 -9.0 222.0 -9.0Q127.0 -9.0 31.0 32.0L50.0 158.0L65.0 166.0Q105.0 131.0 152.5 112.5Q200.0 94.0 237.0 94.0Q281.0 94.0 305.5 115.5Q330.0 137.0 330.0 167.0Q330.0 199.0 303.5 219.0Q277.0 239.0 218.0 267.0Q164.0 291.0 130.0 312.0Q96.0 333.0 72.0 368.0Q48.0 403.0 48.0 453.0Q48.0 509.0 78.0 554.5Q108.0 600.0 162.0 626.0Q216.0 652.0 285.0 652.0Q367.0 652.0 448.0 619.0Z"/><path transform="translate(498.0,0.0) scale(1.0000,-1.0000)" d="M505.0 87.0 493.0 17.0Q456.0 -7.0 417.0 -8.0Q388.0 -3.0 369.0 15.0Q350.0 33.0 340.0 67.0H331.0Q274.0 11.0 213.0 -6.0Q137.0 -6.0 97.5 28.5Q58.0 63.0 59.0 128.0L61.0 246.0L56.0 456.0L185.0 467.0L182.0 172.0Q181.0 137.0 196.0 119.0Q211.0 101.0 241.0 101.0Q285.0 101.0 328.0 140.0V456.0L455.0 467.0L446.0 121.0Q446.0 105.0 451.5 98.0Q457.0 91.0 469.0 91.0Q480.0 91.0 496.0 95.0Z"/><path transform="translate(1020.0,0.0) scale(1.0000,-1.0000)" d="M493.0 246.0Q493.0 123.0 432.0 56.5Q371.0 -10.0 263.0 -10.0Q212.0 -10.0 151.0 13.0L81.0 -12.0L65.0 1.0L72.0 191.0L66.0 692.0L198.0 702.0L194.0 399.0H200.0Q228.0 426.0 254.0 442.5Q280.0 459.0 312.0 471.0Q400.0 471.0 446.5 411.5Q493.0 352.0 493.0 246.0ZM369.0 223.0Q369.0 292.0 346.5 328.0Q324.0 364.0 279.0 364.0Q238.0 364.0 193.0 322.0L191.0 208.0L193.0 95.0Q230.0 77.0 263.0 77.0Q313.0 77.0 341.0 113.0Q369.0 149.0 369.0 223.0Z"/><path transform="translate(1537.0,0.0) scale(1.0000,-1.0000)" d="M347.0 290.0Q348.0 325.0 331.5 344.5Q315.0 364.0 284.0 364.0Q239.0 364.0 188.0 321.0V205.0L194.0 0.0H61.0L68.0 192.0L63.0 456.0L189.0 467.0V399.0H196.0Q251.0 449.0 316.0 471.0Q392.0 471.0 432.0 436.5Q472.0 402.0 470.0 337.0L467.0 204.0L473.0 0.0H339.0Z"/><path transform="translate(2066.0,0.0) scale(1.0000,-1.0000)" d="M464.0 241.0Q464.0 119.0 406.0 54.5Q348.0 -10.0 239.0 -10.0Q137.0 -10.0 83.0 50.0Q29.0 110.0 29.0 223.0Q29.0 345.0 87.0 409.5Q145.0 474.0 254.0 474.0Q356.0 474.0 410.0 414.0Q464.0 354.0 464.0 241.0ZM154.0 249.0Q154.0 157.0 176.0 118.0Q198.0 79.0 248.0 79.0Q296.0 79.0 317.5 110.5Q339.0 142.0 339.0 214.0Q339.0 305.0 316.5 344.5Q294.0 384.0 245.0 384.0Q197.0 384.0 175.5 352.0Q154.0 320.0 154.0 249.0Z"/><path transform="translate(2560.0,0.0) scale(1.0000,-1.0000)" d="M316.0 115.0 327.0 105.0 314.0 26.0Q263.0 0.0 210.0 -6.0Q75.0 8.0 75.0 126.0L80.0 209.0L79.0 381.0H17.0L12.0 388.0L19.0 461.0H78.0V538.0L199.0 577.0L208.0 569.0L205.0 461.0H324.0L328.0 454.0L322.0 381.0H203.0L197.0 157.0Q197.0 125.0 209.0 111.5Q221.0 98.0 249.0 98.0Q281.0 98.0 316.0 115.0Z"/><path transform="translate(2898.0,0.0) scale(1.0000,-1.0000)" d="M408.0 343.0Q408.0 325.0 402.0 229.0Q401.0 201.0 399.0 171.5Q397.0 142.0 397.0 121.0Q397.0 104.0 402.0 97.5Q407.0 91.0 420.0 91.0Q430.0 91.0 446.0 95.0L456.0 87.0L444.0 17.0Q412.0 -4.0 371.0 -8.0Q341.0 -5.0 321.0 13.5Q301.0 32.0 294.0 65.0H287.0Q237.0 12.0 184.0 -9.0Q112.0 -8.0 71.0 29.0Q30.0 66.0 30.0 130.0Q30.0 180.0 55.5 208.5Q81.0 237.0 133.0 247.0L286.0 276.0V317.0Q286.0 382.0 222.0 382.0Q191.0 382.0 156.5 368.0Q122.0 354.0 79.0 324.0L69.0 330.0L54.0 418.0Q97.0 445.0 146.0 459.5Q195.0 474.0 244.0 474.0Q321.0 474.0 364.5 439.5Q408.0 405.0 408.0 343.0ZM179.0 186.0Q163.0 182.0 155.5 172.5Q148.0 163.0 148.0 144.0Q148.0 118.0 162.0 103.5Q176.0 89.0 201.0 89.0Q240.0 89.0 283.0 135.0L285.0 209.0Z"/>';

/** 베이스라인 y에 가운데 정렬로 놓는다. */
const wordmark = (cx, baseline, size, fill) => {
  const scale = size / 1000;
  const left = cx - (WORDMARK_ADVANCE * scale) / 2;
  return `<g fill="${fill}" transform="translate(${left.toFixed(1)},${baseline}) scale(${scale})">${WORDMARK_PATHS}</g>`;
};

/**
 * 메모지 괘선. 제목과 안내 문구의 베이스라인을 괘선에 정확히 얹는다 —
 * 줄 위에 쓴 글씨로 읽히게 하려는 것이지 우연이 아니다.
 */
const RULE_TOP = 96;
const RULE_STEP = 30;
const ruledLines = (width, height) => {
  let out = '';
  for (let y = RULE_TOP; y < height; y += RULE_STEP) {
    out += `<path d="M40 ${y} H${width - 40}" stroke="#e9e5db" stroke-width="1"/>`;
  }
  return out;
};

/**
 * 마크가 흩어져 새 자리로 날아간다. 화살표 대신이다 — 커지는 크기와
 * 짙어지는 색이 방향을 말한다. 마지막 한 장만 말라카이트: 로고의 강조 잎과
 * 같은 규칙이다.
 *
 * x 범위는 Finder가 그리는 두 아이콘 사이의 빈 폭이다. 앱 아이콘은
 * 125~235, Applications 별칭은 425~535를 차지한다(forge.config.ts).
 */
const petalTrail = () => {
  const n = 6;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const x = 256 + t * 128;
    const y = 262 - Math.sin(t * Math.PI) * 22;
    const rotate = -34 + t * 104;
    const scale = 0.34 + t * 0.26;
    const last = i === n - 1;
    const opacity = last ? 1 : 0.42 + t * 0.45;
    return (
      `<path d="${PETAL}" fill="${last ? BRAND_PETAL : '#4c71b7'}" opacity="${opacity.toFixed(2)}"` +
      ` transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotate.toFixed(1)})` +
      ` scale(${scale.toFixed(3)})"/>`
    );
  }).join('');
};

/**
 * DMG 창 배경. 창 전체가 메모지 한 장이고, 그 위로 마크가 흩날려 간다.
 * Glass 아이콘은 아래에서 PNG로 합성한다. SVG에서 다시 그리면 Icon Composer의
 * 기본 유리 효과와 실제 DMG 아이콘이 서로 달라진다.
 * 좌표는 forge.config.ts 의 contents 위치와 맞춰야 한다.
 */
const dmgBackgroundSvg = (width, height) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#fbfaf7"/>
  ${ruledLines(width, height)}
  <path d="M78 0 V${height}" stroke="#e0533d" stroke-width="1" opacity="0.28"/>
  ${wordmark(width / 2, 126, 24, '#1f1d1a')}
  <text x="${width / 2}" y="156" text-anchor="middle" fill="#8a857d"
        font-family="Helvetica Neue, Helvetica, Arial" font-size="13">아이콘을 Applications 폴더에 끌어다 놓으세요</text>
  ${petalTrail()}
</svg>`;

const main = async () => {
  fs.mkdirSync(RESOURCES, { recursive: true });

  if (!fs.existsSync(GLASS_ICON_PATH)) {
    throw new Error(`Missing ${GLASS_ICON_PATH}. Run scripts/generate-icon.sh first.`);
  }

  await renderGlassMark();

  // ── 메뉴바(트레이) ──────────────────────────────────────────────
  // macOS 템플릿 이미지는 알파만 읽고 색은 버린다. 검정 실루엣 + 투명 배경이
  // 규약이고, 시스템이 라이트/다크에 맞춰 뒤집어 준다.
  // 메뉴바 아이콘은 18pt다. 1x는 18px, 2x는 36px로 굽고 Electron이 화면
  // 배율에 맞춰 고르게 한다. 큰 이미지를 코드에서 resize하면 고해상도
  // 표현이 버려져 Retina에서 뭉갠다.
  await sharp(Buffer.from(markSvg('#000000', false)))
    .resize(18, 18)
    .png()
    .toFile(path.join(RESOURCES, 'tray.png'));

  await sharp(Buffer.from(markSvg('#000000', false)))
    .resize(36, 36)
    .png()
    .toFile(path.join(RESOURCES, 'tray@2x.png'));

  // ── Windows 앱 아이콘 ───────────────────────────────────────────
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const glassIcon = sharp(GLASS_ICON_PATH);
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => ({
      data: await glassIcon.clone().resize(size, size).png().toBuffer(),
      size,
    })),
  );
  fs.writeFileSync(path.join(RESOURCES, 'icon.ico'), buildIco(icoImages));

  // ── DMG 창 배경 ────────────────────────────────────────────────
  const dmgIcon = await sharp(GLASS_ICON_PATH).resize(44, 44).png().toBuffer();
  const dmgBackground = await sharp(Buffer.from(dmgBackgroundSvg(660, 400)))
    .composite([{ input: dmgIcon, left: 308, top: 28, blend: 'over' }])
    .png()
    .toBuffer();
  await sharp(dmgBackground).toFile(path.join(RESOURCES, 'dmg-background.png'));
  await sharp(dmgBackground)
    .resize(1320, 800)
    .toFile(path.join(RESOURCES, 'dmg-background@2x.png'));

  console.log('brand assets ready:', fs.readdirSync(RESOURCES).sort().join(', '));
};

await main();
