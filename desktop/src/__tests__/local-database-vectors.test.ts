import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashText } from '../lib/contentHash';
import { TOPIC_MODEL_ID } from '../local-embedding-config';

const electronState = vi.hoisted(() => ({
  appHandlers: {} as Record<string, (...args: unknown[]) => void>,
  ipcHandlers: {} as Record<
    string,
    (event: unknown, ...args: unknown[]) => unknown
  >,
  userData: '',
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => electronState.userData,
    isPackaged: false,
    on: (event: string, callback: (...args: unknown[]) => void) => {
      electronState.appHandlers[event] = callback;
    },
    quit: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: () => null,
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  ipcMain: {
    handle: (
      channel: string,
      callback: (event: unknown, ...args: unknown[]) => unknown,
    ) => {
      electronState.ipcHandlers[channel] = callback;
    },
  },
  shell: {
    showItemInFolder: vi.fn(),
  },
}));

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const OWNER_SEARCH = '33333333-3333-4333-8333-333333333333';
const OWNER_REPLACE = '44444444-4444-4444-8444-444444444444';
const OWNER_CENTER = '55555555-5555-4555-8555-555555555555';
const OWNER_TOPIC = '66666666-6666-4666-8666-666666666666';
const OWNER_MIGRATION = '77777777-7777-4777-8777-777777777777';
const OWNER_INBOX_CSLS = '88888888-8888-4888-8888-888888888888';
const OWNER_SINGLE_LINK = '99999999-9999-4999-8999-999999999999';
const CURRENT_SIGNATURE =
  'Hoon03/subnota-bge-m3-koen-int8-onnx@3b2aa404f867251423f68c5c51b23d91688ab97b:onnx-q8:cls:norm1';
let databasePath = '';
let temporaryDirectory = '';

const eventFor = (id: number, url = '') => ({
  senderFrame: { url },
  sender: { getURL: () => url, id, once: vi.fn() },
});
const eventA = eventFor(1);
const eventB = eventFor(2);
const eventSearch = eventFor(4);
const eventReplace = eventFor(5);
const eventCenter = eventFor(6);
const eventTopic = eventFor(7);
const eventInboxCsls = eventFor(8);

