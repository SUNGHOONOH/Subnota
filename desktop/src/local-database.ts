import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { EMBEDDING_MODEL_ID } from './local-embedding';

const RECORD_TYPES = new Set([
  'memo',
  'calendar',
  'inbox',
  'activity_completion',
  'daily_completion',
  'tree',
  // 서버 배치 결과의 읽기 전용 캐시 (local-first 즉시 표시용).
  'schedule_inbox',
  'topic_map',
]);
const PENDING_TIMEOUT_MS = 10_000;
const QUIT_DRAIN_DEADLINE_MS = 2_000;
const EMBEDDING_DIMENSIONS = 1024;
const ownersByWebContents = new Map<number, string>();
const ownerCleanupListenersByWebContents = new Set<number>();
const pending = new Map<number, {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();
let requestId = 0;
let worker: Worker | null = null;
const STORAGE_CONFIG_FILE = 'local-storage.json';

const getStorageConfigPath = () =>
  path.join(app.getPath('userData'), STORAGE_CONFIG_FILE);

const getDatabasePath = () => {
  try {
    const value = JSON.parse(
      fs.readFileSync(getStorageConfigPath(), 'utf8'),
    ) as { directory?: string };
    if (value.directory && path.isAbsolute(value.directory)) {
      return path.join(value.directory, 'subnota-local.sqlite3');
    }
  } catch {
    // Use the default application data directory.
  }
  return path.join(app.getPath('userData'), 'subnota-local.sqlite3');
};

const saveStorageDirectory = (directory: string) => {
  fs.writeFileSync(
    getStorageConfigPath(),
    JSON.stringify({ directory }, null, 2),
    'utf8',
  );
};

const WORKER_SOURCE = String.raw`
  const { parentPort, workerData } = require('node:worker_threads');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(workerData.databasePath);
  db.exec(
    'PRAGMA journal_mode = WAL;' +
    'PRAGMA synchronous = NORMAL;' +
    'PRAGMA busy_timeout = 5000;' +
    'CREATE TABLE IF NOT EXISTS local_records (' +
      'owner_id TEXT NOT NULL,' +
      'record_type TEXT NOT NULL,' +
      'record_id TEXT NOT NULL,' +
      'payload_json TEXT NOT NULL,' +
      'sync_status TEXT,' +
      'updated_at TEXT NOT NULL,' +
      'is_archived INTEGER NOT NULL DEFAULT 0,' +
      'PRIMARY KEY (owner_id, record_type, record_id)' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_local_records_owner_type_updated ' +
      'ON local_records (owner_id, record_type, updated_at DESC);' +
    'CREATE TABLE IF NOT EXISTS local_memo_chunk_vectors (' +
      'owner_id TEXT NOT NULL,' +
      'memo_id TEXT NOT NULL,' +
      'chunk_id TEXT NOT NULL,' +
      'chunk_index INTEGER NOT NULL,' +
      'chunk_text TEXT NOT NULL,' +
      'start_index INTEGER NOT NULL,' +
      'end_index INTEGER NOT NULL,' +
      'source_content_hash TEXT NOT NULL,' +
      'embedding_signature TEXT NOT NULL,' +
      'vector BLOB NOT NULL CHECK(length(vector) = 4096),' +
      'PRIMARY KEY (owner_id, memo_id, chunk_id)' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_local_memo_chunk_vectors_owner_signature ' +
      'ON local_memo_chunk_vectors (owner_id, embedding_signature);' +
    'CREATE TABLE IF NOT EXISTS local_memo_vector_state (' +
      'owner_id TEXT NOT NULL,' +
      'memo_id TEXT NOT NULL,' +
      'source_content_hash TEXT NOT NULL,' +
      'embedding_signature TEXT NOT NULL,' +
      'chunk_count INTEGER NOT NULL,' +
      'indexed_at TEXT NOT NULL,' +
      'PRIMARY KEY (owner_id, memo_id)' +
    ');' +
    'CREATE TABLE IF NOT EXISTS local_inbox_vectors (' +
      'owner_id TEXT NOT NULL,' +
      'inbox_session_id TEXT NOT NULL,' +
      'source_content_hash TEXT NOT NULL,' +
      'embedding_signature TEXT NOT NULL,' +
      'vector BLOB NOT NULL CHECK(length(vector) = 4096),' +
      'indexed_at TEXT NOT NULL,' +
      'PRIMARY KEY (owner_id, inbox_session_id)' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_local_inbox_vectors_owner_signature ' +
      'ON local_inbox_vectors (owner_id, embedding_signature);'
  );

  const transaction = operation => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const vectorRowsByOwner = new Map();
  const inboxVectorRowsByOwner = new Map();

  // A model, quantization, or implementation change creates a different vector
  // space. Old rows must be removed, not mixed with vectors from this build.
  transaction(() => {
    db.prepare('DELETE FROM local_memo_chunk_vectors WHERE embedding_signature != ?')
      .run(workerData.embeddingSignature);
    db.prepare('DELETE FROM local_memo_vector_state WHERE embedding_signature != ?')
      .run(workerData.embeddingSignature);
    db.prepare('DELETE FROM local_inbox_vectors WHERE embedding_signature != ?')
      .run(workerData.embeddingSignature);
  });

  const deleteMemoVectors = (ownerId, memoId) => {
    vectorRowsByOwner.delete(ownerId);
    db.prepare('DELETE FROM local_memo_chunk_vectors WHERE owner_id = ? AND memo_id = ?')
      .run(ownerId, memoId);
    db.prepare('DELETE FROM local_memo_vector_state WHERE owner_id = ? AND memo_id = ?')
      .run(ownerId, memoId);
  };

  const deleteInboxVector = (ownerId, inboxSessionId) => {
    inboxVectorRowsByOwner.delete(ownerId);
    db.prepare(
      'DELETE FROM local_inbox_vectors WHERE owner_id = ? AND inbox_session_id = ?'
    ).run(ownerId, inboxSessionId);
  };

  const hashText = text => {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const contentHashForRecord = record => {
    if (typeof record.content_hash === 'string' && record.content_hash) {
      return record.content_hash;
    }
    return typeof record.content === 'string' ? hashText(record.content) : null;
  };

  const inboxTextForRecord = record => {
    const values = [
      record.title,
      record.summary,
      record.summarySearchText,
      record.userNote,
      record.selectedText,
      ...(Array.isArray(record.keywords) ? record.keywords : []),
    ];
    const seen = new Set();
    const parts = [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const text = value.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      parts.push(text);
    }
    return parts.join('\n').slice(0, 4000);
  };

  const inboxContentHashForRecord = record => {
    const text = inboxTextForRecord(record);
    return text ? hashText(text) : null;
  };

  const invalidateMemoVectors = (ownerId, memoId, contentHash, isArchived) => {
    if (isArchived) {
      deleteMemoVectors(ownerId, memoId);
      return;
    }
    const state = db.prepare(
      'SELECT source_content_hash FROM local_memo_vector_state WHERE owner_id = ? AND memo_id = ?'
    ).get(ownerId, memoId);
    if (
      state &&
      (typeof contentHash !== 'string' ||
        String(state.source_content_hash) !== contentHash)
    ) {
      // Keep the old rows as a private reuse pool while hiding them from
      // search (search joins through the state row). The next index pass can
      // reuse exact chunk_text matches even when positional chunk ids moved.
      vectorRowsByOwner.delete(ownerId);
      db.prepare(
        'DELETE FROM local_memo_vector_state WHERE owner_id = ? AND memo_id = ?'
      ).run(ownerId, memoId);
    }
  };

  const cleanupMemoVectors = ownerId => {
    const states = db.prepare(
      'SELECT memo_id, source_content_hash FROM local_memo_vector_state WHERE owner_id = ?'
    ).all(ownerId);
    const recordStatement = db.prepare(
      "SELECT payload_json, is_archived FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    );
    for (const state of states) {
      const memoId = String(state.memo_id);
      const row = recordStatement.get(ownerId, memoId);
      if (!row || Number(row.is_archived) !== 0) {
        deleteMemoVectors(ownerId, memoId);
        continue;
      }
      let record;
      try {
        record = JSON.parse(String(row.payload_json));
      } catch {
        deleteMemoVectors(ownerId, memoId);
        continue;
      }
      if (
        contentHashForRecord(record) !== String(state.source_content_hash)
      ) {
        deleteMemoVectors(ownerId, memoId);
      }
    }
  };

  const cleanupInboxVectors = ownerId => {
    const vectors = db.prepare(
      'SELECT inbox_session_id, source_content_hash FROM local_inbox_vectors ' +
      'WHERE owner_id = ?'
    ).all(ownerId);
    const recordStatement = db.prepare(
      "SELECT payload_json, is_archived FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'inbox' AND record_id = ?"
    );
    for (const vector of vectors) {
      const inboxSessionId = String(vector.inbox_session_id);
      const row = recordStatement.get(ownerId, inboxSessionId);
      if (!row || Number(row.is_archived) !== 0) {
        deleteInboxVector(ownerId, inboxSessionId);
        continue;
      }
      try {
        const record = JSON.parse(String(row.payload_json));
        if (
          inboxContentHashForRecord(record) !==
          String(vector.source_content_hash)
        ) {
          deleteInboxVector(ownerId, inboxSessionId);
        }
      } catch {
        deleteInboxVector(ownerId, inboxSessionId);
      }
    }
  };

  const upsert = (ownerId, recordType, recordId, record) => {
    const updatedAt = typeof record.updated_at === 'string'
      ? record.updated_at
      : typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
    const syncStatus = typeof record.local_sync_status === 'string'
      ? record.local_sync_status : null;
    const isArchived = record.is_archived === true || syncStatus === 'pending_delete';
    if (recordType === 'memo') {
      invalidateMemoVectors(
        ownerId,
        recordId,
        contentHashForRecord(record),
        isArchived
      );
    } else if (recordType === 'inbox') {
      const vector = db.prepare(
        'SELECT source_content_hash FROM local_inbox_vectors ' +
        'WHERE owner_id = ? AND inbox_session_id = ?'
      ).get(ownerId, recordId);
      if (
        isArchived ||
        (vector &&
          inboxContentHashForRecord(record) !==
            String(vector.source_content_hash))
      ) {
        deleteInboxVector(ownerId, recordId);
      }
    }
    db.prepare('INSERT INTO local_records (owner_id, record_type, record_id, payload_json, sync_status, updated_at, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, record_type, record_id) DO UPDATE SET payload_json = excluded.payload_json, sync_status = excluded.sync_status, updated_at = excluded.updated_at, is_archived = excluded.is_archived').run(ownerId, recordType, recordId, JSON.stringify(record), syncStatus, updatedAt, isArchived ? 1 : 0);
  };
  const list = (ownerId, recordType) => db.prepare('SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = ? ORDER BY updated_at DESC').all(ownerId, recordType).map(row => JSON.parse(String(row.payload_json)));

  const replaceMemoVectors = args => transaction(() => {
    const row = db.prepare(
      "SELECT payload_json, is_archived FROM local_records WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    ).get(args.ownerId, args.memoId);
    if (!row || Number(row.is_archived) !== 0) return { stored: false };

    let record;
    try {
      record = JSON.parse(String(row.payload_json));
    } catch {
      return { stored: false };
    }
    if (
      record.content !== args.expectedContent ||
      contentHashForRecord(record) !== args.sourceContentHash
    ) {
      return { stored: false };
    }

    const reusableVectors = new Map(
      db.prepare(
        'SELECT chunk_text, vector FROM local_memo_chunk_vectors ' +
        'WHERE owner_id = ? AND memo_id = ? AND embedding_signature = ?'
      ).all(
        args.ownerId,
        args.memoId,
        workerData.embeddingSignature
      ).map(row => [String(row.chunk_text), row.vector])
    );
    deleteMemoVectors(args.ownerId, args.memoId);
    const insert = db.prepare(
      'INSERT INTO local_memo_chunk_vectors ' +
      '(owner_id, memo_id, chunk_id, chunk_index, chunk_text, start_index, end_index, source_content_hash, embedding_signature, vector) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const chunk of args.chunks) {
      const vector = chunk.vector
        ? Buffer.from(
            chunk.vector.buffer,
            chunk.vector.byteOffset,
            chunk.vector.byteLength
          )
        : reusableVectors.get(chunk.text);
      if (!(vector instanceof Uint8Array) || vector.byteLength !== 4096) {
        throw new Error('Reusable memo vector is missing.');
      }
      insert.run(
        args.ownerId,
        args.memoId,
        chunk.id,
        chunk.index,
        chunk.text,
        chunk.start,
        chunk.end,
        args.sourceContentHash,
        workerData.embeddingSignature,
        vector
      );
    }
    db.prepare(
      'INSERT INTO local_memo_vector_state ' +
      '(owner_id, memo_id, source_content_hash, embedding_signature, chunk_count, indexed_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(owner_id, memo_id) DO UPDATE SET ' +
      'source_content_hash = excluded.source_content_hash, ' +
      'embedding_signature = excluded.embedding_signature, ' +
      'chunk_count = excluded.chunk_count, indexed_at = excluded.indexed_at'
    ).run(
      args.ownerId,
      args.memoId,
      args.sourceContentHash,
      workerData.embeddingSignature,
      args.chunks.length,
      new Date().toISOString()
    );
    return { stored: true };
  });

  const memoVectorState = ownerId => {
    return db.prepare(
      'SELECT memo_id, source_content_hash, chunk_count ' +
      'FROM local_memo_vector_state ' +
      'WHERE owner_id = ? AND embedding_signature = ? ORDER BY memo_id'
    ).all(ownerId, workerData.embeddingSignature).map(row => ({
      memoId: String(row.memo_id),
      sourceContentHash: String(row.source_content_hash),
      chunkCount: Number(row.chunk_count),
    }));
  };

  const memoVectorTexts = (ownerId, memoId) => {
    return db.prepare(
      'SELECT DISTINCT chunk_text FROM local_memo_chunk_vectors ' +
      'WHERE owner_id = ? AND memo_id = ? AND embedding_signature = ?'
    ).all(ownerId, memoId, workerData.embeddingSignature)
      .map(row => String(row.chunk_text));
  };

  const replaceInboxVector = args => transaction(() => {
    const row = db.prepare(
      "SELECT payload_json, is_archived FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'inbox' AND record_id = ?"
    ).get(args.ownerId, args.inboxSessionId);
    if (!row || Number(row.is_archived) !== 0) return { stored: false };

    let record;
    try {
      record = JSON.parse(String(row.payload_json));
    } catch {
      return { stored: false };
    }
    const sourceText = inboxTextForRecord(record);
    if (
      sourceText !== args.expectedSourceText ||
      inboxContentHashForRecord(record) !== args.sourceContentHash
    ) {
      return { stored: false };
    }

    const vector = Buffer.from(
      args.vector.buffer,
      args.vector.byteOffset,
      args.vector.byteLength
    );
    inboxVectorRowsByOwner.delete(args.ownerId);
    db.prepare(
      'INSERT INTO local_inbox_vectors ' +
      '(owner_id, inbox_session_id, source_content_hash, embedding_signature, vector, indexed_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(owner_id, inbox_session_id) DO UPDATE SET ' +
      'source_content_hash = excluded.source_content_hash, ' +
      'embedding_signature = excluded.embedding_signature, ' +
      'vector = excluded.vector, indexed_at = excluded.indexed_at'
    ).run(
      args.ownerId,
      args.inboxSessionId,
      args.sourceContentHash,
      workerData.embeddingSignature,
      vector,
      new Date().toISOString()
    );
    return { stored: true };
  });

  const inboxVectorState = ownerId => {
    return db.prepare(
      'SELECT inbox_session_id, source_content_hash ' +
      'FROM local_inbox_vectors ' +
      'WHERE owner_id = ? AND embedding_signature = ? ' +
      'ORDER BY inbox_session_id'
    ).all(ownerId, workerData.embeddingSignature).map(row => ({
      inboxSessionId: String(row.inbox_session_id),
      sourceContentHash: String(row.source_content_hash),
    }));
  };

  const searchMemoVectors = args => {
    let queryMagnitudeSquared = 0;
    for (const value of args.queryVector) {
      queryMagnitudeSquared += value * value;
    }
    if (queryMagnitudeSquared === 0) return [];

    let rows = vectorRowsByOwner.get(args.ownerId);
    if (!rows) {
      rows = db.prepare(
      'SELECT vectors.memo_id, vectors.chunk_id, vectors.chunk_text, ' +
      'vectors.start_index, vectors.end_index, vectors.source_content_hash, ' +
      'vectors.vector ' +
      'FROM local_memo_chunk_vectors AS vectors ' +
      'INNER JOIN local_memo_vector_state AS state ' +
        'ON state.owner_id = vectors.owner_id ' +
        'AND state.memo_id = vectors.memo_id ' +
        'AND state.source_content_hash = vectors.source_content_hash ' +
        'AND state.embedding_signature = vectors.embedding_signature ' +
      'INNER JOIN local_records AS records ' +
        "ON records.owner_id = vectors.owner_id AND records.record_type = 'memo' " +
        'AND records.record_id = vectors.memo_id AND records.is_archived = 0 ' +
      'WHERE vectors.owner_id = ? AND vectors.embedding_signature = ?'
      ).all(args.ownerId, workerData.embeddingSignature);
      vectorRowsByOwner.set(args.ownerId, rows);
    }

    const queryMagnitude = Math.sqrt(queryMagnitudeSquared);
    const candidates = [];
    for (const row of rows) {
      if (
        args.excludeMemoId !== null &&
        String(row.memo_id) === args.excludeMemoId
      ) {
        continue;
      }
      const bytes = row.vector;
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 4096) continue;
      let vector;
      if (bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0) {
        vector = new Float32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / Float32Array.BYTES_PER_ELEMENT
        );
      } else {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        vector = new Float32Array(copy.buffer);
      }

      let dotProduct = 0;
      let candidateMagnitudeSquared = 0;
      for (let index = 0; index < vector.length; index += 1) {
        dotProduct += args.queryVector[index] * vector[index];
        candidateMagnitudeSquared += vector[index] * vector[index];
      }
      if (candidateMagnitudeSquared === 0) continue;
      const similarity = Math.max(
        -1,
        Math.min(
          1,
          dotProduct / (queryMagnitude * Math.sqrt(candidateMagnitudeSquared))
        )
      );
      if (similarity < args.minimumSimilarity) continue;

      candidates.push({
        chunkId: String(row.chunk_id),
        chunkText: String(row.chunk_text),
        endIndex: Number(row.end_index),
        memoId: String(row.memo_id),
        similarity,
        sourceContentHash: String(row.source_content_hash),
        startIndex: Number(row.start_index),
      });
    }

    candidates.sort(
      (left, right) =>
        right.similarity - left.similarity ||
        left.memoId.localeCompare(right.memoId) ||
        left.chunkId.localeCompare(right.chunkId)
    );

    const recordStatement = db.prepare(
      "SELECT payload_json, updated_at FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'memo' AND record_id = ? AND is_archived = 0"
    );
    const memoCache = new Map();
    const resultMemoIds = new Set();
    const results = [];
    for (const candidate of candidates) {
      if (results.length >= args.limit) break;
      if (resultMemoIds.has(candidate.memoId)) continue;
      let memo = memoCache.get(candidate.memoId);
      if (memo === undefined) {
        const row = recordStatement.get(args.ownerId, candidate.memoId);
        try {
          const record = row ? JSON.parse(String(row.payload_json)) : null;
          memo =
            record &&
            typeof record.content === 'string' &&
            contentHashForRecord(record) === candidate.sourceContentHash
              ? { record, updatedAt: String(row.updated_at) }
              : null;
        } catch {
          memo = null;
        }
        memoCache.set(candidate.memoId, memo);
      }
      if (!memo) continue;
      resultMemoIds.add(candidate.memoId);
      results.push({
        chunkId: candidate.chunkId,
        chunkText: candidate.chunkText,
        endIndex: candidate.endIndex,
        memoContent: memo.record.content,
        memoCreatedAt:
          typeof memo.record.created_at === 'string'
            ? memo.record.created_at
            : null,
        memoId: candidate.memoId,
        memoUpdatedAt:
          typeof memo.record.updated_at === 'string'
            ? memo.record.updated_at
            : memo.updatedAt,
        similarity: candidate.similarity,
        startIndex: candidate.startIndex,
      });
    }
    return results;
  };

  const searchInboxVectors = args => {
    let queryMagnitudeSquared = 0;
    for (const value of args.queryVector) {
      queryMagnitudeSquared += value * value;
    }
    if (queryMagnitudeSquared === 0) return [];

    let rows = inboxVectorRowsByOwner.get(args.ownerId);
    if (!rows) {
      rows = db.prepare(
        'SELECT vectors.inbox_session_id, vectors.source_content_hash, ' +
        'vectors.vector, records.payload_json ' +
        'FROM local_inbox_vectors AS vectors ' +
        'INNER JOIN local_records AS records ' +
          "ON records.owner_id = vectors.owner_id AND records.record_type = 'inbox' " +
          'AND records.record_id = vectors.inbox_session_id AND records.is_archived = 0 ' +
        'WHERE vectors.owner_id = ? AND vectors.embedding_signature = ?'
      ).all(args.ownerId, workerData.embeddingSignature);
      inboxVectorRowsByOwner.set(args.ownerId, rows);
    }

    const queryMagnitude = Math.sqrt(queryMagnitudeSquared);
    const candidates = [];
    for (const row of rows) {
      let record;
      try {
        record = JSON.parse(String(row.payload_json));
      } catch {
        continue;
      }
      if (
        inboxContentHashForRecord(record) !==
        String(row.source_content_hash)
      ) {
        continue;
      }
      const bytes = row.vector;
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 4096) continue;
      let vector;
      if (bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0) {
        vector = new Float32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / Float32Array.BYTES_PER_ELEMENT
        );
      } else {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        vector = new Float32Array(copy.buffer);
      }

      let dotProduct = 0;
      let candidateMagnitudeSquared = 0;
      for (let index = 0; index < vector.length; index += 1) {
        dotProduct += args.queryVector[index] * vector[index];
        candidateMagnitudeSquared += vector[index] * vector[index];
      }
      if (candidateMagnitudeSquared === 0) continue;
      const similarity = Math.max(
        -1,
        Math.min(
          1,
          dotProduct / (queryMagnitude * Math.sqrt(candidateMagnitudeSquared))
        )
      );
      if (similarity < args.minimumSimilarity) continue;
      candidates.push({
        inboxSessionId: String(row.inbox_session_id),
        record,
        similarity,
      });
    }

    candidates.sort(
      (left, right) =>
        right.similarity - left.similarity ||
        left.inboxSessionId.localeCompare(right.inboxSessionId)
    );
    return candidates.slice(0, args.limit).map(candidate => {
      const record = candidate.record;
      const chunkText =
        record.summaryOneLiner ||
        record.summary ||
        record.selectedText ||
        record.userNote ||
        record.description ||
        record.title ||
        '';
      return {
        chunkId: 'inbox-' + candidate.inboxSessionId,
        chunkText: String(chunkText),
        createdAt:
          typeof record.createdAt === 'string' ? record.createdAt : null,
        inboxSessionId: candidate.inboxSessionId,
        similarity: candidate.similarity,
        sourceLabel:
          typeof record.channelTitle === 'string'
            ? record.channelTitle
            : typeof record.domain === 'string' ? record.domain : null,
        sourceType:
          typeof record.sourceType === 'string' ? record.sourceType : null,
        sourceUrl:
          typeof record.canonicalUrl === 'string'
            ? record.canonicalUrl
            : typeof record.originalUrl === 'string'
              ? record.originalUrl
              : null,
        thumbnailUrl:
          typeof record.thumbnailUrl === 'string'
            ? record.thumbnailUrl
            : null,
        title: typeof record.title === 'string' ? record.title : null,
      };
    });
  };

  parentPort.on('message', message => {
    const { id, operation, args } = message;
    try {
      let result;
      if (operation === 'list') {
        result = list(args.ownerId, args.recordType);
      } else if (operation === 'upsert') {
        transaction(() => {
          upsert(args.ownerId, args.recordType, args.recordId, args.record);
        });
      } else if (operation === 'delete') {
        transaction(() => {
          db.prepare('DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND record_id = ?').run(args.ownerId, args.recordType, args.recordId);
          if (args.recordType === 'memo') deleteMemoVectors(args.ownerId, args.recordId);
          if (args.recordType === 'inbox') deleteInboxVector(args.ownerId, args.recordId);
        });
      } else if (operation === 'replace') {
        result = transaction(() => {
          db.prepare("DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND (sync_status IS NULL OR sync_status = 'synced')").run(args.ownerId, args.recordType);
          for (const value of args.values) upsert(args.ownerId, args.recordType, value.id, { ...value, local_sync_status: 'synced' });
          if (args.recordType === 'memo') cleanupMemoVectors(args.ownerId);
          if (args.recordType === 'inbox') cleanupInboxVectors(args.ownerId);
          return list(args.ownerId, args.recordType);
        });
      } else if (operation === 'migrate') {
        transaction(() => {
          for (const [recordType, values] of Object.entries(args.groups)) {
            if (!Array.isArray(values)) continue;
            for (const record of values) {
              if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) continue;
              const exists = db.prepare('SELECT 1 FROM local_records WHERE owner_id = ? AND record_type = ? AND record_id = ?').get(args.ownerId, recordType, record.id);
              if (!exists) upsert(args.ownerId, recordType, record.id, record);
            }
          }
          cleanupMemoVectors(args.ownerId);
          cleanupInboxVectors(args.ownerId);
        });
      } else if (operation === 'memo-vector-state') {
        result = memoVectorState(args.ownerId);
      } else if (operation === 'memo-vector-texts') {
        result = memoVectorTexts(args.ownerId, args.memoId);
      } else if (operation === 'replace-memo-vectors') {
        result = replaceMemoVectors(args);
      } else if (operation === 'delete-memo-vectors') {
        transaction(() => {
          deleteMemoVectors(args.ownerId, args.memoId);
        });
      } else if (operation === 'search-memo-vectors') {
        result = searchMemoVectors(args);
      } else if (operation === 'inbox-vector-state') {
        result = inboxVectorState(args.ownerId);
      } else if (operation === 'replace-inbox-vector') {
        result = replaceInboxVector(args);
      } else if (operation === 'delete-inbox-vector') {
        transaction(() => {
          deleteInboxVector(args.ownerId, args.inboxSessionId);
        });
      } else if (operation === 'search-inbox-vectors') {
        result = searchInboxVectors(args);
      } else if (operation === 'checkpoint') {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } else {
        throw new Error('Unsupported local database operation.');
      }
      parentPort.postMessage({ id, result });
    } catch (error) {
      parentPort.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  });
`;

const settle = (id: number, error: Error | null, result?: unknown) => {
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  clearTimeout(request.timer);
  if (error) request.reject(error);
  else request.resolve(result);
};

const rejectAllPending = (error: Error) => {
  for (const id of [...pending.keys()]) settle(id, error);
};

const getWorker = () => {
  if (worker) return worker;
  const nextWorker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: {
      databasePath: getDatabasePath(),
      embeddingSignature: EMBEDDING_MODEL_ID,
    },
  });
  nextWorker.on('message', (message: { error?: string; id: number; result?: unknown }) => {
    settle(message.id, message.error ? new Error(message.error) : null, message.result);
  });
  nextWorker.on('error', error => {
    rejectAllPending(error instanceof Error ? error : new Error(String(error)));
    if (worker === nextWorker) worker = null;
  });
  // Without an exit handler, a crashed/terminated worker leaves callers'
  // promises pending forever. Reject them so writes surface failures instead.
  nextWorker.on('exit', code => {
    rejectAllPending(new Error(`Local database worker exited (code ${code}).`));
    if (worker === nextWorker) worker = null;
  });
  worker = nextWorker;
  return nextWorker;
};

