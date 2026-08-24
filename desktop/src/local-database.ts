import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { EMBEDDING_MODEL_ID } from './local-embedding';
import { getDataDirectory, getStorageRoot } from './app-storage';

const RECORD_TYPES = new Set([
  'memo',
  'calendar',
  'inbox',
  'activity_completion',
  'daily_completion',
  'tree',
  'memo_recovery',
  // 서버 배치 결과의 읽기 전용 캐시 (local-first 즉시 표시용).
  'schedule_inbox',
  'schedule_inbox_action',
  'topic_map',
]);
const PENDING_TIMEOUT_MS = 10_000;
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
type DatabaseExclusiveOperation = 'finalization' | 'maintenance';
type RendererWriteGuardLease = {
  release: (cancelled: boolean) => void;
};
type LocalDatabaseMaintenanceHooks = {
  acquireRendererWriteGuard: () => Promise<RendererWriteGuardLease | null>;
};
let databaseExclusiveOperation: DatabaseExclusiveOperation | null = null;
let databaseMaintenanceFenceActive = false;
let localDatabaseMaintenanceHooks: LocalDatabaseMaintenanceHooks | null = null;
const STORAGE_CONFIG_FILE = 'local-storage.json';

export const configureLocalDatabaseMaintenanceHooks = (
  hooks: LocalDatabaseMaintenanceHooks | null,
) => {
  localDatabaseMaintenanceHooks = hooks;
};

const getStorageConfigPath = () =>
  path.join(getDataDirectory(), STORAGE_CONFIG_FILE);

const getLegacyStorageConfigPath = () =>
  path.join(getStorageRoot(), STORAGE_CONFIG_FILE);

const readStorageConfig = () => {
  for (const configPath of [getStorageConfigPath(), getLegacyStorageConfigPath()]) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        directory?: string;
      };
    } catch {
      // Try the next layout location.
    }
  }
  return {};
};

const getDatabasePath = () => {
  const value = readStorageConfig();
  if (value.directory && path.isAbsolute(value.directory)) {
    return path.join(value.directory, 'subnota-local.sqlite3');
  }

  const organizedPath = path.join(
    getDataDirectory(),
    'subnota-local.sqlite3',
  );
  const legacyPath = path.join(
    getStorageRoot(),
    'subnota-local.sqlite3',
  );
  return fs.existsSync(organizedPath) || !fs.existsSync(legacyPath)
    ? organizedPath
    : legacyPath;
};

