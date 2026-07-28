import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import LocalIndexProgress, {
  isEmptyLocalIndexCompletion,
} from '../features/search/LocalIndexProgress';
import type { LocalMemoIndexProgress } from '../services/local/localMemoIndexer';

const progress = (
  patch: Partial<LocalMemoIndexProgress>,
): LocalMemoIndexProgress => ({
  completedChunks: 0,
  downloadedBytes: 0,
  ownerId: null,
  stage: 'preparing',
  totalBytes: 0,
  totalChunks: 0,
  ...patch,
});

describe('LocalIndexProgress', () => {
  it('첫 모델 다운로드 byte 진행률을 표시한다', () => {
    const html = renderToStaticMarkup(
      <LocalIndexProgress
        progress={progress({
          downloadedBytes: 300_000_000,
          stage: 'downloading',
          totalBytes: 586_000_000,
        })}
      />,
    );

    expect(html).toContain('모델 받는 중');
    expect(html).toContain('300 / 586MB');
    expect(html).toContain('max="586000000"');
  });

  it('전체 색인의 완료 청크 수를 표시한다', () => {
    const html = renderToStaticMarkup(
      <LocalIndexProgress
        progress={progress({
          completedChunks: 123,
          stage: 'indexing',
          totalChunks: 618,
        })}
      />,
    );

    expect(html).toContain('123 / 618개 문장');
    expect(html).toContain('aria-live="polite"');
  });

  it('색인할 변경이 없으면 준비 표시를 닫는다', () => {
    expect(
      isEmptyLocalIndexCompletion(
        progress({ stage: 'complete', totalChunks: 0 }),
      ),
    ).toBe(true);
    expect(
      isEmptyLocalIndexCompletion(
        progress({ stage: 'indexing', totalChunks: 1 }),
      ),
    ).toBe(false);
  });
});