// On quit, give in-flight writes a bounded window to drain before terminating
// the worker, so "saved locally" is trustworthy. A deadline forces exit if a
// write hangs.
let quitting = false;
app.on('before-quit', event => {
  if (quitting || pending.size === 0 || !worker) {
    void worker?.terminate();
    return;
  }
  quitting = true;
  event.preventDefault();
  const finish = () => {
    clearInterval(poll);
    clearTimeout(deadline);
    void worker?.terminate();
    app.quit();
  };
  const poll = setInterval(() => {
    if (pending.size === 0) finish();
  }, 50);
  const deadline = setTimeout(finish, QUIT_DRAIN_DEADLINE_MS);
});

const run = (operation: string, args: Record<string, unknown>) =>
  new Promise<unknown>((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => {
      settle(id, new Error(`Local database operation timed out: ${operation}`));
    }, PENDING_TIMEOUT_MS);
    pending.set(id, { reject, resolve, timer });
    getWorker().postMessage({ args, id, operation });
  });

const stopWorker = async () => {
  if (!worker) return;
  const activeWorker = worker;
  worker = null;
  await activeWorker.terminate();
};

const getStorageInfo = async () => {
  const databasePath = getDatabasePath();
  const size = await fs.promises
    .stat(databasePath)
    .then(stat => stat.size)
    .catch(() => 0);
  return { databasePath, size };
};

