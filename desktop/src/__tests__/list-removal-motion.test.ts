import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 항목을 지우면 아래·뒤 항목들이 순간이동했다. 제안만 하고 구현이 빠져 있던
// 부분이라, 다시 빠지지 않도록 두 목록 모두 여기서 잡는다.
const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const lists = [
  ['일정 저장함 행', 'features/schedule/ScheduleInboxWorkspace.tsx'],
  ['링크 저장함 카드', 'features/inbox/InboxWorkspace.tsx'],
] as const;

describe('목록에서 항목이 빠질 때', () => {
  for (const [label, path] of lists) {
    const source = read(path);

    it(`${label}이 빈자리를 메우며 움직인다`, () => {
      expect(source).toContain("layout={shouldReduceMotion ? false : 'position'}");
      expect(source).toContain('{ opacity: 0, scale: 0.96 }');
      expect(source).toContain('const shouldReduceMotion = useReducedMotion();');
    });

    // AnimatePresence가 map 안으로 들어가면 항목마다 새로 생겨 exit이 조용히
    // 건너뛰어진다. 반드시 바깥이어야 한다(docs/design.md).
    it(`${label}의 AnimatePresence가 map 바깥에 있다`, () => {
      expect(source).toMatch(
        /<AnimatePresence initial=\{false\}>\s*\n\s*\{\w+\.map\(/,
      );
    });
  }

  // "position"이 아니라 전체 layout이면 크기까지 보간해서, 고정 높이 카드의
  // 썸네일과 행 안의 글자가 늘어났다 줄었다 한다.
  it('크기가 아니라 위치만 보간한다', () => {
    for (const [, path] of lists) {
      expect(read(path)).not.toContain('layout={true}');
      expect(read(path)).not.toMatch(/\slayout\s*$/m);
    }
  });
});
