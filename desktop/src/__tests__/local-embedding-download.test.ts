import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downloadWeightsResumable,
  freeDiskBytes,
} from '../local-embedding-download';

let workDir: string;
const targetPath = () => path.join(workDir, 'model.onnx');

const bodyOf = (chunks: Uint8Array[]) => ({
  getReader() {
    let index = 0;
    return {
      read: async () =>
        index < chunks.length
          ? { done: false, value: chunks[index++] }
          : { done: true, value: undefined },
    };
  },
});

const sha256 = (payload: Uint8Array) =>
  createHash('sha256').update(payload).digest('hex');

const okResponse = (
  payload: Uint8Array,
  status = 200,
  total = payload.length,
  start = 0,
) => ({
  body: bodyOf([payload]),
  headers: new Headers({
    'Content-Length': String(payload.length),
    ...(status === 206
      ? { 'Content-Range': `bytes ${start}-${start + payload.length - 1}/${total}` }
      : {}),
  }),
  ok: true,
  status,
});

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subnota-model-'));
});

afterEach(() => {
  fs.rmSync(workDir, { force: true, recursive: true });
  vi.unstubAllGlobals();
});

describe('downloadWeightsResumable', () => {
  it('받은 뒤에만 최종 경로로 옮긴다', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(payload)));

    await downloadWeightsResumable({
      expectedBytes: payload.length,
      expectedSha256: sha256(payload),
      onProgress: () => undefined,
      targetPath: targetPath(),
      url: 'https://example.test/model.onnx',
    });

    expect(fs.readFileSync(targetPath())).toEqual(Buffer.from(payload));
    // .part는 남지 않는다 — 다음 실행이 이미 받은 파일로 착각하면 안 된다.
    expect(fs.existsSync(`${targetPath()}.part`)).toBe(false);
  });

  it('이미 있으면 다시 받지 않는다', async () => {
    const payload = Buffer.from('done');
    fs.writeFileSync(targetPath(), payload);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await downloadWeightsResumable({
      expectedBytes: payload.length,
      expectedSha256: sha256(payload),
      onProgress: () => undefined,
      targetPath: targetPath(),
      url: 'https://example.test/model.onnx',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Transformers.js는 실패하면 부분 파일을 지워 처음부터 다시 받는다.
  // 570MB에서는 그 비용이 커서 직접 이어받는다.
  it('남아 있는 .part만큼 Range로 이어받는다', async () => {
    const complete = new Uint8Array([1, 2, 3, 4]);
    fs.writeFileSync(`${targetPath()}.part`, complete.slice(0, 2));
    const fetchMock = vi.fn(async () =>
      okResponse(complete.slice(2), 206, complete.length, 2),
    );
    vi.stubGlobal('fetch', fetchMock);

    await downloadWeightsResumable({
      expectedBytes: complete.length,
      expectedSha256: sha256(complete),
      onProgress: () => undefined,
      targetPath: targetPath(),
      url: 'https://example.test/model.onnx',
    });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Range: 'bytes=2-' });
    expect(fs.readFileSync(targetPath())).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('서버가 Range를 무시하면 처음부터 다시 쓴다', async () => {
    const payload = new Uint8Array([1, 2]);
    fs.writeFileSync(`${targetPath()}.part`, Buffer.from([9, 9, 9]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(payload, 200)),
    );

    await downloadWeightsResumable({
      expectedBytes: payload.length,
      expectedSha256: sha256(payload),
      onProgress: () => undefined,
      targetPath: targetPath(),
      url: 'https://example.test/model.onnx',
    });

    expect(fs.readFileSync(targetPath())).toEqual(Buffer.from([1, 2]));
  });

  it('응답이 짧게 끝나도 검증 가능한 .part를 Range로 이어받는다', async () => {
    const expected = new Uint8Array([1, 2, 3, 4]);
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      return call === 1
        ? {
            body: bodyOf([new Uint8Array([1, 2])]),
            headers: new Headers({ 'Content-Length': '4' }),
            ok: true,
            status: 200,
          }
        : okResponse(expected.slice(2), 206, expected.length, 2);
    });
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    await downloadWeightsResumable({
      expectedBytes: expected.length,
      expectedSha256: sha256(expected),
      onProgress: () => undefined,
      retryBaseMs: 1,
      targetPath: targetPath(),
      url: 'https://example.test/model.onnx',
    });

    expect(call).toBe(2);
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Range: 'bytes=2-' });
    expect(fs.readFileSync(targetPath())).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('같은 크기의 잘못된 파일도 해시로 거부한다', async () => {
    const expected = new Uint8Array([1, 2, 3, 4]);
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        return okResponse(call === 1 ? new Uint8Array([9, 9, 9, 9]) : expected);
      }),
    );

    await downloadWeightsResumable({
      expectedBytes: expected.length,
      expectedSha256: sha256(expected),
      onProgress: () => undefined,
      retryBaseMs: 1,
      targetPath: targetPath(),
      url: 'https://example.test/model.onnx',
    });

    expect(call).toBe(2);
    expect(fs.readFileSync(targetPath())).toEqual(Buffer.from(expected));
  });

  it('계속 실패하면 마지막 오류를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ body: null, headers: new Headers(), ok: false, status: 503 })),
    );

    await expect(
      downloadWeightsResumable({
        expectedBytes: 4,
        expectedSha256: sha256(new Uint8Array([1, 2, 3, 4])),
        onProgress: () => undefined,
        retryBaseMs: 1,
        targetPath: targetPath(),
        url: 'https://example.test/model.onnx',
      }),
    ).rejects.toThrow('HTTP 503');
  });
});

describe('freeDiskBytes', () => {
  it('없는 폴더는 상위 폴더 기준으로 잰다', () => {
    const deep = path.join(workDir, 'a', 'b', 'c');
    const free = freeDiskBytes(deep);
    expect(free === null || free > 0).toBe(true);
  });
});