const invoke = (channel: string, event: unknown, ...args: unknown[]) => {
  const handler = electronState.ipcHandlers[channel];
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`);
  return handler(event, ...args);
};

const memo = (
  id: string,
  content: string,
  contentHash: string,
  patch: Record<string, unknown> = {},
) => ({
  category: 'Ideas',
  content,
  content_hash: contentHash,
  created_at: '2026-07-26T00:00:00.000Z',
  id,
  is_archived: false,
  local_sync_status: 'pending',
  updated_at: '2026-07-26T00:00:00.000Z',
  ...patch,
});

// bge-m3는 1024차원이다.
const embeddingVector = (first = 1, second = 0) =>
  Array.from({ length: 1024 }, (_, index) =>
    index === 0 ? first : index === 1 ? second : 0,
  );

// CSLS는 같은 청크의 질의 벡터("query: " 접두사)도 쓴다. 따로 주지 않으면
// 문서 벡터와 같은 것을 쓴다 — 그러면 muD == muQ라 기대값을 따라가기 쉽다.
const vectorChunk = (
  text: string,
  vector: number[] | null = embeddingVector(),
  queryVector: number[] | null = vector,
) => ({
  end: text.length,
  id: `chunk-0-0-${text.length}`,
  index: 0,
  queryVector,
  start: 0,
  text,
  vector,
});

const upsertMemo = (
  event: unknown,
  ownerId: string,
  value: ReturnType<typeof memo>,
) => invoke('local-db:upsert', event, ownerId, 'memo', value.id, value);

const patchMemoSyncBase = (
  event: unknown,
  ownerId: string,
  memoId: string,
  content: string,
  contentHash: string,
) =>
  invoke(
    'local-db:patch-memo-sync-base',
    event,
    ownerId,
    memoId,
    content,
    contentHash,
  );

const replaceVectors = (
  event: unknown,
  ownerId: string,
  memoId: string,
  contentHash: string,
  content: string,
  chunks: ReturnType<typeof vectorChunk>[],
) =>
  invoke(
    'local-db:replace-memo-vectors',
    event,
    ownerId,
    memoId,
    contentHash,
    content,
    chunks,
  ) as Promise<{ stored: boolean }>;

const vectorState = (event: unknown, ownerId: string) =>
  invoke('local-db:memo-vector-state', event, ownerId) as Promise<
    Array<{ chunkCount: number; memoId: string; sourceContentHash: string }>
  >;

type SearchResult = {
  chunkId: string;
  chunkText: string;
  endIndex: number;
  memoContent: string;
  memoCreatedAt: string | null;
  memoId: string;
  memoUpdatedAt: string | null;
  similarity: number;
  startIndex: number;
};

const searchVectors = (
  event: unknown,
  ownerId: string,
  queryVector: number[],
  excludeMemoId: string | null,
  limit: number,
  minimumSimilarity: number,
) =>
  invoke(
    'local-db:search-memo-vectors',
    event,
    ownerId,
    queryVector,
    excludeMemoId,
    limit,
    minimumSimilarity,
  ) as Promise<SearchResult[]>;

const inboxRecord = (summary: string) => ({
  canonicalUrl: 'https://example.com/article',
  channelTitle: null,
  createdAt: '2026-07-26T00:00:00.000Z',
  description: null,
  domain: 'example.com',
  duration: null,
  id: 'inbox-vector-1',
  keywords: ['검색'],
  liked: false,
  originalUrl: 'https://example.com/article',
  publishedAt: null,
  selectedText: null,
  sourceType: 'url',
  summary,
  summaryBasis: null,
  summaryDetail: null,
  summaryOneLiner: summary,
  summaryProvider: null,
  summarySearchText: null,
  summaryStatus: 'ready',
  thumbnailUrl: null,
  title: '관련 링크',
  userNote: null,
});

const inspectDatabase = <T,>(operation: (database: DatabaseSync) => T): T => {
  const database = new DatabaseSync(databasePath);
  try {
    return operation(database);
  } finally {
    database.close();
  }
};

beforeAll(async () => {
  temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'subnota-vector-store-'),
  );
  electronState.userData = temporaryDirectory;
  databasePath = path.join(temporaryDirectory, 'subnota-local.sqlite3');

  // Seed one stale signature and one current BGE row using the previous schema.
  // Startup must delete stale vectors, ALTER in topic columns, and preserve the
  // current BGE bytes.
  const database = new DatabaseSync(databasePath);
  database.exec(
    'CREATE TABLE local_memo_chunk_vectors (' +
      'owner_id TEXT NOT NULL, memo_id TEXT NOT NULL, chunk_id TEXT NOT NULL,' +
      'chunk_index INTEGER NOT NULL, chunk_text TEXT NOT NULL,' +
      'start_index INTEGER NOT NULL, end_index INTEGER NOT NULL,' +
      'source_content_hash TEXT NOT NULL, embedding_signature TEXT NOT NULL,' +
      'vector BLOB NOT NULL CHECK(length(vector) = 4096),' +
      'query_vector BLOB NOT NULL CHECK(length(query_vector) = 4096),' +
      'PRIMARY KEY (owner_id, memo_id, chunk_id));' +
      'CREATE TABLE local_memo_vector_state (' +
      'owner_id TEXT NOT NULL, memo_id TEXT NOT NULL,' +
      'source_content_hash TEXT NOT NULL, embedding_signature TEXT NOT NULL,' +
      'chunk_count INTEGER NOT NULL, indexed_at TEXT NOT NULL,' +
      'PRIMARY KEY (owner_id, memo_id));',
  );
  database
    .prepare(
      'INSERT INTO local_memo_chunk_vectors VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      OWNER_A,
      'old-memo',
      'old-chunk',
      0,
      'old',
      0,
      3,
      'old-hash',
      'old-model',
      Buffer.alloc(4096),
      Buffer.alloc(4096),
    );
  database.prepare(
    'INSERT INTO local_memo_chunk_vectors VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    OWNER_MIGRATION, 'kept-memo', 'kept-chunk', 0, 'kept text', 0, 9,
    'kept-hash', CURRENT_SIGNATURE, Buffer.alloc(4096, 1), Buffer.alloc(4096, 2),
  );
  database
    .prepare('INSERT INTO local_memo_vector_state VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      OWNER_A,
      'old-memo',
      'old-hash',
      'old-model',
      1,
      '2026-07-25T00:00:00.000Z',
    );
  database.close();

  await import('../local-database');
  await invoke('local-db:set-owner', eventA, OWNER_A);
  await invoke('local-db:set-owner', eventB, OWNER_B);
  await invoke('local-db:set-owner', eventSearch, OWNER_SEARCH);
  await invoke('local-db:set-owner', eventReplace, OWNER_REPLACE);
  await invoke('local-db:set-owner', eventCenter, OWNER_CENTER);
});

afterAll(async () => {
  await electronState.appHandlers['will-quit']?.();
  fs.rmSync(temporaryDirectory, {
    force: true,
    maxRetries: 5,
    recursive: true,
    retryDelay: 100,
  });
});

describe('local memo vector SQLite store', () => {
  it('discards vectors and state from a different embedding signature', async () => {
    expect(await vectorState(eventA, OWNER_A)).toEqual([]);
    const counts = inspectDatabase(database => ({
      states: Number(
        database
          .prepare('SELECT COUNT(*) AS count FROM local_memo_vector_state WHERE owner_id = ?')
          .get(OWNER_A)?.count,
      ),
      vectors: Number(
        database
          .prepare('SELECT COUNT(*) AS count FROM local_memo_chunk_vectors WHERE owner_id = ?')
          .get(OWNER_A)?.count,
      ),
    }));
    expect(counts).toEqual({ states: 0, vectors: 0 });
  });

  it('adds nullable topic columns to an existing BGE table without losing its vectors', () => {
    const migrated = inspectDatabase(database => ({
      columns: database.prepare('PRAGMA table_info(local_memo_chunk_vectors)').all().map(row => String(row.name)),
      row: database.prepare(
        'SELECT length(vector) AS body, length(query_vector) AS query, topic_vector, topic_signature FROM local_memo_chunk_vectors WHERE owner_id = ?'
      ).get(OWNER_MIGRATION),
    }));
    expect(migrated.columns).toContain('topic_vector');
    expect(migrated.columns).toContain('topic_signature');
    expect(migrated.row).toEqual({ body: 4096, query: 4096, topic_vector: null, topic_signature: null });
    expect(() => inspectDatabase(database => database.prepare(
      'UPDATE local_memo_chunk_vectors SET topic_vector = zeroblob(1) WHERE owner_id = ?'
    ).run(OWNER_MIGRATION))).toThrow();
  });

  it('keeps the newest acknowledged sync base across a later pending content write', async () => {
    const memoId = 'memo-sync-base-race';
    await upsertMemo(
      eventA,
      OWNER_A,
      memo(memoId, '코데이터 솔루', 'hash-local-a', {
        synced_content: null,
        synced_content_hash: null,
      }),
    );
    await patchMemoSyncBase(
      eventA,
      OWNER_A,
      memoId,
      '코데이터 솔루',
      'hash-server-a',
    );

    // React에 남아 있던 오래된 pending 행이 뒤늦게 저장되는 상황이다.
    await upsertMemo(
      eventA,
      OWNER_A,
      memo(memoId, '코데이터 솔루션', 'hash-local-b', {
        synced_content: null,
        synced_content_hash: null,
      }),
    );

    const stored = inspectDatabase(database => {
      const row = database
        .prepare(
          "SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?",
        )
        .get(OWNER_A, memoId) as { payload_json: string };
      return JSON.parse(row.payload_json) as Record<string, unknown>;
    });
    expect(stored.content).toBe('코데이터 솔루션');
    expect(stored.synced_content).toBe('코데이터 솔루');
    expect(stored.synced_content_hash).toBe('hash-server-a');

    // 반대 순서로 승인이 뒤늦게 와도 최신 로컬 내용은 건드리지 않는다.
    await patchMemoSyncBase(
      eventA,
      OWNER_A,
      memoId,
      '코데이터 솔루션',
      'hash-server-b',
    );
    const patched = inspectDatabase(database => {
      const row = database
        .prepare(
          "SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?",
        )
        .get(OWNER_A, memoId) as { payload_json: string };
      return JSON.parse(row.payload_json) as Record<string, unknown>;
    });
    expect(patched.content).toBe('코데이터 솔루션');
    expect(patched.synced_content).toBe('코데이터 솔루션');
    expect(patched.synced_content_hash).toBe('hash-server-b');
  });

  it('stores 1024 float32 values as a 4096-byte BLOB and records empty indexes', async () => {
    await upsertMemo(eventA, OWNER_A, memo('memo-a', 'hello', 'hash-a'));
    await expect(
      replaceVectors(
        eventA,
        OWNER_A,
        'memo-a',
        'hash-a',
        'hello',
        [vectorChunk('hello')],
      ),
    ).resolves.toEqual({ stored: true });

    const stored = inspectDatabase(database =>
      database
        .prepare(
          'SELECT typeof(vector) AS storage_type, length(vector) AS byte_length, ' +
            'embedding_signature, vector FROM local_memo_chunk_vectors ' +
            'WHERE owner_id = ? AND memo_id = ?',
        )
        .get(OWNER_A, 'memo-a'),
    ) as {
      byte_length: number;
      embedding_signature: string;
      storage_type: string;
      vector: Uint8Array;
    };
    expect(stored.storage_type).toBe('blob');
    expect(stored.byte_length).toBe(4096);
    expect(stored.embedding_signature).toBe(CURRENT_SIGNATURE);
    expect(
      new Float32Array(
        stored.vector.buffer,
        stored.vector.byteOffset,
        stored.vector.byteLength / Float32Array.BYTES_PER_ELEMENT,
      )[0],
    ).toBe(1);

    await upsertMemo(eventA, OWNER_A, memo('empty-memo', '---', 'empty-hash'));
    await expect(
      replaceVectors(
        eventA,
        OWNER_A,
        'empty-memo',
        'empty-hash',
        '---',
        [],
      ),
    ).resolves.toEqual({ stored: true });
    const emptyState = (await vectorState(eventA, OWNER_A)).find(
      row => row.memoId === 'empty-memo',
    );
    expect(emptyState).toEqual({
      chunkCount: 0,
      memoId: 'empty-memo',
      pendingTopicCount: 0,
      sourceContentHash: 'empty-hash',
    });
    expect(
      inspectDatabase(database =>
        Number(
          database
            .prepare(
              'SELECT COUNT(*) AS count FROM local_memo_chunk_vectors WHERE owner_id = ? AND memo_id = ?',
            )
            .get(OWNER_A, 'empty-memo')?.count,
        ),
      ),
    ).toBe(0);
  });

  it('rejects stale commits and invalidates vectors on content change or archive', async () => {
    await upsertMemo(eventA, OWNER_A, memo('stale-memo', 'old', 'old-hash'));
    await replaceVectors(
      eventA,
      OWNER_A,
      'stale-memo',
      'old-hash',
      'old',
      [vectorChunk('old')],
    );

    await upsertMemo(eventA, OWNER_A, memo('stale-memo', 'new', 'new-hash'));
    expect(
      (await vectorState(eventA, OWNER_A)).some(
        row => row.memoId === 'stale-memo',
      ),
    ).toBe(false);
    await expect(
      invoke(
        'local-db:memo-vector-texts',
        eventA,
        OWNER_A,
        'stale-memo',
      ),
    ).resolves.toEqual(['old']);
    await expect(
      replaceVectors(
        eventA,
        OWNER_A,
        'stale-memo',
        'old-hash',
        'old',
        [vectorChunk('old')],
      ),
    ).resolves.toEqual({ stored: false });
    await expect(
      replaceVectors(
        eventA,
        OWNER_A,
        'stale-memo',
        'new-hash',
        'new',
        [vectorChunk('new')],
      ),
    ).resolves.toEqual({ stored: true });

    await upsertMemo(
      eventA,
      OWNER_A,
      memo('stale-memo', 'new', 'new-hash', { is_archived: true }),
    );
    expect(
      (await vectorState(eventA, OWNER_A)).some(
        row => row.memoId === 'stale-memo',
      ),
    ).toBe(false);
  });

  it('reuses an exact chunk-text vector when positional ids change', async () => {
    await upsertMemo(eventA, OWNER_A, memo('reuse-memo', 'same', 'reuse-old'));
    await replaceVectors(
      eventA,
      OWNER_A,
      'reuse-memo',
      'reuse-old',
      'same',
      [vectorChunk('same', embeddingVector(0.25, 0.75))],
    );

    const nextContent = 'prefix\nsame';
    await upsertMemo(
      eventA,
      OWNER_A,
      memo('reuse-memo', nextContent, 'reuse-new'),
    );
    const movedChunk = {
      ...vectorChunk('same', null),
      id: 'chunk-1-7-11',
      index: 1,
      start: 7,
      end: 11,
    };
    await expect(
      replaceVectors(
        eventA,
        OWNER_A,
        'reuse-memo',
        'reuse-new',
        nextContent,
        [vectorChunk('prefix'), movedChunk],
      ),
    ).resolves.toEqual({ stored: true });

    const stored = inspectDatabase(database =>
      database
        .prepare(
          'SELECT vector FROM local_memo_chunk_vectors ' +
            'WHERE owner_id = ? AND memo_id = ? AND chunk_id = ?',
        )
        .get(OWNER_A, 'reuse-memo', movedChunk.id),
    ) as { vector: Uint8Array };
    const reused = new Float32Array(
      stored.vector.buffer,
      stored.vector.byteOffset,
      stored.vector.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    expect(reused[0]).toBeCloseTo(0.25);
    expect(reused[1]).toBeCloseTo(0.75);
  });

  it('stores, searches, and invalidates local Inbox vectors', async () => {
    const record = inboxRecord('로컬 검색과 관련된 링크 요약');
    const sourceText = [
      record.title,
      record.summary,
      ...record.keywords,
    ].join('\n');
    await invoke(
      'local-db:upsert',
      eventA,
      OWNER_A,
      'inbox',
      record.id,
      record,
    );
    await expect(
      invoke(
        'local-db:replace-inbox-vector',
        eventA,
        OWNER_A,
        record.id,
        hashText(sourceText),
        sourceText,
        embeddingVector(1, 0),
      ),
    ).resolves.toEqual({ stored: true });

    // 중심화에는 링크 코퍼스가 필요하다. 단일 링크만 있으면 평균을
    // 뺀 벡터가 0이 된다.
    for (const [id, vector] of [
      ['inbox-vector-other-a', embeddingVector(0, 1)],
      ['inbox-vector-other-b', embeddingVector(-1, 0)],
    ] as const) {
      const other = { ...inboxRecord(`다른 링크 ${id}`), id };
      const otherText = [other.title, other.summary, ...other.keywords].join('\n');
      await invoke('local-db:upsert', eventA, OWNER_A, 'inbox', id, other);
      await invoke('local-db:replace-inbox-vector', eventA, OWNER_A, id,
        hashText(otherText), otherText, vector);
    }

    const results = (await invoke(
      'local-db:search-inbox-vectors',
      eventA,
      OWNER_A,
      embeddingVector(1, 0),
      5,
      -2,
    )) as Array<{
      inboxSessionId: string;
      similarity: number;
      sourceUrl: string | null;
    }>;
    expect(results[0]).toMatchObject({
      inboxSessionId: record.id,
      sourceUrl: record.canonicalUrl,
    });
    expect(Number.isFinite(results[0].similarity)).toBe(true);

    await invoke(
      'local-db:upsert',
      eventA,
      OWNER_A,
      'inbox',
      record.id,
      inboxRecord('완전히 바뀐 요약'),
    );
    await expect(
      invoke('local-db:inbox-vector-state', eventA, OWNER_A),
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inboxSessionId: record.id }),
      ]),
    );
  });

  it('링크 검색도 중심화와 메모 질의 허브 벌점을 적용하고 삭제 후 다시 계산한다', async () => {
    const owner = OWNER_INBOX_CSLS;
    await invoke('local-db:set-owner', eventInboxCsls, owner);
    const query = embeddingVector(1, 0);
    const search = () => invoke('local-db:search-inbox-vectors', eventInboxCsls,
      owner, query, 5, -2) as Promise<Array<{ inboxSessionId: string; similarity: number }>>;
    let scoreWithTwoLinks: number | undefined;
    for (const [index, vector] of [
      embeddingVector(1, 0), embeddingVector(0, 1), embeddingVector(-1, 0),
    ].entries()) {
      const id = `csls-link-${index}`;
      const record = { ...inboxRecord(`링크 요약 ${index}`), id };
      const sourceText = [record.title, record.summary, ...record.keywords].join('\n');
      await invoke('local-db:upsert', eventInboxCsls, owner, 'inbox', id, record);
      await invoke('local-db:replace-inbox-vector', eventInboxCsls, owner,
        id, hashText(sourceText), sourceText, vector);
      if (index === 1) {
        scoreWithTwoLinks = (await search()).find(item =>
          item.inboxSessionId === 'csls-link-0')?.similarity;
      }
    }

    const before = await search();
    const scoreBeforeHub = before.find(item => item.inboxSessionId === 'csls-link-0')?.similarity;
    if (scoreBeforeHub === undefined) throw new Error('Expected first link score');
    if (scoreWithTwoLinks === undefined) throw new Error('Expected two-link score');
    expect(scoreBeforeHub).not.toBeCloseTo(scoreWithTwoLinks);

    // 평균 질의 방향은 0으로 유지하되 x 방향 허브 참조를 만든다.
    for (let index = 0; index < 20; index += 1) {
      const memoId = `csls-memo-${index}`;
      const content = `질의 기준 ${index}`;
      const vector = embeddingVector(index < 10 ? 1 : -1, 0);
      await upsertMemo(eventInboxCsls, owner, memo(memoId, content, hashText(content)));
      await replaceVectors(eventInboxCsls, owner, memoId, hashText(content), content,
        [vectorChunk(content, vector)]);
    }
    const withHub = await search();
    const exact = withHub.find(item => item.inboxSessionId === 'csls-link-0');
    if (!exact) throw new Error('Expected indexed link');
    expect(exact.similarity).toBeLessThan(scoreBeforeHub);

    await invoke('local-db:delete', eventInboxCsls, owner, 'inbox', 'csls-link-2');
    const after = await search();
    expect(after.find(item => item.inboxSessionId === 'csls-link-2')).toBeUndefined();
    expect(after.find(item => item.inboxSessionId === 'csls-link-0')?.similarity)
      .not.toBeCloseTo(exact.similarity);
  });

  it('링크가 하나뿐이어도 중심화 뒤 사라지지 않고 검색된다', async () => {
    const owner = OWNER_SINGLE_LINK;
    const event = eventFor(9);
    await invoke('local-db:set-owner', event, owner);
    for (let index = 0; index < 4; index += 1) {
      const memoId = `single-link-memo-${index}`;
      const content = `메모 ${index}`;
      await upsertMemo(event, owner, memo(memoId, content, hashText(content)));
      await replaceVectors(event, owner, memoId, hashText(content), content,
        [vectorChunk(content, embeddingVector(index % 2 ? -1 : 1, index < 2 ? 1 : -1))]);
    }
    const record = { ...inboxRecord('하나뿐인 링크'), id: 'single-link' };
    const sourceText = [record.title, record.summary, ...record.keywords].join('\n');
    await invoke('local-db:upsert', event, owner, 'inbox', record.id, record);
    await invoke('local-db:replace-inbox-vector', event, owner,
      record.id, hashText(sourceText), sourceText, embeddingVector(1, 0));

    const results = await invoke('local-db:search-inbox-vectors', event,
      owner, embeddingVector(1, 0), 5, -2) as Array<{ inboxSessionId: string }>;
    expect(results.map(item => item.inboxSessionId)).toEqual(['single-link']);
  });

  it('isolates owners and removes vectors through both delete paths', async () => {
    await upsertMemo(eventA, OWNER_A, memo('shared-id', 'owner a', 'hash-owner-a'));
    await upsertMemo(eventB, OWNER_B, memo('shared-id', 'owner b', 'hash-owner-b'));
    await replaceVectors(
      eventA,
      OWNER_A,
      'shared-id',
      'hash-owner-a',
      'owner a',
      [vectorChunk('owner a')],
    );
    await replaceVectors(
      eventB,
      OWNER_B,
      'shared-id',
      'hash-owner-b',
      'owner b',
      [vectorChunk('owner b')],
    );

    expect(
      (await vectorState(eventA, OWNER_A)).find(row => row.memoId === 'shared-id')
        ?.sourceContentHash,
    ).toBe('hash-owner-a');
    expect(
      (await vectorState(eventB, OWNER_B)).find(row => row.memoId === 'shared-id')
        ?.sourceContentHash,
    ).toBe('hash-owner-b');

    await invoke('local-db:delete-memo-vectors', eventA, OWNER_A, 'shared-id');
    expect(
      (await vectorState(eventA, OWNER_A)).some(row => row.memoId === 'shared-id'),
    ).toBe(false);
    expect(
      (await vectorState(eventB, OWNER_B)).some(row => row.memoId === 'shared-id'),
    ).toBe(true);

    await invoke('local-db:delete', eventB, OWNER_B, 'memo', 'shared-id');
    expect(
      (await vectorState(eventB, OWNER_B)).some(row => row.memoId === 'shared-id'),
    ).toBe(false);
  });

  it('removes indexed synced memos that disappear during replacement', async () => {
    await upsertMemo(
      eventA,
      OWNER_A,
      memo('remote-gone', 'remote', 'remote-hash', {
        local_sync_status: 'synced',
      }),
    );
    await replaceVectors(
      eventA,
      OWNER_A,
      'remote-gone',
      'remote-hash',
      'remote',
      [vectorChunk('remote')],
    );

    await invoke('local-db:replace-synced', eventA, OWNER_A, 'memo', []);
    expect(
      (await vectorState(eventA, OWNER_A)).some(
        row => row.memoId === 'remote-gone',
      ),
    ).toBe(false);
  });

  it('skips both synced deletion and remote upsert for preserved record ids', async () => {
    const localProtected = {
      id: 'protected-calendar',
      local_sync_status: 'synced',
      title: '열려 있는 로컬 일정',
      updated_at: '2026-08-11T00:00:00.000Z',
    };
    await invoke(
      'local-db:upsert',
      eventA,
      OWNER_A,
      'calendar',
      localProtected.id,
      localProtected,
    );
    await invoke(
      'local-db:upsert',
      eventA,
      OWNER_A,
      'calendar',
      'stale-calendar',
      {
        id: 'stale-calendar',
        local_sync_status: 'synced',
        title: '삭제될 일정',
        updated_at: '2026-08-11T00:00:00.000Z',
      },
    );

    const records = (await invoke(
      'local-db:replace-synced',
      eventA,
      OWNER_A,
      'calendar',
      [
        {
          id: localProtected.id,
          title: '원격 일정',
          updated_at: '2026-08-12T00:00:00.000Z',
        },
        {
          id: 'new-calendar',
          title: '새 원격 일정',
          updated_at: '2026-08-12T00:00:00.000Z',
        },
      ],
      [localProtected.id],
    )) as Array<{ id: string; title: string }>;

    expect(records.find(record => record.id === localProtected.id)?.title).toBe(
      '열려 있는 로컬 일정',
    );
    expect(records.some(record => record.id === 'stale-calendar')).toBe(false);
    expect(records.find(record => record.id === 'new-calendar')?.title).toBe(
      '새 원격 일정',
    );
  });

  it('does not overwrite locally modified records during a synced replacement', async () => {
    const cases = [
      { id: 'pending-memo', recordType: 'memo', status: 'pending' },
      { id: 'failed-calendar', recordType: 'calendar', status: 'failed' },
      { id: 'deleted-inbox', recordType: 'inbox', status: 'pending_delete' },
    ];

    for (const testCase of cases) {
      await invoke(
        'local-db:upsert',
        eventReplace,
        OWNER_REPLACE,
        testCase.recordType,
        testCase.id,
        {
          id: testCase.id,
          local_sync_status: testCase.status,
          marker: 'local',
          updated_at: '2026-08-11T00:00:00.000Z',
        },
      );

      const records = (await invoke(
        'local-db:replace-synced',
        eventReplace,
        OWNER_REPLACE,
        testCase.recordType,
        [
          {
            id: testCase.id,
            marker: 'remote',
            updated_at: '2026-08-12T00:00:00.000Z',
          },
          {
            id: `${testCase.id}-new`,
            marker: 'new-remote',
            updated_at: '2026-08-12T00:00:00.000Z',
          },
        ],
      )) as Array<{
        id: string;
        local_sync_status?: string;
        marker: string;
      }>;

      expect(records.find(record => record.id === testCase.id)).toEqual(
        expect.objectContaining({
          local_sync_status: testCase.status,
          marker: 'local',
        }),
      );
      expect(records.find(record => record.id === `${testCase.id}-new`)).toEqual(
        expect.objectContaining({
          local_sync_status: 'synced',
          marker: 'new-remote',
        }),
      );
    }
  });

  it('deletes a pending inbox row only when no delete tombstone won the race', async () => {
    const recordId = 'conditional-inbox-delete';
    const pending = {
      ...inboxRecord('pending create'),
      id: recordId,
      local_sync_status: 'pending',
    };
    await invoke(
      'local-db:upsert',
      eventA,
      OWNER_A,
      'inbox',
      recordId,
      pending,
    );
    await expect(
      invoke(
        'local-db:delete-inbox-pending-if-not-deleted',
        eventA,
        OWNER_A,
        recordId,
      ),
    ).resolves.toBe(true);

    await invoke(
      'local-db:upsert',
      eventA,
      OWNER_A,
      'inbox',
      recordId,
      { ...pending, local_sync_status: 'pending_delete' },
    );
    await expect(
      invoke(
        'local-db:delete-inbox-pending-if-not-deleted',
        eventA,
        OWNER_A,
        recordId,
      ),
    ).resolves.toBe(false);

    const rows = (await invoke(
      'local-db:list',
      eventA,
      OWNER_A,
      'inbox',
    )) as Array<{ id: string; local_sync_status: string }>;
    expect(rows).toContainEqual(
      expect.objectContaining({
        id: recordId,
        local_sync_status: 'pending_delete',
      }),
    );
  });

  it('restores the exact local memo snapshot when a pane becomes active during pull', async () => {
    const memoId = 'late-active-memo';
    const localSnapshot = {
      content: '편집기가 가진 A',
      content_hash: 'hash-a',
      created_at: '2026-08-11T00:00:00.000Z',
      id: memoId,
      is_archived: false,
      local_sync_status: 'pending',
      synced_content: '기준 A',
      synced_content_hash: 'base-hash-a',
      updated_at: '2026-08-11T00:00:01.000Z',
    };

    await invoke(
      'local-db:upsert',
      eventReplace,
      OWNER_REPLACE,
      'memo',
      memoId,
      { ...localSnapshot, local_sync_status: 'synced' },
    );
    await invoke(
      'local-db:replace-synced',
      eventReplace,
      OWNER_REPLACE,
      'memo',
      [
        {
          content: '원격 B',
          content_hash: 'hash-b',
          created_at: '2026-08-11T00:00:00.000Z',
          id: memoId,
          is_archived: false,
          synced_content: '원격 B',
          synced_content_hash: 'hash-b',
          updated_at: '2026-08-12T00:00:00.000Z',
        },
      ],
    );

    await invoke(
      'local-db:restore-memo-snapshot-after-pull',
      eventReplace,
      OWNER_REPLACE,
      memoId,
      localSnapshot,
    );

    const restored = inspectDatabase(database => {
      const row = database
        .prepare(
          "SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?",
        )
        .get(OWNER_REPLACE, memoId) as { payload_json: string };
      return JSON.parse(row.payload_json) as Record<string, unknown>;
    });
    expect(restored).toEqual(localSnapshot);
  });

  it('keeps a newer local edit while repairing its sync base after pull', async () => {
    const memoId = 'late-active-newer-edit';
    const editorSnapshot = {
      content: '편집기가 가진 A',
      content_hash: 'hash-a',
      created_at: '2026-08-11T00:00:00.000Z',
      id: memoId,
      is_archived: false,
      local_sync_status: 'synced',
      synced_content: '기준 A',
      synced_content_hash: 'base-hash-a',
      updated_at: '2026-08-11T00:00:01.000Z',
    };
    await invoke(
      'local-db:upsert',
      eventReplace,
      OWNER_REPLACE,
      'memo',
      memoId,
      editorSnapshot,
    );
    await invoke(
      'local-db:replace-synced',
      eventReplace,
      OWNER_REPLACE,
      'memo',
      [
        {
          ...editorSnapshot,
          content: '원격 B',
          content_hash: 'hash-b',
          synced_content: '원격 B',
          synced_content_hash: 'hash-b',
          updated_at: '2026-08-12T00:00:00.000Z',
        },
      ],
    );

    // The user can type again before the renderer notices the late-active pane.
    // That write must keep its content, but the base installed from remote B is
    // still wrong for the live editor that started from A.
    await invoke(
      'local-db:upsert',
      eventReplace,
      OWNER_REPLACE,
      'memo',
      memoId,
      {
        ...editorSnapshot,
        content: '사용자가 방금 입력한 A′',
        content_hash: 'hash-a-prime',
        local_sync_status: 'pending',
        synced_content: null,
        synced_content_hash: null,
        updated_at: '2026-08-12T00:00:01.000Z',
      },
    );
    await invoke(
      'local-db:restore-memo-snapshot-after-pull',
      eventReplace,
      OWNER_REPLACE,
      memoId,
      editorSnapshot,
    );

    const restored = inspectDatabase(database => {
      const row = database
        .prepare(
          "SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?",
        )
        .get(OWNER_REPLACE, memoId) as { payload_json: string };
      return JSON.parse(row.payload_json) as Record<string, unknown>;
    });
    expect(restored).toEqual(
      expect.objectContaining({
        content: '사용자가 방금 입력한 A′',
        content_hash: 'hash-a-prime',
        local_sync_status: 'pending',
        synced_content: '기준 A',
        synced_content_hash: 'base-hash-a',
      }),
    );
  });

  it('applies a memo sync result only when the expected local content still matches', async () => {
    const memoId = 'atomic-sync-result';
    const local = memo(memoId, 'local B', 'hash-b', {
      synced_content: 'base A',
      synced_content_hash: 'hash-a',
    });
    await upsertMemo(eventReplace, OWNER_REPLACE, local);

    const canonical = {
      ...local,
      content: 'canonical B',
      content_hash: 'canonical-hash-b',
      local_sync_status: 'synced',
      synced_content: 'canonical B',
      synced_content_hash: 'canonical-hash-b',
    };
    await expect(
      invoke(
        'local-db:apply-memo-sync-result',
        eventReplace,
        OWNER_REPLACE,
        memoId,
        'local B',
        canonical,
      ),
    ).resolves.toBe(true);

    const newerLocal = {
      ...canonical,
      content: 'newer C',
      content_hash: 'hash-c',
      local_sync_status: 'pending',
    };
    await upsertMemo(eventReplace, OWNER_REPLACE, newerLocal);
    await expect(
      invoke(
        'local-db:apply-memo-sync-result',
        eventReplace,
        OWNER_REPLACE,
        memoId,
        'canonical B',
        canonical,
      ),
    ).resolves.toBe(false);

    const stored = inspectDatabase(database => {
      const row = database
        .prepare(
          "SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?",
        )
        .get(OWNER_REPLACE, memoId) as { payload_json: string };
      return JSON.parse(row.payload_json) as Record<string, unknown>;
    });
    expect(stored).toEqual(
      expect.objectContaining({
        content: 'newer C',
        local_sync_status: 'pending',
      }),
    );
  });

  it('strictly validates atomic memo sync result records', () => {
    expect(() =>
      invoke(
        'local-db:apply-memo-sync-result',
        eventReplace,
        OWNER_REPLACE,
        'memo-a',
        'content',
        {
          content: 'content',
          id: 'memo-b',
          local_sync_status: 'synced',
          synced_content: 'content',
          synced_content_hash: null,
        },
      ),
    ).toThrow('Invalid memo sync result record');
  });

  it('strictly validates the optional preserved record id collection', () => {
    expect(() =>
      invoke(
        'local-db:replace-synced',
        eventA,
        OWNER_A,
        'memo',
        [],
        'memo-id',
      ),
    ).toThrow('Invalid preserved record ids');
    expect(() =>
      invoke(
        'local-db:replace-synced',
        eventA,
        OWNER_A,
        'memo',
        [],
        Array.from({ length: 501 }, (_, index) => `memo-${index}`),
      ),
    ).toThrow('Invalid preserved record ids');
    expect(() =>
      invoke(
        'local-db:replace-synced',
        eventA,
        OWNER_A,
        'memo',
        [],
        [''],
      ),
    ).toThrow('Invalid preserved record id');
  });

  it('searches active vectors by CSLS rank, threshold, owner, and current memo exclusion', async () => {
    const records = [
      {
        content: 'current content',
        hash: 'search-current-hash',
        id: 'search-current',
        vector: embeddingVector(1, 0),
      },
      {
        content: 'nearest content',
        hash: 'search-nearest-hash',
        id: 'search-nearest',
        vector: embeddingVector(1, 0),
      },
      {
        content: 'medium content',
        hash: 'search-medium-hash',
        id: 'search-medium',
        vector: embeddingVector(0.8, 0.6),
      },
      {
        content: 'low content',
        hash: 'search-low-hash',
        id: 'search-low',
        vector: embeddingVector(0, 1),
      },
    ];
    for (const record of records) {
      await upsertMemo(
        eventSearch,
        OWNER_SEARCH,
        memo(record.id, record.content, record.hash),
      );
      await replaceVectors(
        eventSearch,
        OWNER_SEARCH,
        record.id,
        record.hash,
        record.content,
        [vectorChunk(record.content, record.vector)],
      );
    }

    await upsertMemo(
      eventA,
      OWNER_A,
      memo('search-foreign', 'foreign content', 'search-foreign-hash'),
    );
    await replaceVectors(
      eventA,
      OWNER_A,
      'search-foreign',
      'search-foreign-hash',
      'foreign content',
      [vectorChunk('foreign content', embeddingVector(1, 0))],
    );

    // 점수가 CSLS라 -1이 더 이상 "전부 통과"가 아니다(대략 -0.5 ~ 1.5이고
    // 허브 벌점 때문에 더 내려갈 수 있다). 바닥은 검증이 허용하는 -2로 둔다.
    const results = await searchVectors(
      eventSearch,
      OWNER_SEARCH,
      embeddingVector(1, 0),
      'search-current',
      10,
      -2,
    );
    expect(results.map(result => result.memoId)).toEqual([
      'search-nearest',
      'search-medium',
      'search-low',
    ]);
    expect(results[0]).toMatchObject({
      chunkId: 'chunk-0-0-15',
      chunkText: 'nearest content',
      endIndex: 15,
      memoContent: 'nearest content',
      memoCreatedAt: '2026-07-26T00:00:00.000Z',
      memoId: 'search-nearest',
      memoUpdatedAt: '2026-07-26T00:00:00.000Z',
      startIndex: 0,
    });
    // 코사인이면 1 / 0.8 / 0 이었다. CSLS는 코퍼스 전체의 허브 벌점이 섞여
    // 손으로 적어 둘 만한 상수가 아니다 — 내림차순만 보장하면 된다.
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
    expect(results.some(result => result.memoId === 'search-current')).toBe(false);
    expect(results.some(result => result.memoId === 'search-foreign')).toBe(false);

    await expect(
      searchVectors(
        eventSearch,
        OWNER_SEARCH,
        embeddingVector(1, 0),
        'search-current',
        10,
        0.9,
      ),
    ).resolves.toMatchObject([{ memoId: 'search-nearest' }]);
    await expect(
      searchVectors(
        eventSearch,
        OWNER_SEARCH,
        embeddingVector(1, 0),
        'search-current',
        1,
        -1,
      ),
    ).resolves.toMatchObject([{ memoId: 'search-nearest' }]);

    // 첫 검색이 메모리 cache를 만든 뒤에도 새 벡터와 콘텐츠 무효화가
    // 다음 검색에 즉시 반영되어야 한다.
    await upsertMemo(
      eventSearch,
      OWNER_SEARCH,
      memo('search-cache-new', 'new cached content', 'search-cache-hash'),
    );
    await replaceVectors(
      eventSearch,
      OWNER_SEARCH,
      'search-cache-new',
      'search-cache-hash',
      'new cached content',
      [vectorChunk('new cached content', embeddingVector(1, 0))],
    );
    await expect(
      searchVectors(
        eventSearch,
        OWNER_SEARCH,
        embeddingVector(1, 0),
        'search-current',
        1,
        -1,
      ),
    ).resolves.toMatchObject([{ memoId: 'search-cache-new' }]);

    await upsertMemo(
      eventSearch,
      OWNER_SEARCH,
      memo(
        'search-cache-new',
        'changed after cached search',
        'search-cache-changed-hash',
      ),
    );
    await expect(
      searchVectors(
        eventSearch,
        OWNER_SEARCH,
        embeddingVector(1, 0),
        'search-current',
        1,
        -1,
      ),
    ).resolves.toMatchObject([{ memoId: 'search-nearest' }]);
  });

  describe('centered memo vectors', () => {
    // Every vector shares a large third component, like bge-m3's crowding:
    // raw cosine calls them all similar, centering tells the topics apart.
    const crowded = (first: number, second: number) =>
      Array.from({ length: 1024 }, (_, index) =>
        index === 0 ? first : index === 1 ? second : index === 2 ? 3 : 0,
      );
    const seedMemos = [
      { id: 'center-a1', vector: crowded(1, 0) },
      { id: 'center-a2', vector: crowded(0.95, 0.05) },
      { id: 'center-b1', vector: crowded(0, 1) },
      { id: 'center-b2', vector: crowded(0.05, 0.95) },
      { id: 'center-candidate-a', vector: crowded(0.9, 0.1) },
      { id: 'center-candidate-b', vector: crowded(0.1, 0.9) },
      { id: 'center-candidate-mixed', vector: crowded(0.5, 0.5) },
      // Neutral filler: the owner needs 20 chunks before centering is trusted.
      ...Array.from({ length: 13 }, (_, index) => ({
        id: `center-filler-${index}`,
        vector: crowded(0.5, 0.5),
      })),
    ];

    beforeAll(async () => {
      for (const record of seedMemos) {
        const hash = `${record.id}-hash`;
        await upsertMemo(eventCenter, OWNER_CENTER, memo(record.id, record.id, hash));
        await replaceVectors(eventCenter, OWNER_CENTER, record.id, hash, record.id, [
          vectorChunk(record.id, record.vector),
        ]);
      }
    });

    const classify = (request: Record<string, unknown>) =>
      invoke('local-db:classify-folder-memos', eventCenter, OWNER_CENTER, {
        candidateMemoIds: [
          'center-candidate-a',
          'center-candidate-b',
          'center-candidate-mixed',
          'center-missing',
        ],
        folders: [
          { folderId: 'folder-a', seedMemoIds: ['center-a1', 'center-a2'] },
          { folderId: 'folder-b', seedMemoIds: ['center-b1', 'center-b2'] },
        ],
        margin: 0.03,
        minimumSeeds: 2,
        threshold: 0.4,
        ...request,
      }) as Promise<Array<{ folderId: string; memoId: string; score: number }>>;

    it('files clear candidates and abstains on an even split', async () => {
      const assignments = await classify({});
      expect(
        assignments.map(({ folderId, memoId }) => [memoId, folderId]),
      ).toEqual([
        ['center-candidate-a', 'folder-a'],
        ['center-candidate-b', 'folder-b'],
      ]);
      expect(assignments[0].score).toBeGreaterThan(0.4);
    });

    it('ignores folders with fewer indexed seeds than required', async () => {
      await expect(
        classify({
          folders: [
            { folderId: 'folder-a', seedMemoIds: ['center-a1', 'center-unindexed'] },
            { folderId: 'folder-b', seedMemoIds: ['center-b1', 'center-b2'] },
          ],
        }),
      ).resolves.toEqual([
        expect.objectContaining({ folderId: 'folder-b', memoId: 'center-candidate-b' }),
      ]);
    });

    it('ranks whole memos for nearby notes and shows the closest chunk', async () => {
      const result = (await invoke(
        'local-db:search-similar-memos',
        eventCenter,
        OWNER_CENTER,
        [crowded(0.9, 0.1)],
        'center-candidate-a',
        3,
        0.1,
      )) as { inbox: unknown[]; memos: SearchResult[] };
      expect(result.memos.map(row => row.memoId).slice(0, 2).sort()).toEqual([
        'center-a1',
        'center-a2',
      ]);
      expect(result.memos.every(row => row.memoId !== 'center-candidate-a')).toBe(true);
      expect(result.memos.every(row => !row.memoId.startsWith('center-b'))).toBe(true);
      expect(result.memos[0]).toMatchObject({
        chunkText: result.memos[0].memoId,
        memoContent: result.memos[0].memoId,
      });
      expect(result.inbox).toEqual([]);
    });

    it('stays silent while too few chunks are indexed to center reliably', async () => {
      const eventSparse = eventFor(7);
      const OWNER_SPARSE = '66666666-6666-4666-8666-666666666666';
      await invoke('local-db:set-owner', eventSparse, OWNER_SPARSE);
      for (const record of seedMemos.slice(0, 5)) {
        const hash = `${record.id}-hash`;
        await upsertMemo(eventSparse, OWNER_SPARSE, memo(record.id, record.id, hash));
        await replaceVectors(eventSparse, OWNER_SPARSE, record.id, hash, record.id, [
          vectorChunk(record.id, record.vector),
        ]);
      }
      await expect(
        invoke('local-db:classify-folder-memos', eventSparse, OWNER_SPARSE, {
          candidateMemoIds: ['center-candidate-a'],
          folders: [{ folderId: 'folder-a', seedMemoIds: ['center-a1', 'center-a2'] }],
          margin: 0.03,
          minimumSeeds: 2,
          threshold: 0.4,
        }),
      ).resolves.toEqual([]);
      await expect(
        invoke('local-db:search-similar-memos', eventSparse, OWNER_SPARSE, [crowded(1, 0)], null, 3, 0.1),
      ).resolves.toEqual({ inbox: [], memos: [] });
    });

    it('rejects malformed classification and nearby requests', () => {
      expect(() =>
        invoke('local-db:classify-folder-memos', eventCenter, OWNER_CENTER, {
          candidateMemoIds: [],
          folders: [],
          margin: 0.03,
          minimumSeeds: 0,
          threshold: 0.4,
        }),
      ).toThrow('Invalid folder classification settings');
      expect(() =>
        invoke('local-db:search-similar-memos', eventCenter, OWNER_CENTER, [], null, 5, 0.1),
      ).toThrow('Invalid memo search vectors');
    });
  });

  it('rejects malformed memo vector search requests', () => {
    const query = embeddingVector();
    expect(() =>
      searchVectors(eventSearch, OWNER_SEARCH, query.slice(1), null, 5, 0),
    ).toThrow('Invalid memo search vector');
    expect(() =>
      searchVectors(
        eventSearch,
        OWNER_SEARCH,
        query.map((value, index) => (index === 10 ? Number.NaN : value)),
        null,
        5,
        0,
      ),
    ).toThrow('Invalid memo search vector');
    expect(() =>
      invoke(
        'local-db:search-memo-vectors',
        eventSearch,
        OWNER_SEARCH,
        query,
        123,
        5,
        0,
      ),
    ).toThrow('Invalid excluded memo id');
    for (const limit of [0, 11, 1.5]) {
      expect(() =>
        searchVectors(eventSearch, OWNER_SEARCH, query, null, limit, 0),
      ).toThrow('Invalid memo search limit');
    }
    // CSLS 점수는 코사인과 달리 -1~1 밖으로 나간다(대략 -0.5 ~ 1.5).
    // 그래서 허용 범위가 -2~2 로 넓어졌다 — 1.1 은 이제 정상값이다.
    for (const minimumSimilarity of [Number.NaN, -2.1, 2.1]) {
      expect(() =>
        searchVectors(
          eventSearch,
          OWNER_SEARCH,
          query,
          null,
          5,
          minimumSimilarity,
        ),
      ).toThrow('Invalid minimum similarity');
    }
  });

  it('stores separate topic vectors, backfills only missing topic signatures, and searches them independently', async () => {
    await invoke('local-db:set-owner', eventTopic, OWNER_TOPIC);
    const records = [
      { id: 'topic-a', body: embeddingVector(1, 0), topic: embeddingVector(0, 1) },
      { id: 'topic-b', body: embeddingVector(0, 1), topic: embeddingVector(1, 0) },
      { id: 'topic-c', body: embeddingVector(-1, 0), topic: embeddingVector(-1, 0) },
    ];
    for (const { id, body, topic } of records) {
      const content = `${id} topic test content`;
      const hash = hashText(content);
      await upsertMemo(eventTopic, OWNER_TOPIC, memo(id, content, hash));
      expect(await replaceVectors(eventTopic, OWNER_TOPIC, id, hash, content, [{
        ...vectorChunk(content, body),
        topicVector: topic,
        topicSignature: TOPIC_MODEL_ID,
      }])).toEqual({ stored: true });
    }
    const related = await invoke(
      'local-db:search-topic-memo-vectors', eventTopic, OWNER_TOPIC,
      embeddingVector(1, 0), null, 3,
    ) as SearchResult[];
    expect(related[0].memoId).toBe('topic-b');
    const topicStates = await vectorState(eventTopic, OWNER_TOPIC);
    expect(topicStates.filter(state => state.memoId.startsWith('topic-')).map(
      state => (state as { pendingTopicCount: number }).pendingTopicCount,
    )).toEqual([0, 0, 0]);

    const content = 'topic-a topic test content';
    const hash = hashText(content);
    expect(await replaceVectors(eventTopic, OWNER_TOPIC, 'topic-a', hash, content, [{
      ...vectorChunk(content, null, null),
      topicVector: null,
      topicSignature: TOPIC_MODEL_ID,
    }])).toEqual({ stored: true });
    const old = inspectDatabase(database => database.prepare(
      'SELECT length(vector) AS body, length(topic_vector) AS topic FROM local_memo_chunk_vectors WHERE owner_id = ? AND memo_id = ?'
    ).get(OWNER_TOPIC, 'topic-a')) as { body: number; topic: number };
    expect(old).toEqual({ body: 4096, topic: 4096 });
  });

  it('rejects malformed vectors, untrusted senders, and mismatched owners', () => {
    const invalidDimension = {
      ...vectorChunk('bad'),
      vector: Array.from({ length: 1023 }, () => 0),
    };
    expect(() =>
      invoke(
        'local-db:replace-memo-vectors',
        eventA,
        OWNER_A,
        'bad-memo',
        'bad-hash',
        'bad',
        [invalidDimension],
      ),
    ).toThrow('Invalid memo vector chunk');

    expect(() =>
      invoke(
        'local-db:memo-vector-state',
        eventFor(3, 'https://evil.example.com/'),
        OWNER_A,
      ),
    ).toThrow('Untrusted IPC sender');
    expect(() =>
      invoke('local-db:memo-vector-state', eventA, OWNER_B),
    ).toThrow('does not match');
  });
});
