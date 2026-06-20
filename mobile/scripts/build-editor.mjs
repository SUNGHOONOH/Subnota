// Builds the self-contained Tiptap editor HTML for the React Native WebView.
//
// Bundles editor.entry.js with esbuild (one offline IIFE), base64-inlines the
// self-hosted woff2 fonts, and injects both into the template — producing
// build/tiptap-editor.html with zero network dependencies. This is a build-time
// step (like metro's main.jsbundle); only the generated HTML ships in the app.

import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(HERE, '../src/features/memo/editor');
const SOURCE_DIR = resolve(EDITOR_DIR, 'source');
const FONTS_DIR = resolve(SOURCE_DIR, 'fonts');
const ENTRY = resolve(SOURCE_DIR, 'editor.entry.js');
const TEMPLATE = resolve(SOURCE_DIR, 'tiptap-editor.template.html');
const OUTPUT = resolve(EDITOR_DIR, 'tiptap-editor.html');

// woff2 filename convention: <slug>-<weight>-<subset>.woff2
const FAMILY_BY_SLUG = { inter: 'Inter', 'jetbrains-mono': 'JetBrains Mono' };

function buildFontFaces() {
  const files = readdirSync(FONTS_DIR).filter((f) => f.endsWith('.woff2'));
  if (files.length === 0) {
    throw new Error(`No woff2 fonts in ${FONTS_DIR}. Re-download the editor fonts first.`);
  }
  return files
    .sort()
    .map((file) => {
      const [slug, weight] = file.replace('.woff2', '').split('-');
      const family = FAMILY_BY_SLUG[slug] || slug;
      const base64 = readFileSync(resolve(FONTS_DIR, file)).toString('base64');
      return [
        '  @font-face {',
        `    font-family: '${family}';`,
        '    font-style: normal;',
        `    font-weight: ${weight};`,
        '    font-display: swap;',
        `    src: url(data:font/woff2;base64,${base64}) format('woff2');`,
        '  }',
      ].join('\n');
    })
    .join('\n');
}

async function bundleEditor() {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['safari15'],
    legalComments: 'none',
    write: false,
  });
  return result.outputFiles[0].text;
}

async function main() {
  const [fontFaces, bundle] = await Promise.all([
    Promise.resolve(buildFontFaces()),
    bundleEditor(),
  ]);

  const template = readFileSync(TEMPLATE, 'utf8');
  if (!template.includes('/* @FONT_FACES@ */') || !template.includes('<!-- @EDITOR_BUNDLE@ -->')) {
    throw new Error('Template is missing @FONT_FACES@ or @EDITOR_BUNDLE@ markers.');
  }

  // Use function replacements so `$` sequences in the minified bundle (e.g.
  // template-literal `${...}` or `$\`` in tiptap/prosemirror) are inserted
  // literally instead of being interpreted as replacement patterns.
  // Also neutralize any `</script>` in the bundle so it can't close the tag.
  const safeBundle = bundle.replace(/<\/script>/gi, '<\\/script>');
  const html = template
    .replace('/* @FONT_FACES@ */', () => fontFaces)
    .replace('<!-- @EDITOR_BUNDLE@ -->', () => `<script>\n${safeBundle}\n</script>`);

  writeFileSync(OUTPUT, html);
  console.log(
    `Built ${OUTPUT.replace(resolve(HERE, '..') + '/', '')} ` +
      `(${(html.length / 1024).toFixed(0)} KB, bundle ${(bundle.length / 1024).toFixed(0)} KB)`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
