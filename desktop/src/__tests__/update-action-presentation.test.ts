import { describe, expect, it } from 'vitest';

import {
  getUpdateActionPresentation,
} from '../features/update/updateActionPresentation';
import type { UpdateState } from '../features/update/useAppUpdate';

const translate = (korean: string, english: string) =>
  english === 'Updating' ? korean : english;

const update = { downloadUrl: 'https://example.com/update', version: '1.2.3' };

describe('getUpdateActionPresentation', () => {
  it('hides the action when no update is pending', () => {
    expect(getUpdateActionPresentation({ status: 'idle' }, translate)).toEqual({
      hasPendingUpdate: false,
      isWorking: false,
      label: '',
      tooltip: '',
    });
  });

  it.each([
    ['available', 'Update Subnota 1.2.3', 'Update Subnota 1.2.3'],
    ['error', 'Retry update', 'Retry update'],
    ['downloading', '업데이트 진행 중', 'Downloading update'],
    ['installing', '업데이트 진행 중', 'Preparing update'],
  ] as const)('maps %s to its navigation copy', (status, label, tooltip) => {
    const state = (
      status === 'error'
        ? { message: 'failed', status, update }
        : { status, update }
    ) as UpdateState;

    expect(getUpdateActionPresentation(state, translate)).toMatchObject({
      hasPendingUpdate: true,
      isWorking: status === 'downloading' || status === 'installing',
      label,
      tooltip,
    });
  });

  it('keeps Korean version interpolation for an available update', () => {
    const korean = (...texts: [string, string]) => texts[0];
    const presentation = getUpdateActionPresentation(
      { status: 'available', update },
      korean,
    );

    expect(presentation.label).toBe('Subnota 1.2.3 업데이트 시작');
    expect(presentation.tooltip).toBe('Subnota 1.2.3 업데이트');
  });
});
