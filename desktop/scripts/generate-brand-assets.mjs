/**
 * 브랜드 래스터 자산 생성기 — tray.png · icon.ico · DMG 배경.
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

/** 로고 색. desktop/src/styles/_color-tokens.scss 의 app-color-brand-mark 와 같아야 한다. */
const BRAND_MARK = '#4c71b7';
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

/** 둥근 흰 사각형 + 마크 — 앱 아이콘용. */
const appIconSvg = () =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
  '<rect width="1024" height="1024" rx="230" ry="230" fill="#ffffff"/>' +
  petals(BRAND_MARK, 'translate(102.4,102.4) scale(8.192)') +
  '</svg>';

const render = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

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

/**
 * DMG 창 배경. 화살표로 "Applications에 끌어다 놓아라"를 말한다.
 * 좌표는 forge.config.ts 의 contents 위치와 맞춰야 한다.
 */
const dmgBackgroundSvg = (width, height) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#f8f7f4"/>
  ${petals(BRAND_MARK, `translate(${width / 2 - 22},44) scale(0.44)`)}
  <text x="${width / 2}" y="128" text-anchor="middle" fill="#1f1d1a"
        font-family="Helvetica Neue, Helvetica, Arial" font-size="21" font-weight="600">Subnota</text>
  <text x="${width / 2}" y="156" text-anchor="middle" fill="#8a857d"
        font-family="Helvetica Neue, Helvetica, Arial" font-size="13">아이콘을 Applications 폴더로 끌어다 놓으세요</text>
  <path d="M${width / 2 - 46} 262 H${width / 2 + 46}" stroke="#c9c3b8" stroke-width="2"
        stroke-linecap="round" stroke-dasharray="7 7"/>
  <path d="M${width / 2 + 40} 254 L${width / 2 + 52} 262 L${width / 2 + 40} 270 Z" fill="#c9c3b8"/>
</svg>`;

const main = async () => {
  fs.mkdirSync(RESOURCES, { recursive: true });

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
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => ({ data: await render(appIconSvg(), size), size })),
  );
  fs.writeFileSync(path.join(RESOURCES, 'icon.ico'), buildIco(icoImages));

  // ── macOS icns 원본 (generate-icon.sh 가 이 PNG를 쓴다) ─────────
  await sharp(Buffer.from(appIconSvg()))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(RESOURCES, 'icon-1024.png'));

  // ── DMG 창 배경 ────────────────────────────────────────────────
  await sharp(Buffer.from(dmgBackgroundSvg(660, 400)))
    .png()
    .toFile(path.join(RESOURCES, 'dmg-background.png'));
  await sharp(Buffer.from(dmgBackgroundSvg(660, 400)))
    .resize(1320, 800)
    .png()
    .toFile(path.join(RESOURCES, 'dmg-background@2x.png'));

  console.log('brand assets ready:', fs.readdirSync(RESOURCES).sort().join(', '));
};

await main();
