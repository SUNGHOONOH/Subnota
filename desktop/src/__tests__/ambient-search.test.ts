import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  AmbientSearchTarget,
  canRunAmbientAutoSearch,
  createAmbientSearchRunner,
} from '../lib/ambientSearch';
import { normalizeAppSettings } from '../lib/appSettings';

const target = (queryText: string, editorId = 'editor-1'): AmbientSearchTarget => ({
  editorId,
  memoId: 'memo-1',
  queryText,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

type Response = { queryChunk: string; results: string[] };

describe('createAmbientSearchRunner', () => {
  it('조건 충족 시 트리밍된 query snapshot으로 search를 1회 호출한다', async () => {
    const search = vi.fn().mockResolvedValue({ queryChunk: 'q', results: ['r1'] });
    const runner = createAmbientSearchRunner<string, string>({ search });

    const started = runner.run(target('  버튼 클릭 시점의 문장입니다  '));
    await flush();

    expect(started).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]?.[0]).toEqual({
      editorId: 'editor-1',
      memoId: 'memo-1',
      queryText: '버튼 클릭 시점의 문장입니다',
    });
    expect(search.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it('검색 중 재클릭해도 추가 요청이 발생하지 않는다', async () => {
    const deferred = createDeferred<Response>();
    const search = vi.fn().mockReturnValue(deferred.promise);
    const runner = createAmbientSearchRunner<string, string>({ search });

    expect(runner.run(target('중복 클릭 방지 확인용 문장'))).toBe(true);
    expect(runner.run(target('중복 클릭 방지 확인용 문장'))).toBe(false);
    expect(runner.run(target('중복 클릭 방지 확인용 문장'))).toBe(false);
    expect(search).toHaveBeenCalledTimes(1);

    deferred.resolve({ queryChunk: 'q', results: [] });
    await flush();
  });

  it('isSearching은 시작 시 true, 완료 시 false이며 onStart/onFinish가 호출된다', async () => {
    const deferred = createDeferred<Response>();
    const runner = createAmbientSearchRunner<string, string>({
      search: () => deferred.promise,
    });
    const onStart = vi.fn();
    const onFinish = vi.fn();

    runner.run(target('검색 상태 라이프사이클 문장'), { onFinish, onStart });
    expect(runner.isSearching()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();

    deferred.resolve({ queryChunk: 'q', results: ['r1'] });
    await flush();

    expect(runner.isSearching()).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('결과가 있으면 onResult에 snapshot과 최상위 결과 1개를 전달한다', async () => {
    const runner = createAmbientSearchRunner<string, string>({
      search: () => Promise.resolve({ queryChunk: 'chunk', results: ['top', 'rest'] }),
    });
    const onResult = vi.fn();
    const onEmpty = vi.fn();

    runner.run(target('결과 전달 확인용 문장입니다'), { onEmpty, onResult });
    await flush();

    expect(onEmpty).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(
      { editorId: 'editor-1', memoId: 'memo-1', queryText: '결과 전달 확인용 문장입니다' },
      'chunk',
      'top',
    );
  });

  it('새 문맥은 진행 중 요청을 무효화하고 정리 후 최신 요청만 실행한다', async () => {
    const first = createDeferred<Response>();
    const second = createDeferred<Response>();
    const search = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const runner = createAmbientSearchRunner<string, string>({ search });
    const firstResult = vi.fn();
    const secondResult = vi.fn();
    const firstFinish = vi.fn();

    runner.run(target('처음 커서가 있던 문장입니다'), {
      onFinish: firstFinish,
      onResult: firstResult,
    });
    const firstSignal = search.mock.calls[0]?.[1] as AbortSignal;
    expect(
      runner.run(target('이동한 커서 위치의 최신 문장입니다'), {
        onResult: secondResult,
      }),
    ).toBe(true);

    expect(firstSignal.aborted).toBe(true);
    expect(firstFinish).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);

    first.resolve({ queryChunk: 'old', results: ['old-result'] });
    await flush();

    expect(firstResult).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1]?.[0].queryText).toBe(
      '이동한 커서 위치의 최신 문장입니다',
    );

    second.resolve({ queryChunk: 'new', results: ['new-result'] });
    await flush();

    expect(secondResult).toHaveBeenCalledTimes(1);
    expect(secondResult.mock.calls[0][0].queryText).toBe(
      '이동한 커서 위치의 최신 문장입니다',
    );
  });

  it('cancel은 진행 중 결과와 대기 중 최신 요청을 모두 버린다', async () => {
    const deferred = createDeferred<Response>();
    const search = vi.fn().mockReturnValue(deferred.promise);
    const runner = createAmbientSearchRunner<string, string>({ search });
    const onFinish = vi.fn();
    const onResult = vi.fn();

    runner.run(target('취소할 검색 문장입니다'), { onFinish, onResult });
    const signal = search.mock.calls[0]?.[1] as AbortSignal;
    runner.cancel();

    expect(signal.aborted).toBe(true);
    expect(runner.isSearching()).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(1);

    deferred.resolve({ queryChunk: 'old', results: ['old-result'] });
    await flush();

    expect(onResult).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('결과가 없으면 onResult 대신 onEmpty가 호출된다', async () => {
    const runner = createAmbientSearchRunner<string, string>({
      search: () => Promise.resolve({ queryChunk: 'chunk', results: [] }),
    });
    const onResult = vi.fn();
    const onEmpty = vi.fn();

    runner.run(target('결과 없음 케이스 확인 문장'), { onEmpty, onResult });
    await flush();

    expect(onResult).not.toHaveBeenCalled();
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(onEmpty.mock.calls[0][0].editorId).toBe('editor-1');
  });

  it('실패하면 onError 후 onFinish로 검색 상태가 해제된다', async () => {
    const deferred = createDeferred<Response>();
    const runner = createAmbientSearchRunner<string, string>({
      search: () => deferred.promise,
    });
    const onError = vi.fn();
    const onFinish = vi.fn();

    runner.run(target('실패 케이스 확인용 문장입니다'), { onError, onFinish });
    deferred.reject(new Error('network down'));
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(runner.isSearching()).toBe(false);
  });

  it('12자 미만 쿼리는 요청을 시작하지 않는다', () => {
    const search = vi.fn();
    const runner = createAmbientSearchRunner<string, string>({ search });

    expect(runner.run(target('짧은 문장'))).toBe(false);
    expect(search).not.toHaveBeenCalled();
  });

  it('자동 검색은 같은 문맥에서 한 번 끝나면 문맥이 바뀔 때까지 반복하지 않는다', async () => {
    const search = vi.fn().mockResolvedValue({ queryChunk: 'q', results: ['r'] });
    const runner = createAmbientSearchRunner<string, string>({ search });

    expect(runner.run(target('같은 문맥에서는 한 번만 검색합니다'))).toBe(true);
    await flush();
    expect(runner.run(target('같은 문맥에서는 한 번만 검색합니다'))).toBe(false);

    expect(runner.run(target('다른 문맥으로 이동했습니다'))).toBe(true);
    await flush();
    expect(runner.run(target('같은 문맥에서는 한 번만 검색합니다'))).toBe(true);
    await flush();
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('수동 검색은 짧은 선택문과 자동 검색 완료 문맥을 모두 다시 실행할 수 있다', async () => {
    const search = vi.fn().mockResolvedValue({ queryChunk: 'q', results: ['r'] });
    const runner = createAmbientSearchRunner<string, string>({ search });

    runner.run(target('이미 자동 검색한 문장입니다'));
    await flush();
    expect(
      runner.run(target('주차 문제'), {}, { mode: 'manual' }),
    ).toBe(true);
    await flush();
    expect(
      runner.run(target('이미 자동 검색한 문장입니다'), {}, { mode: 'manual' }),
    ).toBe(true);
    await flush();
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('다른 자동 문맥은 즉시 실행된다', async () => {
    const search = vi.fn().mockResolvedValue({ queryChunk: 'q', results: ['r'] });
    const runner = createAmbientSearchRunner<string, string>({ search });

    runner.run(target('첫 번째로 검색한 문장입니다'));
    await flush();
    expect(runner.run(target('두 번째로 검색할 문장입니다'))).toBe(true);
    await flush();
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe('canRunAmbientAutoSearch', () => {
  const allowed = {
    autoSearchEnabled: true,
    documentHasFocus: true,
    documentHidden: false,
    hasSession: true,
  };

  it('자동 검색 설정이 꺼져 있으면(기본값) 항상 false다', () => {
    expect(canRunAmbientAutoSearch({ ...allowed, autoSearchEnabled: false })).toBe(false);
  });

  it('앱이 백그라운드·최소화 상태이면 false다', () => {
    expect(canRunAmbientAutoSearch({ ...allowed, documentHidden: true })).toBe(false);
    expect(canRunAmbientAutoSearch({ ...allowed, documentHasFocus: false })).toBe(false);
  });

  it('세션이 없으면 false다', () => {
    expect(canRunAmbientAutoSearch({ ...allowed, hasSession: false })).toBe(false);
  });

  it('설정이 켜져 있고 포그라운드·세션 조건이 충족되면 true다', () => {
    expect(canRunAmbientAutoSearch(allowed)).toBe(true);
  });
});

describe('appSettings.ambientAutoSearchEnabled', () => {
  it('기본값은 true다', () => {
    expect(normalizeAppSettings({}).ambientAutoSearchEnabled).toBe(true);
    expect(normalizeAppSettings(null).ambientAutoSearchEnabled).toBe(true);
  });

  it('저장된 false 값은 유지되어 설정에서 끌 수 있다', () => {
    expect(
      normalizeAppSettings({ ambientAutoSearchEnabled: false }).ambientAutoSearchEnabled,
    ).toBe(false);
  });

  it('저장된 true 값은 유지된다', () => {
    expect(
      normalizeAppSettings({ ambientAutoSearchEnabled: true }).ambientAutoSearchEnabled,
    ).toBe(true);
  });

  it('화면 언어는 ko 또는 en만 저장한다', () => {
    expect(normalizeAppSettings({ uiLanguage: 'ko' }).uiLanguage).toBe('ko');
    expect(normalizeAppSettings({ uiLanguage: 'en' }).uiLanguage).toBe('en');
    expect(normalizeAppSettings({ uiLanguage: 'fr' as never }).uiLanguage).toMatch(
      /^(ko|en)$/,
    );
  });
});

// 자동 검색의 "없음"·"오류"는 화면에 그리지 않는다. 그렇다고 핸들러를
// 안 부르면 이전 결과가 남으므로, 부르되 mode를 함께 넘겨 판단하게 한다.
describe('결과 없음·오류의 mode 전달', () => {
  it('onEmpty는 실행 모드를 함께 받는다', async () => {
    const onEmpty = vi.fn();
    const search = vi.fn().mockResolvedValue({ queryChunk: 'q', results: [] });
    const runner = createAmbientSearchRunner<string, string>({ search });

    runner.run(target('자동으로 시작된 검색 문장입니다'), { onEmpty });
    await flush();
    expect(onEmpty.mock.calls[0]?.[1]).toBe('auto');

    runner.run(target('직접 누른 검색'), { onEmpty }, { mode: 'manual' });
    await flush();
    expect(onEmpty.mock.calls[1]?.[1]).toBe('manual');
  });

  it('onError는 오류 뒤에 실행 모드를 받는다', async () => {
    const onError = vi.fn();
    const search = vi.fn().mockRejectedValue(new Error('boom'));
    const runner = createAmbientSearchRunner<string, string>({ search });

    runner.run(target('자동으로 시작된 검색 문장입니다'), { onError });
    await flush();
    expect(onError.mock.calls[0]?.[2]).toBe('auto');

    runner.run(target('직접 누른 검색'), { onError }, { mode: 'manual' });
    await flush();
    expect(onError.mock.calls[1]?.[2]).toBe('manual');
  });
});

describe('App의 mode 분기', () => {
  const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

  it('자동 검색은 없음·오류를 그리지 않는다', () => {
    const handlers = appSource.slice(
      appSource.indexOf('const ambientSearchHandlers = {'),
      appSource.indexOf('const runAmbientSearchNow'),
    );

    // onEmpty·onError 각각에 "수동일 때만 표시" 분기가 있어야 한다.
    expect(handlers.match(/if \(mode !== 'manual'\)/g)).toHaveLength(2);
    expect(handlers).toContain('setAmbientError(message)');
  });
});