const assertTrustedSender = (event: Electron.IpcMainInvokeEvent) => {
  const url = event.senderFrame?.url ?? event.sender?.getURL?.() ?? '';
  if (!url && !app.isPackaged) return;
  const trustedProduction = url.startsWith('subnota-app://bundle/');
  const trustedDevelopment = !app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url);
  if (!trustedProduction && !trustedDevelopment) throw new Error('Untrusted IPC sender.');
};

const normalizedOwner = (ownerId: unknown) => {
  if (ownerId === null || ownerId === undefined || ownerId === 'guest') return 'guest';
  if (typeof ownerId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error('Invalid local database owner.');
  }
  return ownerId;
};
const normalizedType = (recordType: unknown) => {
  if (typeof recordType !== 'string' || !RECORD_TYPES.has(recordType)) {
    throw new Error('Unsupported local record type.');
  }
  return recordType;
};
const normalizedRecord = (record: unknown) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Invalid local record.');
  }
  return record as Record<string, unknown>;
};
const normalizedMemoId = (memoId: unknown) => {
  if (typeof memoId !== 'string' || !memoId) {
    throw new Error('Invalid memo id.');
  }
  return memoId;
};
const normalizedContentHash = (contentHash: unknown) => {
  if (typeof contentHash !== 'string' || !contentHash) {
    throw new Error('Invalid memo content hash.');
  }
  return contentHash;
};
const normalizedMemoVectorChunks = (chunks: unknown) => {
  if (!Array.isArray(chunks)) {
    throw new Error('Invalid memo vector chunks.');
  }
  return chunks.map(value => {
    const chunk = normalizedRecord(value);
    if (
      typeof chunk.id !== 'string' ||
      !chunk.id ||
      !Number.isInteger(chunk.index) ||
      Number(chunk.index) < 0 ||
      typeof chunk.text !== 'string' ||
      !Number.isInteger(chunk.start) ||
      Number(chunk.start) < 0 ||
      !Number.isInteger(chunk.end) ||
      Number(chunk.end) < Number(chunk.start) ||
      (chunk.vector !== null &&
        (!Array.isArray(chunk.vector) ||
          chunk.vector.length !== EMBEDDING_DIMENSIONS ||
          chunk.vector.some(
            value => typeof value !== 'number' || !Number.isFinite(value),
          )))
    ) {
      throw new Error('Invalid memo vector chunk.');
    }
    const vector =
      chunk.vector === null
        ? null
        : Float32Array.from(chunk.vector as number[]);
    if (vector?.some(value => !Number.isFinite(value))) {
      throw new Error('Invalid memo vector chunk.');
    }
    return {
      end: Number(chunk.end),
      id: chunk.id,
      index: Number(chunk.index),
      start: Number(chunk.start),
      text: chunk.text,
      vector,
    };
  });
};
const normalizedMemoSearchVector = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    value.length !== EMBEDDING_DIMENSIONS ||
    value.some(item => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    throw new Error('Invalid memo search vector.');
  }
  const vector = Float32Array.from(value as number[]);
  if (vector.some(item => !Number.isFinite(item))) {
    throw new Error('Invalid memo search vector.');
  }
  return vector;
};
const normalizedExcludedMemoId = (memoId: unknown) => {
  if (memoId !== null && typeof memoId !== 'string') {
    throw new Error('Invalid excluded memo id.');
  }
  return memoId as string | null;
};
const normalizedMemoSearchLimit = (limit: unknown) => {
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 10) {
    throw new Error('Invalid memo search limit.');
  }
  return Number(limit);
};
const normalizedMinimumSimilarity = (minimumSimilarity: unknown) => {
  if (
    typeof minimumSimilarity !== 'number' ||
    !Number.isFinite(minimumSimilarity) ||
    minimumSimilarity < -1 ||
    minimumSimilarity > 1
  ) {
    throw new Error('Invalid minimum similarity.');
  }
  return minimumSimilarity;
};
const ownerFor = (event: Electron.IpcMainInvokeEvent) =>
  ownersByWebContents.get(event.sender.id) ?? 'guest';
