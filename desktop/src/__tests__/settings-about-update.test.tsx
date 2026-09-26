import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import SettingsAboutSection from '../features/settings/SettingsAboutSection';

beforeAll(() => {
  vi.stubGlobal('__APP_VERSION__', '1.0.5');
});

const markup = (availableUpdateVersion: string | null) =>
  renderToStaticMarkup(
    <MantineProvider>
      <SettingsAboutSection
        availableUpdateVersion={availableUpdateVersion}
        onCheckUpdates={vi.fn()}
        onStartUpdate={vi.fn()}
        run={vi.fn()}
        translate={korean => korean}
      />
    </MantineProvider>,
  );

// 설정 창이 앱을 덮고 있어서 "왼쪽 버튼을 누르세요"는 창을 닫게 만든다.
// 찾은 자리에서 바로 업데이트할 수 있어야 한다.
describe('설정 > 정보의 업데이트 동작', () => {
  it('새 버전이 없으면 확인 링크를 둔다', () => {
    const html = markup(null);
    expect(html).toContain('업데이트 확인');
    expect(html).not.toContain('1.0.6로 업데이트');
  });

  it('새 버전이 있으면 그 자리에서 업데이트한다', () => {
    const html = markup('1.0.6');
    expect(html).toContain('1.0.6로 업데이트');
    expect(html).not.toContain('업데이트 확인');
  });
});
