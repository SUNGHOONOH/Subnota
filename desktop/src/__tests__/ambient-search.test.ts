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
    expect(search).toHaveBeenCalledWith({
      editorId: 'editor-1',
      memoId: 'memo-1',
      queryText: '버튼 클릭 시점의 문장입니다',
    });
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

  it('진행 중 계속 타이핑해도 요청은 취소되지 않고 원래 snapshot으로 결과가 온다', async () => {
    const deferred = createDeferred<Response>();
    const search = vi.fn().mockReturnValue(deferred.promise);
    const runner = createAmbientSearchRunner<string, string>({ search });
    const onResult = vi.fn();

    runner.run(target('처음 클릭한 순간의 문장입니다'), { onResult });
    // 사용자가 계속 입력해 pending이 바뀐 상황 — 새 run은 무시되고 기존 요청 유지
    expect(runner.run(target('이후에 입력이 이어진 문장입니다'), { onResult })).toBe(false);

    deferred.resolve({ queryChunk: 'chunk', results: ['top'] });
    await flush();

    expect(search).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].queryText).toBe('처음 클릭한 순간의 문장입니다');
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

  it('성공한 동일 쿼리는 cooldown 동안 차단되고 지나면 다시 허용된다', async () => {
    let currentTime = 0;
    const search = vi.fn().mockResolvedValue({ queryChunk: 'q', results: ['r'] });
    const runner = createAmbientSearchRunner<string, string>({
      cooldownMs: 60000,
      now: () => currentTime,
      search,
    });

    expect(runner.run(target('cooldown 확인용 문장입니다'))).toBe(true);
    await flush();
    expect(runner.run(target('cooldown 확인용 문장입니다'))).toBe(false);

    currentTime = 60001;
    expect(runner.run(target('cooldown 확인용 문장입니다'))).toBe(true);
    await flush();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('다른 쿼리는 cooldown과 무관하게 즉시 실행된다', async () => {
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
  it('기본값은 false다', () => {
    expect(normalizeAppSettings({}).ambientAutoSearchEnabled).toBe(false);
    expect(normalizeAppSettings(null).ambientAutoSearchEnabled).toBe(false);
  });

  it('저장된 true 값은 유지된다', () => {
    expect(
      normalizeAppSettings({ ambientAutoSearchEnabled: true }).ambientAutoSearchEnabled,
    ).toBe(true);
  });
});
