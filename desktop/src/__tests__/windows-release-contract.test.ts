import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(__dirname, '..', '..', '..');
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/desktop-release.yml'),
  'utf8',
);
const windowsJob = workflow.slice(workflow.indexOf('  release-windows:'));
const releaseScript = readFileSync(
  resolve(repositoryRoot, 'desktop/scripts/release-windows.mjs'),
  'utf8',
);

describe('Windows release contract', () => {
  it('injects every production service setting into the Windows Vite build', () => {
    expect(windowsJob).toContain('VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}');
    expect(windowsJob).toContain(
      'VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}',
    );
    expect(windowsJob).toContain('VITE_MEMO_BACKEND_URL: ${{ vars.VITE_MEMO_BACKEND_URL }}');
  });

  it('publishes the complete Squirrel.Windows update set', () => {
    expect(releaseScript).toContain(".at(-1) === 'RELEASES'");
    expect(releaseScript).toContain('/-full\\.nupkg$/i');
    expect(releaseScript).toContain("['release', 'upload', tag, ...releaseAssets, '--clobber']");
  });

  it('refuses to publish a version tag from a different commit', () => {
    expect(releaseScript).toContain('if (headCommit !== tagCommit)');
    expect(releaseScript).toContain('Bump the version instead of reusing the tag.');
  });
});
