import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashText } from '../lib/contentHash';

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
const CURRENT_SIGNATURE = 'Xenova/bge-m3@onnx-q8';
let databasePath = '';
let temporaryDirectory = '';

const eventFor = (id: number, url = '') => ({
  senderFrame: { url },
  sender: { getURL: () => url, id, once: vi.fn() },
});
const eventA = eventFor(1);
const eventB = eventFor(2);
const eventSearch = eventFor(4);

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

const embeddingVector = (first = 1, second = 0) =>
  Array.from({ length: 1024 }, (_, index) =>
    index === 0 ? first : index === 1 ? second : 0,
  );

const vectorChunk = (
  text: string,
  vector: number[] | null = embeddingVector(),
) => ({
  end: text.length,
  id: `chunk-0-0-${text.length}`,
  index: 0,
  start: 0,
  text,
  vector,
});

const upsertMemo = (
  event: unknown,
  ownerId: string,
  value: ReturnType<typeof memo>,
) => invoke('local-db:upsert', event, ownerId, 'memo', value.id, value);

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

  // Seed rows from a previous embedding space before the production worker
  // starts. Its initialization must discard both tables atomically.
  const database = new DatabaseSync(databasePath);
  database.exec(
    'CREATE TABLE local_memo_chunk_vectors (' +
      'owner_id TEXT NOT NULL, memo_id TEXT NOT NULL, chunk_id TEXT NOT NULL,' +
      'chunk_index INTEGER NOT NULL, chunk_text TEXT NOT NULL,' +
      'start_index INTEGER NOT NULL, end_index INTEGER NOT NULL,' +
      'source_content_hash TEXT NOT NULL, embedding_signature TEXT NOT NULL,' +
      'vector BLOB NOT NULL CHECK(length(vector) = 4096),' +
      'PRIMARY KEY (owner_id, memo_id, chunk_id));' +
      'CREATE TABLE local_memo_vector_state (' +
      'owner_id TEXT NOT NULL, memo_id TEXT NOT NULL,' +
      'source_content_hash TEXT NOT NULL, embedding_signature TEXT NOT NULL,' +
      'chunk_count INTEGER NOT NULL, indexed_at TEXT NOT NULL,' +
      'PRIMARY KEY (owner_id, memo_id));',
  );
  database
    .prepare(
      'INSERT INTO local_memo_chunk_vectors VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
});

afterAll(async () => {
  electronState.appHandlers['before-quit']?.({ preventDefault: vi.fn() });
  await new Promise(resolve => setTimeout(resolve, 50));
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
});

describe('local memo vector SQLite store', () => {
  it('discards vectors and state from a different embedding signature', async () => {
    expect(await vectorState(eventA, OWNER_A)).toEqual([]);
    const counts = inspectDatabase(database => ({
      states: Number(
        database
          .prepare('SELECT COUNT(*) AS count FROM local_memo_vector_state')
          .get()?.count,
      ),
      vectors: Number(
        database
          .prepare('SELECT COUNT(*) AS count FROM local_memo_chunk_vectors')
          .get()?.count,
      ),
    }));
    expect(counts).toEqual({ states: 0, vectors: 0 });
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

    const results = (await invoke(
      'local-db:search-inbox-vectors',
      eventA,
      OWNER_A,
      embeddingVector(1, 0),
      5,
      0.75,
    )) as Array<{
      inboxSessionId: string;
      similarity: number;
      sourceUrl: string | null;
    }>;
    expect(results[0]).toMatchObject({
      inboxSessionId: record.id,
      sourceUrl: record.canonicalUrl,
    });
    expect(results[0].similarity).toBeCloseTo(1);

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

  it('searches active vectors by cosine rank, threshold, owner, and current memo exclusion', async () => {
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

    const results = await searchVectors(
      eventSearch,
      OWNER_SEARCH,
      embeddingVector(1, 0),
      'search-current',
      10,
      -1,
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
    expect(results[0].similarity).toBeCloseTo(1);
    expect(results[1].similarity).toBeCloseTo(0.8);
    expect(results[2].similarity).toBeCloseTo(0);
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
    for (const minimumSimilarity of [Number.NaN, -1.1, 1.1]) {
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
