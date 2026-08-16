/**
 * 가중치 파일(569MB) 이어받기 다운로더.
 *
 * 왜 직접 받는가: Transformers.js는 `.tmp` 파일로 스트리밍하다가 실패하면
 * 그 파일을 지운다(FileCache.put). 덕분에 손상된 파일이 남지는 않지만
 * **이어받기가 없다** — 570MB를 받다 끊기면 다음 시도는 0바이트부터다.
 * LM Studio가 겪는 문제(대형 다운로드 중단 → 수동 재시작)와 같은 종류다.
 *
 * 그래서 큰 가중치 파일만 HTTP Range로 직접 받아 캐시 경로에 놓고, 나머지
 * 작은 파일(토크나이저·설정)은 Transformers.js에 맡긴다. 캐시에 파일이 이미
 * 있으면 라이브러리가 그대로 쓰므로 다운로드를 건너뛴다.
 *
 * 무결성: `.part`로 받아 완료 시에만 rename한다. 앱에 고정한 전체 크기와
 * SHA-256이 다르면 받은 것을 버린다 — 잘리거나 다른 revision이 섞인 파일을
 * 캐시에 남기면 다음 실행에서 모델 로딩이 실패할 수 있다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
}

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 1_000;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const partPathOf = (target: string) => `${target}.part`;

const sizeOf = (file: string) => {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
};

const sha256Of = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

export const fileMatchesExpectedModel = async (
  file: string,
  expectedBytes: number,
  expectedSha256: string,
) =>
  sizeOf(file) === expectedBytes &&
  (await sha256Of(file)) === expectedSha256;

/** 남은 디스크 여유 공간(바이트). 확인할 수 없으면 null. */
export const freeDiskBytes = (directory: string): number | null => {
  try {
    // 대상 폴더가 아직 없으면 존재하는 상위 폴더 기준으로 잰다.
    let probe = directory;
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) return null;
      probe = parent;
    }
    const stats = fs.statfsSync(probe);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
};

/**
 * Range 요청으로 이어받는다. 이미 받은 만큼은 건너뛰고, 서버가 Range를
 * 지원하지 않으면(200 응답) 처음부터 다시 받는다.
 */
const fetchIntoPart = async (
  expectedBytes: number,
  url: string,
  partPath: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<number> => {
  const already = sizeOf(partPath);
  const response = await fetch(url, {
    headers: already > 0 ? { Range: `bytes=${already}-` } : {},
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`모델 파일을 받지 못했습니다 (HTTP ${response.status}).`);
  }

  // 206이면 이어받기가 받아들여진 것이고, 200이면 서버가 전체를 다시 보낸다.
  const isResumed = response.status === 206 && already > 0;
  const startFrom = isResumed ? already : 0;
  const remaining = Number(response.headers.get('Content-Length') ?? 0);
  const contentRange = response.headers.get('Content-Range');
  if (isResumed) {
    const match = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (
      !match ||
      Number(match[1]) !== already ||
      Number(match[3]) !== expectedBytes
    ) {
      fs.rmSync(partPath, { force: true });
      throw new Error('모델 이어받기 응답이 기존 파일과 맞지 않습니다.');
    }
  }
  const totalBytes = remaining > 0 ? startFrom + remaining : 0;
  if (remaining > 0 && totalBytes !== expectedBytes) {
    fs.rmSync(partPath, { force: true });
    throw new Error('모델 파일 크기가 예상과 다릅니다.');
  }

  fs.mkdirSync(path.dirname(partPath), { recursive: true });
  const handle = fs.createWriteStream(partPath, {
    flags: isResumed ? 'a' : 'w',
  });

  let downloadedBytes = startFrom;
  try {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!handle.write(value)) {
        await new Promise<void>(resolve => handle.once('drain', () => resolve()));
      }
      downloadedBytes += value.length;
      onProgress({ downloadedBytes, totalBytes });
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      handle.close(error => (error ? reject(error) : resolve()));
    });
  }

  return totalBytes;
};

/**
 * 가중치 파일을 이어받기로 확보한다. 이미 있으면 아무것도 하지 않는다.
 * 실패하면 지수 백오프로 재시도하되 `.part`는 남겨 다음 시도가 이어받게 한다.
 */
export const downloadWeightsResumable = async ({
  expectedBytes,
  expectedSha256,
  onProgress,
  retryBaseMs = RETRY_BASE_MS,
  signal,
  targetPath,
  url,
}: {
  expectedBytes: number;
  expectedSha256: string;
  onProgress: (progress: DownloadProgress) => void;
  /** 테스트에서 백오프를 줄이기 위한 값. 실사용에서는 기본값을 쓴다. */
  retryBaseMs?: number;
  signal?: AbortSignal;
  targetPath: string;
  url: string;
}): Promise<void> => {
  if (
    fs.existsSync(targetPath) &&
    (await fileMatchesExpectedModel(targetPath, expectedBytes, expectedSha256))
  ) {
    return;
  }
  fs.rmSync(targetPath, { force: true });

  const partPath = partPathOf(targetPath);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const totalBytes = await fetchIntoPart(
        expectedBytes,
        url,
        partPath,
        onProgress,
        signal,
      );
      const received = sizeOf(partPath);

      // 최종 크기는 서버 헤더 유무와 관계없이 앱에 고정한 값과 비교한다.
      // 응답 본문이 중간에 끝났다면 현재 파일은 검증 가능한 prefix다. 다음
      // 요청의 Content-Range와 마지막 SHA-256 검증이 이를 다시 확인하므로
      // 지우지 않고 이어받는다. 반대로 예상보다 길면 안전하게 폐기한다.
      if (received > expectedBytes || (totalBytes > 0 && received > totalBytes)) {
        fs.rmSync(partPath, { force: true });
        throw new Error('받은 파일 크기가 서버 정보와 다릅니다.');
      }
      if (
        received !== expectedBytes ||
        (totalBytes > 0 && received !== totalBytes)
      ) {
        throw new Error('모델 파일을 끝까지 받지 못했습니다.');
      }

      if (!(await fileMatchesExpectedModel(partPath, expectedBytes, expectedSha256))) {
        fs.rmSync(partPath, { force: true });
        throw new Error('모델 파일 무결성 검증에 실패했습니다.');
      }

      fs.renameSync(partPath, targetPath);
      return;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryBaseMs * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('모델 파일을 받지 못했습니다.');
};