const saveStorageDirectory = (directory: string) => {
  fs.mkdirSync(getDataDirectory(), { recursive: true });
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

  const clearOwner = ownerId => {
    vectorRowsByOwner.delete(ownerId);
    inboxVectorRowsByOwner.delete(ownerId);
    db.prepare('DELETE FROM local_records WHERE owner_id = ?').run(ownerId);
    db.prepare('DELETE FROM local_memo_chunk_vectors WHERE owner_id = ?').run(ownerId);
    db.prepare('DELETE FROM local_memo_vector_state WHERE owner_id = ?').run(ownerId);
    db.prepare('DELETE FROM local_inbox_vectors WHERE owner_id = ?').run(ownerId);
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

  const memoRecordWithPreservedSyncBase = (ownerId, recordId, record) => {
    if (
      record.local_sync_status !== 'pending' &&
      record.local_sync_status !== 'failed'
    ) {
      return record;
    }
    const row = db.prepare(
      "SELECT payload_json FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    ).get(ownerId, recordId);
    if (!row) return record;
    try {
      const existing = JSON.parse(String(row.payload_json));
      const hasAcknowledgedBase =
        typeof existing.synced_content === 'string' ||
        typeof existing.synced_content_hash === 'string';
      return hasAcknowledgedBase
        ? {
            ...record,
            synced_content: existing.synced_content ?? null,
            synced_content_hash: existing.synced_content_hash ?? null,
          }
        : record;
    } catch {
      return record;
    }
  };

  const upsert = (
    ownerId,
    recordType,
    recordId,
    record,
    preserveExistingMemoSyncBase = true
  ) => {
    const storedRecord =
      recordType === 'memo' && preserveExistingMemoSyncBase
        ? memoRecordWithPreservedSyncBase(ownerId, recordId, record)
        : record;
    const updatedAt = typeof storedRecord.updated_at === 'string'
      ? storedRecord.updated_at
      : typeof storedRecord.createdAt === 'string' ? storedRecord.createdAt : new Date().toISOString();
    const syncStatus = typeof storedRecord.local_sync_status === 'string'
      ? storedRecord.local_sync_status : null;
    const isArchived = storedRecord.is_archived === true || syncStatus === 'pending_delete';
    if (recordType === 'memo') {
      invalidateMemoVectors(
        ownerId,
        recordId,
        contentHashForRecord(storedRecord),
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
          inboxContentHashForRecord(storedRecord) !==
            String(vector.source_content_hash))
      ) {
        deleteInboxVector(ownerId, recordId);
      }
    }
    db.prepare('INSERT INTO local_records (owner_id, record_type, record_id, payload_json, sync_status, updated_at, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, record_type, record_id) DO UPDATE SET payload_json = excluded.payload_json, sync_status = excluded.sync_status, updated_at = excluded.updated_at, is_archived = excluded.is_archived').run(ownerId, recordType, recordId, JSON.stringify(storedRecord), syncStatus, updatedAt, isArchived ? 1 : 0);
  };
  const list = (ownerId, recordType) => db.prepare('SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = ? ORDER BY updated_at DESC').all(ownerId, recordType).map(row => JSON.parse(String(row.payload_json)));

  const patchMemoSyncBase = (ownerId, memoId, syncedContent, syncedContentHash) => {
    const row = db.prepare(
      "SELECT payload_json FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    ).get(ownerId, memoId);
    if (!row) return null;
    const record = JSON.parse(String(row.payload_json));
    const patched = {
      ...record,
      synced_content: syncedContent,
      synced_content_hash: syncedContentHash,
    };
    db.prepare(
      "UPDATE local_records SET payload_json = ? " +
      "WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    ).run(JSON.stringify(patched), ownerId, memoId);
    return patched;
  };

  const applyMemoSyncResult = (
    ownerId,
    memoId,
    expectedLocalContent,
    record
  ) => {
    const row = db.prepare(
      "SELECT payload_json FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    ).get(ownerId, memoId);
    if (!row) return false;
    let current;
    try {
      current = JSON.parse(String(row.payload_json));
    } catch {
      return false;
    }
    if (current.content !== expectedLocalContent) return false;
    // The caller supplies the canonical server content and its acknowledged
    // base as one record. Bypass normal pending-base preservation so both move
    // atomically, but only if no newer local edit won the compare step.
    upsert(ownerId, 'memo', memoId, record, false);
    return true;
  };

  const restoreMemoSnapshotAfterPull = (ownerId, memoId, snapshot) => {
    let record = snapshot;
    const row = db.prepare(
      "SELECT payload_json, sync_status FROM local_records " +
      "WHERE owner_id = ? AND record_type = 'memo' AND record_id = ?"
    ).get(ownerId, memoId);
    if (
      row &&
      row.sync_status !== null &&
      String(row.sync_status) !== 'synced'
    ) {
      try {
        const newerLocalRecord = JSON.parse(String(row.payload_json));
        record = {
          ...newerLocalRecord,
          synced_content: snapshot.synced_content ?? null,
          synced_content_hash: snapshot.synced_content_hash ?? null,
        };
      } catch {
        // Replace an unreadable row with the renderer's known-good snapshot.
      }
    }
    upsert(ownerId, 'memo', memoId, record, false);
  };

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
      } else if (operation === 'patch-memo-sync-base') {
        result = transaction(() =>
          patchMemoSyncBase(
            args.ownerId,
            args.memoId,
            args.syncedContent,
            args.syncedContentHash
          )
        );
      } else if (operation === 'apply-memo-sync-result') {
        result = transaction(() =>
          applyMemoSyncResult(
            args.ownerId,
            args.memoId,
            args.expectedLocalContent,
            args.record
          )
        );
      } else if (operation === 'restore-memo-snapshot-after-pull') {
        transaction(() => {
          // This operation repairs the narrow race where a memo becomes a live
          // editor owner after a remote replacement was already dispatched.
          // The renderer snapshot includes the exact pre-pull sync base, so the
          // normal pending-write base preservation must not substitute the
          // remote value that was just installed.
          restoreMemoSnapshotAfterPull(
            args.ownerId,
            args.memoId,
            args.record
          );
        });
      } else if (operation === 'delete') {
        transaction(() => {
          db.prepare('DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND record_id = ?').run(args.ownerId, args.recordType, args.recordId);
          if (args.recordType === 'memo') deleteMemoVectors(args.ownerId, args.recordId);
          if (args.recordType === 'inbox') deleteInboxVector(args.ownerId, args.recordId);
        });
      } else if (operation === 'clear-owner') {
        transaction(() => clearOwner(args.ownerId));
      } else if (operation === 'delete-inbox-pending-if-not-deleted') {
        result = transaction(() => {
          const row = db.prepare(
            "SELECT sync_status FROM local_records " +
            "WHERE owner_id = ? AND record_type = 'inbox' AND record_id = ?"
          ).get(args.ownerId, args.recordId);
          if (row && String(row.sync_status) === 'pending_delete') {
            return false;
          }
          db.prepare(
            "DELETE FROM local_records " +
            "WHERE owner_id = ? AND record_type = 'inbox' AND record_id = ?"
          ).run(args.ownerId, args.recordId);
          deleteInboxVector(args.ownerId, args.recordId);
          return true;
        });
      } else if (operation === 'replace') {
        result = transaction(() => {
          const explicitlyPreserved = new Set(args.preserveRecordIds);
          const protectedFromRemoteUpsert = new Set(explicitlyPreserved);
          const locallyModifiedRows = db.prepare(
            "SELECT record_id FROM local_records WHERE owner_id = ? AND record_type = ? " +
            "AND sync_status IS NOT NULL AND sync_status != 'synced'"
          ).all(args.ownerId, args.recordType);
          for (const row of locallyModifiedRows) {
            protectedFromRemoteUpsert.add(String(row.record_id));
          }
          if (explicitlyPreserved.size === 0) {
            db.prepare("DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND (sync_status IS NULL OR sync_status = 'synced')").run(args.ownerId, args.recordType);
          } else {
            const placeholders = Array.from(explicitlyPreserved, () => '?').join(',');
            db.prepare(
              "DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND (sync_status IS NULL OR sync_status = 'synced') AND record_id NOT IN (" + placeholders + ')'
            ).run(args.ownerId, args.recordType, ...explicitlyPreserved);
          }
          for (const value of args.values) {
            if (protectedFromRemoteUpsert.has(value.id)) continue;
            upsert(args.ownerId, args.recordType, value.id, { ...value, local_sync_status: 'synced' });
          }
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

const postWorkerOperation = (operation: string, args: Record<string, unknown>) =>
  new Promise<unknown>((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => {
      settle(id, new Error(`Local database operation timed out: ${operation}`));
    }, PENDING_TIMEOUT_MS);
    pending.set(id, { reject, resolve, timer });
    getWorker().postMessage({ args, id, operation });
  });

const acquireDatabaseExclusiveOperation = (
  operation: DatabaseExclusiveOperation,
) => {
  if (databaseExclusiveOperation) {
    throw new Error(
      databaseExclusiveOperation === 'maintenance'
        ? 'Local database maintenance is still in progress.'
        : 'A local database flush is already in progress.',
    );
  }
  databaseExclusiveOperation = operation;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (operation === 'maintenance') {
      databaseMaintenanceFenceActive = false;
    }
    databaseExclusiveOperation = null;
  };
};

const run = (operation: string, args: Record<string, unknown>) => {
  if (
    databaseExclusiveOperation === 'maintenance' &&
    databaseMaintenanceFenceActive
  ) {
    return Promise.reject(
      new Error('Local database is temporarily unavailable during restore.'),
    );
  }
  if (databaseExclusiveOperation === 'finalization') {
    return Promise.reject(
      new Error('Local database is temporarily unavailable while finalizing writes.'),
    );
  }
  return postWorkerOperation(operation, args);
};

const waitForPendingOperations = async () => {
  while (pending.size > 0) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

export const flushLocalDatabaseOperations = async () => {
  const releaseExclusiveOperation = acquireDatabaseExclusiveOperation(
    'finalization',
  );
  try {
    await waitForPendingOperations();
    // A timed-out request may still be executing in the worker after it left
    // the pending map. The FIFO checkpoint proves every earlier operation
    // finished, while the fence rejects operations that would arrive after it.
    if (worker) await postWorkerOperation('checkpoint', {});
  } finally {
    releaseExclusiveOperation();
  }
};

app.on('will-quit', () => {
  void worker?.terminate();
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

const SUBNOTA_RECORD_COLUMNS = new Set([
  'owner_id',
  'record_type',
  'record_id',
  'payload_json',
  'sync_status',
  'updated_at',
  'is_archived',
]);

const assertValidSubnotaDatabase = (databasePath: string) => {
  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    const integrity = database
      .prepare('PRAGMA integrity_check(1)')
      .get() as { integrity_check?: unknown } | undefined;
    if (integrity?.integrity_check !== 'ok') {
      throw new Error('SQLite 무결성 검사에 실패한 백업 파일입니다.');
    }

    const table = database
      .prepare(
        "SELECT type FROM sqlite_schema WHERE name = 'local_records' LIMIT 1",
      )
      .get() as { type?: unknown } | undefined;
    const columns = database
      .prepare('PRAGMA table_info(local_records)')
      .all() as Array<{ name?: unknown; pk?: unknown }>;
    const columnNames = new Set(columns.map(column => String(column.name)));
    const primaryKey = columns
      .filter(column => Number(column.pk) > 0)
      .sort((left, right) => Number(left.pk) - Number(right.pk))
      .map(column => String(column.name));
    if (
      table?.type !== 'table' ||
      columns.length === 0 ||
      [...SUBNOTA_RECORD_COLUMNS].some(column => !columnNames.has(column)) ||
      primaryKey.join(',') !== 'owner_id,record_type,record_id'
    ) {
      throw new Error('Subnota 데이터베이스 스키마가 없는 백업 파일입니다.');
    }
    const invalidPayload = database
      .prepare(
        "SELECT 1 FROM local_records WHERE CASE " +
          "WHEN json_valid(payload_json) = 1 THEN json_type(payload_json) <> 'object' " +
          'ELSE 1 END LIMIT 1',
      )
      .get();
    if (invalidPayload) {
      throw new Error('Subnota 데이터 레코드가 손상된 백업 파일입니다.');
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('SQLite 무결성') ||
        error.message.startsWith('Subnota 데이터'))
    ) {
      throw error;
    }
    throw new Error('Subnota SQLite 백업 파일을 읽을 수 없습니다.', {
      cause: error,
    });
  } finally {
    database?.close();
  }
};

const assertWritableSubnotaDatabase = (databasePath: string) => {
  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(databasePath);
    database.exec('BEGIN IMMEDIATE; ROLLBACK;');
  } catch (error) {
    throw new Error('복원한 Subnota 데이터베이스에 쓸 수 없습니다.', {
      cause: error,
    });
  } finally {
    database?.close();
  }
};

const replaceDatabaseFromBackup = async (backupPath: string) => {
  const databasePath = getDatabasePath();
  await fs.promises.mkdir(path.dirname(databasePath), { recursive: true });
  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(path.dirname(databasePath), '.subnota-restore-'),
  );
  const candidatePath = path.join(temporaryDirectory, 'candidate.sqlite3');
  const rollbackPath = path.join(temporaryDirectory, 'previous.sqlite3');
  const sidecars = ['-wal', '-shm'].map(suffix => ({
    active: `${databasePath}${suffix}`,
    rollback: `${rollbackPath}${suffix}`,
  }));
  let preserveTemporaryDirectory = false;
  let candidateInstalled = false;
  let previousDatabaseMoved = false;
  const previousSidecarsMoved = new Set<string>();

  try {
    // Validate the exact snapshot that will be installed. Validating the selected
    // path and copying it later would leave a mutation window between the two.
    await fs.promises.copyFile(backupPath, candidatePath);
    await fs.promises.chmod(candidatePath, 0o600);
    assertValidSubnotaDatabase(candidatePath);

    // Operations accepted before the maintenance fence finish on the old DB.
    // New requests fail instead of spawning a worker against an inode that is
    // about to be replaced.
    await waitForPendingOperations();
    if (worker) await postWorkerOperation('checkpoint', {});
    await stopWorker();

    try {
      if (fs.existsSync(databasePath)) {
        await fs.promises.rename(databasePath, rollbackPath);
        previousDatabaseMoved = true;
        for (const sidecar of sidecars) {
          if (!fs.existsSync(sidecar.active)) continue;
          await fs.promises.rename(sidecar.active, sidecar.rollback);
          previousSidecarsMoved.add(sidecar.active);
        }
      } else {
        await Promise.all(
          sidecars.map(sidecar =>
            fs.promises.rm(sidecar.active, { force: true }),
          ),
        );
      }

      // Both paths live beside the active database, so rename never crosses a
      // filesystem boundary. The previous database remains available for rollback
      // until the installed copy passes the same preflight a second time.
      await fs.promises.rename(candidatePath, databasePath);
      candidateInstalled = true;
      assertValidSubnotaDatabase(databasePath);
      assertWritableSubnotaDatabase(databasePath);
    } catch (replacementError) {
      try {
        if (candidateInstalled) {
          await Promise.all([
            fs.promises.rm(databasePath, { force: true }),
            ...sidecars.map(sidecar =>
              fs.promises.rm(sidecar.active, { force: true }),
            ),
          ]);
        }
        if (previousDatabaseMoved) {
          await fs.promises.rename(rollbackPath, databasePath);
          previousDatabaseMoved = false;
        }
        for (const sidecar of sidecars) {
          if (!previousSidecarsMoved.has(sidecar.active)) continue;
          await fs.promises.rename(sidecar.rollback, sidecar.active);
          previousSidecarsMoved.delete(sidecar.active);
        }
      } catch (rollbackError) {
        // Never delete the only remaining copy when automatic rollback fails.
        preserveTemporaryDirectory = true;
        throw new Error(
          `백업 복원과 자동 롤백에 실패했습니다. 안전 사본 폴더: ${temporaryDirectory}`,
          { cause: rollbackError },
        );
      }
      throw new Error('백업 복원에 실패하여 기존 데이터를 유지했습니다.', {
        cause: replacementError,
      });
    }

    if (previousDatabaseMoved) {
      await fs.promises.rm(rollbackPath, { force: true }).catch(() => undefined);
    }
  } finally {
    if (!preserveTemporaryDirectory) {
      await fs.promises
        .rm(temporaryDirectory, { force: true, recursive: true })
        .catch(() => undefined);
    }
  }
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
const normalizedPreserveRecordIds = (value: unknown) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error('Invalid preserved record ids.');
  }
  const ids = value.map(recordId => {
    if (
      typeof recordId !== 'string' ||
      recordId.length === 0 ||
      recordId.length > 512
    ) {
      throw new Error('Invalid preserved record id.');
    }
    return recordId;
  });
  return [...new Set(ids)];
};
const normalizedMemoId = (memoId: unknown) => {
  if (
    typeof memoId !== 'string' ||
    memoId.length === 0 ||
    memoId.length > 512
  ) {
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
ipcMain.handle(
  'local-db:patch-memo-sync-base',
  (
    event,
    ownerId: unknown,
    memoId: unknown,
    syncedContent: unknown,
    syncedContentHash: unknown,
  ) => {
    assertTrustedSender(event);
    if (typeof syncedContent !== 'string') {
      throw new Error('Invalid synced memo content.');
    }
    if (
      syncedContentHash !== null &&
      typeof syncedContentHash !== 'string'
    ) {
      throw new Error('Invalid synced memo content hash.');
    }
    return run('patch-memo-sync-base', {
      memoId: normalizedMemoId(memoId),
      ownerId: ownerForRequest(event, ownerId),
      syncedContent,
      syncedContentHash,
    });
  },
);
ipcMain.handle(
  'local-db:apply-memo-sync-result',
  (
    event,
    ownerId: unknown,
    memoId: unknown,
    expectedLocalContent: unknown,
    value: unknown,
  ) => {
    assertTrustedSender(event);
    const normalizedId = normalizedMemoId(memoId);
    if (typeof expectedLocalContent !== 'string') {
      throw new Error('Invalid expected local memo content.');
    }
    const record = normalizedRecord(value);
    if (
      record.id !== normalizedId ||
      typeof record.content !== 'string' ||
      (record.content_hash !== null &&
        typeof record.content_hash !== 'string') ||
      typeof record.created_at !== 'string' ||
      (record.is_archived !== null &&
        typeof record.is_archived !== 'boolean') ||
      typeof record.synced_content !== 'string' ||
      (record.synced_content_hash !== null &&
        typeof record.synced_content_hash !== 'string') ||
      typeof record.updated_at !== 'string' ||
      (record.local_sync_status !== 'synced' &&
        record.local_sync_status !== 'pending' &&
        record.local_sync_status !== 'failed')
    ) {
      throw new Error('Invalid memo sync result record.');
    }
    return run('apply-memo-sync-result', {
      expectedLocalContent,
      memoId: normalizedId,
      ownerId: ownerForRequest(event, ownerId),
      record,
    });
  },
);
ipcMain.handle(
  'local-db:restore-memo-snapshot-after-pull',
  (
    event,
    ownerId: unknown,
    memoId: unknown,
    value: unknown,
  ) => {
    assertTrustedSender(event);
    const normalizedId = normalizedMemoId(memoId);
    const record = normalizedRecord(value);
    if (record.id !== normalizedId) {
      throw new Error('Local memo snapshot id does not match.');
    }
    return run('restore-memo-snapshot-after-pull', {
      memoId: normalizedId,
      ownerId: ownerForRequest(event, ownerId),
      record,
    });
  },
);
ipcMain.handle('local-db:delete', (event, ownerId: unknown, recordType: unknown, recordId: unknown) => {
  assertTrustedSender(event);
  if (typeof recordId !== 'string' || !recordId) throw new Error('Invalid record id.');
  return run('delete', { ownerId: ownerForRequest(event, ownerId), recordId, recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:clear-owner', (event, ownerId: unknown) => {
  assertTrustedSender(event);
  return run('clear-owner', { ownerId: ownerForRequest(event, ownerId) });
});
ipcMain.handle(
  'local-db:delete-inbox-pending-if-not-deleted',
  (event, ownerId: unknown, recordId: unknown) => {
    assertTrustedSender(event);
    return run('delete-inbox-pending-if-not-deleted', {
      ownerId: ownerForRequest(event, ownerId),
      recordId: normalizedMemoId(recordId),
    });
  },
);
ipcMain.handle(
  'local-db:replace-synced',
  (
    event,
    ownerId: unknown,
    recordType: unknown,
    values: unknown,
    preserveRecordIds: unknown,
  ) => {
    assertTrustedSender(event);
    if (!Array.isArray(values)) {
      throw new Error('Invalid local record collection.');
    }
    const records = values.map(normalizedRecord);
    if (records.some(record => typeof record.id !== 'string' || !record.id)) {
      throw new Error('Invalid record id.');
    }
    return run('replace', {
      ownerId: ownerForRequest(event, ownerId),
      preserveRecordIds: normalizedPreserveRecordIds(preserveRecordIds),
      recordType: normalizedType(recordType),
      values: records,
    });
  },
);
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

const beginDatabaseMaintenance = async () => {
  const releaseExclusiveOperation = acquireDatabaseExclusiveOperation(
    'maintenance',
  );
  let rendererWriteGuard: RendererWriteGuardLease | null = null;
  try {
    if (localDatabaseMaintenanceHooks) {
      rendererWriteGuard =
        await localDatabaseMaintenanceHooks.acquireRendererWriteGuard();
      if (!rendererWriteGuard) {
        throw new Error(
          '저장하지 못한 변경 사항이 있어 데이터베이스 작업을 중단했습니다.',
        );
      }
    }
    // Renderer acknowledgements prove their queues are drained. Install the
    // database fence in the same turn, before waiting for accepted worker work,
    // so no operation can recreate the old-path worker during the swap.
    databaseMaintenanceFenceActive = true;
    return (cancelled: boolean) => {
      releaseExclusiveOperation();
      rendererWriteGuard?.release(cancelled);
    };
  } catch (error) {
    releaseExclusiveOperation();
    rendererWriteGuard?.release(true);
    throw error;
  }
};

const reloadDatabaseRenderers = (fallbackSender: Electron.WebContents) => {
  const reloaded = new Set<number>();
  for (const window of BrowserWindow.getAllWindows?.() ?? []) {
    if (window.isDestroyed()) continue;
    reloaded.add(window.webContents.id);
    try {
      window.webContents.reload();
    } catch {
      // Continue reloading other windows. A failed renderer remains protected
      // by its write guard instead of being allowed to write its stale state.
    }
  }
  if (!reloaded.has(fallbackSender.id) && !fallbackSender.isDestroyed?.()) {
    try {
      fallbackSender.reload();
    } catch {
      // The database was already switched atomically. Keep the stale renderer
      // guarded and let another live window continue reloading.
    }
  }
};

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

  const finishMaintenance = await beginDatabaseMaintenance();
  let storageChanged = false;
  try {
    await waitForPendingOperations();
    if (worker) await postWorkerOperation('checkpoint', {});
    await stopWorker();
    await fs.promises.mkdir(directory, { recursive: true });
    if (fs.existsSync(currentPath)) {
      await fs.promises.copyFile(currentPath, nextPath);
    }
    saveStorageDirectory(directory);
    const info = await getStorageInfo();
    storageChanged = true;
    reloadDatabaseRenderers(event.sender);
    return info;
  } finally {
    finishMaintenance(!storageChanged);
  }
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
  const finishMaintenance = await beginDatabaseMaintenance();
  try {
    await waitForPendingOperations();
    if (worker) await postWorkerOperation('checkpoint', {});
    // The maintenance fence prevents a renderer from appending new WAL frames
    // between the checkpoint and this file copy. Without it, a successful
    // backup can omit a queued edit or copy the database during auto-checkpoint.
    await fs.promises.copyFile(getDatabasePath(), result.filePath);
    return result.filePath;
  } finally {
    // Backup keeps the active database and renderer alive, so always release
    // the write guard explicitly instead of waiting for a reload.
    finishMaintenance(true);
  }
});

ipcMain.handle('local-db:restore', async (event, backupPath: unknown) => {
  assertTrustedSender(event);
  if (typeof backupPath !== 'string' || !path.isAbsolute(backupPath)) {
    throw new Error('올바르지 않은 백업 파일입니다.');
  }
  const databasePath = getDatabasePath();
  const canonicalPath = (filePath: string) =>
    fs.promises.realpath(filePath).catch(() => path.resolve(filePath));
  const [canonicalBackupPath, canonicalDatabasePath] = await Promise.all([
    canonicalPath(backupPath),
    canonicalPath(databasePath),
  ]);
  if (canonicalBackupPath === canonicalDatabasePath) {
    throw new Error('현재 사용 중인 데이터베이스는 복원할 수 없습니다.');
  }
  const finishMaintenance = await beginDatabaseMaintenance();
  let databaseReplaced = false;
  try {
    await replaceDatabaseFromBackup(backupPath);
    databaseReplaced = true;
    reloadDatabaseRenderers(event.sender);
  } finally {
    finishMaintenance(!databaseReplaced);
  }
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
