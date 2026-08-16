import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const renderer = readFileSync(resolve(__dirname, '../renderer.tsx'), 'utf8');
const styles = readFileSync(
  resolve(__dirname, '../styles/subnota-workspace.scss'),
  'utf8',
);

describe('fatal render error fallback', () => {
  it('uses concise recovery copy with the Subnota brand', () => {
    expect(renderer).toContain("import SubnotaMark from './components/SubnotaMark';");
    expect(renderer).toContain('<SubnotaMark size={26} />');
    expect(renderer).toContain('문제가 발생했습니다.');
    expect(renderer).toContain('저장 완료된 내용은 이 기기에 남아 있습니다.');
    expect(renderer).toContain('다시 불러오기');
  });

  it('keeps the fallback readable and its recovery action interactive', () => {
    expect(styles).toMatch(
      /\.fatal-render-error\s*\{[\s\S]*?min-height:\s*100vh[\s\S]*?text-align:\s*center/,
    );
    expect(styles).toMatch(
      /\.fatal-render-error::before\s*\{[\s\S]*?height:\s*32px[\s\S]*?-webkit-app-region:\s*drag/,
    );
    expect(styles).toMatch(
      /\.fatal-render-error-reload\s*\{[\s\S]*?-webkit-app-region:\s*no-drag/,
    );
  });
});