const ensureOwnerCleanupListener = (sender: Electron.WebContents) => {
  const senderId = sender.id;
  if (ownerCleanupListenersByWebContents.has(senderId)) return;
  ownerCleanupListenersByWebContents.add(senderId);
  sender.once('destroyed', () => {
    ownersByWebContents.delete(senderId);
    ownerCleanupListenersByWebContents.delete(senderId);
  });
};
const ownerForRequest = (event: Electron.IpcMainInvokeEvent, ownerId: unknown) => {
  const requestedOwner = normalizedOwner(ownerId);
  if (ownerFor(event) !== requestedOwner) {
    throw new Error('Local database owner does not match this window.');
  }
  return requestedOwner;
};

ipcMain.handle('local-db:set-owner', (event, ownerId: unknown) => {
  assertTrustedSender(event);
  ownersByWebContents.set(event.sender.id, normalizedOwner(ownerId));
  ensureOwnerCleanupListener(event.sender);
});
ipcMain.handle('local-db:list', (event, ownerId: unknown, recordType: unknown) => {
  assertTrustedSender(event);
  return run('list', { ownerId: ownerForRequest(event, ownerId), recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:upsert', (event, ownerId: unknown, recordType: unknown, recordId: unknown, value: unknown) => {
  assertTrustedSender(event);
  if (typeof recordId !== 'string' || !recordId) throw new Error('Invalid record id.');
  return run('upsert', { ownerId: ownerForRequest(event, ownerId), recordId, record: normalizedRecord(value), recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:delete', (event, ownerId: unknown, recordType: unknown, recordId: unknown) => {
  assertTrustedSender(event);
  if (typeof recordId !== 'string' || !recordId) throw new Error('Invalid record id.');
  return run('delete', { ownerId: ownerForRequest(event, ownerId), recordId, recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:replace-synced', (event, ownerId: unknown, recordType: unknown, values: unknown) => {
  assertTrustedSender(event);
  if (!Array.isArray(values)) throw new Error('Invalid local record collection.');
  const records = values.map(normalizedRecord);
  if (records.some(record => typeof record.id !== 'string' || !record.id)) throw new Error('Invalid record id.');
  return run('replace', { ownerId: ownerForRequest(event, ownerId), recordType: normalizedType(recordType), values: records });
});
ipcMain.handle('local-db:migrate', (event, ownerId: unknown, datasets: unknown) => {
  assertTrustedSender(event);
  const source = normalizedRecord(datasets);
  return run('migrate', {
    groups: { calendar: source.calendarBlocks, inbox: source.inboxItems, memo: source.memos },
    ownerId: ownerForRequest(event, ownerId),
  });
});
ipcMain.handle('local-db:memo-vector-state', (event, ownerId: unknown) => {
  assertTrustedSender(event);
  return run('memo-vector-state', {
    ownerId: ownerForRequest(event, ownerId),
  });
});
ipcMain.handle(
  'local-db:memo-vector-texts',
  (event, ownerId: unknown, memoId: unknown) => {
    assertTrustedSender(event);
    return run('memo-vector-texts', {
      memoId: normalizedMemoId(memoId),
      ownerId: ownerForRequest(event, ownerId),
    });
  },
);
ipcMain.handle(
  'local-db:replace-memo-vectors',
  (
    event,
    ownerId: unknown,
    memoId: unknown,
    sourceContentHash: unknown,
    expectedContent: unknown,
    chunks: unknown,
  ) => {
    assertTrustedSender(event);
    if (typeof expectedContent !== 'string') {
      throw new Error('Invalid memo content.');
    }
    return run('replace-memo-vectors', {
      chunks: normalizedMemoVectorChunks(chunks),
      expectedContent,
      memoId: normalizedMemoId(memoId),
      ownerId: ownerForRequest(event, ownerId),
      sourceContentHash: normalizedContentHash(sourceContentHash),
    });
  },
);
ipcMain.handle(
  'local-db:delete-memo-vectors',
  (event, ownerId: unknown, memoId: unknown) => {
    assertTrustedSender(event);
    return run('delete-memo-vectors', {
      memoId: normalizedMemoId(memoId),
      ownerId: ownerForRequest(event, ownerId),
    });
  },
);
ipcMain.handle(
  'local-db:search-memo-vectors',
  (
    event,
    ownerId: unknown,
    queryVector: unknown,
    excludeMemoId: unknown,
    limit: unknown,
    minimumSimilarity: unknown,
  ) => {
    assertTrustedSender(event);
    const normalizedOwnerId = ownerForRequest(event, ownerId);
    return run('search-memo-vectors', {
      excludeMemoId: normalizedExcludedMemoId(excludeMemoId),
      limit: normalizedMemoSearchLimit(limit),
      minimumSimilarity: normalizedMinimumSimilarity(minimumSimilarity),
      ownerId: normalizedOwnerId,
      queryVector: normalizedMemoSearchVector(queryVector),
    });
  },
);
ipcMain.handle('local-db:inbox-vector-state', (event, ownerId: unknown) => {
  assertTrustedSender(event);
  return run('inbox-vector-state', {
    ownerId: ownerForRequest(event, ownerId),
  });
});
ipcMain.handle(
  'local-db:replace-inbox-vector',
  (
    event,
    ownerId: unknown,
    inboxSessionId: unknown,
    sourceContentHash: unknown,
    expectedSourceText: unknown,
    vector: unknown,
  ) => {
    assertTrustedSender(event);
    if (typeof expectedSourceText !== 'string' || !expectedSourceText) {
      throw new Error('Invalid inbox embedding text.');
    }
    return run('replace-inbox-vector', {
      expectedSourceText,
      inboxSessionId: normalizedMemoId(inboxSessionId),
      ownerId: ownerForRequest(event, ownerId),
      sourceContentHash: normalizedContentHash(sourceContentHash),
      vector: normalizedMemoSearchVector(vector),
    });
  },
);
ipcMain.handle(
  'local-db:delete-inbox-vector',
  (event, ownerId: unknown, inboxSessionId: unknown) => {
    assertTrustedSender(event);
    return run('delete-inbox-vector', {
      inboxSessionId: normalizedMemoId(inboxSessionId),
      ownerId: ownerForRequest(event, ownerId),
    });
  },
);
ipcMain.handle(
  'local-db:search-inbox-vectors',
  (
    event,
    ownerId: unknown,
    queryVector: unknown,
    limit: unknown,
    minimumSimilarity: unknown,
  ) => {
    assertTrustedSender(event);
    return run('search-inbox-vectors', {
      limit: normalizedMemoSearchLimit(limit),
      minimumSimilarity: normalizedMinimumSimilarity(minimumSimilarity),
      ownerId: ownerForRequest(event, ownerId),
      queryVector: normalizedMemoSearchVector(queryVector),
    });
  },
);

ipcMain.handle('local-db:storage-info', event => {
  assertTrustedSender(event);
  return getStorageInfo();
});

ipcMain.handle('local-db:open-storage', async event => {
  assertTrustedSender(event);
  await shell.showItemInFolder(getDatabasePath());
});

ipcMain.handle('local-db:choose-storage', async event => {
  assertTrustedSender(event);
  const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Subnota 로컬 저장소 위치 선택',
  });
  const directory = result.filePaths[0];
  if (result.canceled || !directory) return null;

  const currentPath = getDatabasePath();
  const nextPath = path.join(directory, 'subnota-local.sqlite3');
  if (currentPath === nextPath) return getStorageInfo();
  if (fs.existsSync(nextPath)) {
    throw new Error('선택한 폴더에 이미 Subnota 데이터베이스가 있습니다.');
  }

  if (worker) await run('checkpoint', {});
  await stopWorker();
  await fs.promises.mkdir(directory, { recursive: true });
  if (fs.existsSync(currentPath)) {
    await fs.promises.copyFile(currentPath, nextPath);
  }
  saveStorageDirectory(directory);
  const info = await getStorageInfo();
  setImmediate(() => event.sender.reload());
  return info;
});

ipcMain.handle('local-db:backup', async event => {
  assertTrustedSender(event);
  const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const result = await dialog.showSaveDialog(window, {
    defaultPath: `Subnota-${new Date().toISOString().slice(0, 10)}.sqlite3`,
    filters: [{ name: 'Subnota Backup', extensions: ['sqlite3'] }],
    title: 'Subnota 전체 백업',
  });
  if (result.canceled || !result.filePath) return null;
  if (worker) await run('checkpoint', {});
  await fs.promises.copyFile(getDatabasePath(), result.filePath);
  return result.filePath;
});

ipcMain.handle('local-db:restore', async (event, backupPath: unknown) => {
  assertTrustedSender(event);
  if (typeof backupPath !== 'string' || !path.isAbsolute(backupPath)) {
    throw new Error('올바르지 않은 백업 파일입니다.');
  }
  const header = Buffer.alloc(16);
  const backupFile = await fs.promises.open(backupPath, 'r');
  await backupFile.read(header, 0, 16, 0);
  await backupFile.close();
  if (header.toString('utf8') !== 'SQLite format 3\u0000') {
    throw new Error('Subnota SQLite 백업 파일이 아닙니다.');
  }
  if (worker) await run('checkpoint', {});
  await stopWorker();
  await fs.promises.copyFile(backupPath, getDatabasePath());
  setImmediate(() => event.sender.reload());
});

ipcMain.handle(
  'local-db:export-json',
  async (event, name: unknown, value: unknown) => {
    assertTrustedSender(event);
    if (typeof name !== 'string' || !/^[a-z-]+$/.test(name)) {
      throw new Error('올바르지 않은 내보내기 이름입니다.');
    }
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `${name}-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      title: 'JSON 데이터 내보내기',
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(
      result.filePath,
      JSON.stringify(value, null, 2),
      'utf8',
    );
    return result.filePath;
  },
);

ipcMain.handle(
  'local-db:export-markdown',
  async (event, name: unknown, content: unknown) => {
    assertTrustedSender(event);
    if (typeof name !== 'string' || typeof content !== 'string') {
      throw new Error('올바르지 않은 내보내기 요청입니다.');
    }
    const safeName =
      name.replace(/[\\/:*?"<>|\n\r]/g, ' ').trim().slice(0, 60) || '노트';
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `${safeName}.md`,
      filters: [{ extensions: ['md'], name: 'Markdown' }],
      title: 'Markdown 내보내기',
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  },
);
