import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const LEGACY_DATA_FILES = [
  'desktop-preferences.json',
  'local-storage.json',
  'subnota-local.sqlite3',
  'subnota-local.sqlite3-shm',
  'subnota-local.sqlite3-wal',
];

// Electron's sessionData contains both disposable caches and session state
// (cookies/localStorage). Move both together so a layout migration does not
// sign the user out or reset renderer preferences.
const LEGACY_RUNTIME_ENTRIES = [
  'Cache',
  'Code Cache',
  'Cookies',
  'Cookies-journal',
  'Current Session',
  'Current Tabs',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'DevToolsActivePort',
  'DIPS',
  'DIPS-wal',
  'File System',
  'GPUCache',
  'IndexedDB',
  'Local State',
  'Local Storage',
  'Network Persistent State',
  'Preferences',
  'QuotaManager',
  'QuotaManager-journal',
  'Secure Preferences',
  'Service Worker',
  'Session Storage',
  'Sessions',
  'Shared Dictionary',
  'SharedStorage',
  'SharedStorage-shm',
  'SharedStorage-wal',
  'SingletonCookie',
  'SingletonLock',
  'SingletonSocket',
  'TransportSecurity',
  'Trust Tokens',
  'Trust Tokens-journal',
  'Visited Links',
  'blob_storage',
];

const RUNTIME_LAYOUT_MARKER = '.runtime-layout-v1';
let storageRoot: string | null = null;

const getElectronUserDataDirectory = () =>
  typeof app.getPath === 'function' ? app.getPath('userData') : '';

export const getStorageRoot = () => storageRoot ?? getElectronUserDataDirectory();

export const getDataDirectory = () =>
  path.join(getStorageRoot(), 'Data');

export const getModelCacheDirectory = () =>
  path.join(getStorageRoot(), 'Models', 'Embedding');

export const getLegacyModelCacheDirectory = () =>
  path.join(getStorageRoot(), 'models');

export const getRuntimeDirectory = () =>
  path.join(getStorageRoot(), 'Runtime');

const exists = (target: string) => {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
};

const moveWithoutOverwrite = (source: string, target: string) => {
  if (!exists(source)) return;
  if (!exists(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);
    return;
  }

  const sourceStat = fs.lstatSync(source);
  const targetStat = fs.lstatSync(target);
  if (!sourceStat.isDirectory() || !targetStat.isDirectory()) return;

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    moveWithoutOverwrite(
      path.join(source, entry.name),
      path.join(target, entry.name),
    );
  }

  if (fs.readdirSync(source).length === 0) {
    fs.rmSync(source, { recursive: true, force: true });
  }
};

const removeStaleFiles = (directory: string, cutoff: number) => {
  if (!exists(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removeStaleFiles(target, cutoff);
      if (fs.readdirSync(target).length === 0) {
        fs.rmSync(target, { recursive: true, force: true });
      }
      continue;
    }

    try {
      if (fs.statSync(target).mtimeMs < cutoff) {
        fs.rmSync(target, { force: true });
      }
    } catch {
      // A cache entry can disappear while Chromium is rotating it.
    }
  }
};

const migrateLegacyLayout = () => {
  const dataDirectory = getDataDirectory();
  const modelDirectory = getModelCacheDirectory();
  const legacyModelDirectory = getLegacyModelCacheDirectory();
  const runtimeDirectory = getRuntimeDirectory();

  for (const directory of [dataDirectory, runtimeDirectory]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const userDataDirectory = getStorageRoot();
  for (const file of LEGACY_DATA_FILES) {
    moveWithoutOverwrite(
      path.join(userDataDirectory, file),
      path.join(dataDirectory, file),
    );
  }
  // macOS treats `models` and `Models` as the same directory. Moving the
  // legacy directory itself into `Models/Embedding` would therefore attempt
  // to move a folder into one of its own children. Move its contents instead.
  const isCaseInsensitivePlatform =
    process.platform === 'darwin' || process.platform === 'win32';
  if (isCaseInsensitivePlatform) {
    fs.mkdirSync(modelDirectory, { recursive: true });
    if (exists(legacyModelDirectory)) {
      for (const entry of fs.readdirSync(legacyModelDirectory, {
        withFileTypes: true,
      })) {
        if (entry.name === 'Embedding') continue;
        moveWithoutOverwrite(
          path.join(legacyModelDirectory, entry.name),
          path.join(modelDirectory, entry.name),
        );
      }
    }
    const modelRoot = path.dirname(modelDirectory);
    const actualModelRoot = exists(legacyModelDirectory)
      ? fs.realpathSync(legacyModelDirectory)
      : null;
    if (
      actualModelRoot &&
      path.basename(actualModelRoot) !== path.basename(modelRoot)
    ) {
      const temporaryRoot = path.join(userDataDirectory, '.subnota-models-move');
      if (!exists(temporaryRoot)) {
        fs.renameSync(legacyModelDirectory, temporaryRoot);
        fs.renameSync(temporaryRoot, modelRoot);
      }
    }
  } else {
    moveWithoutOverwrite(legacyModelDirectory, modelDirectory);
  }

  for (const entry of LEGACY_RUNTIME_ENTRIES) {
    moveWithoutOverwrite(
      path.join(userDataDirectory, entry),
      path.join(runtimeDirectory, entry),
    );
  }
};

const resetRuntimeCachesForLayout = () => {
  const markerPath = path.join(getDataDirectory(), RUNTIME_LAYOUT_MARKER);
  if (exists(markerPath)) return;

  for (const directory of ['Cache', 'Code Cache', 'GPUCache']) {
    fs.rmSync(path.join(getRuntimeDirectory(), directory), {
      force: true,
      recursive: true,
    });
  }
  fs.writeFileSync(markerPath, '1', 'utf8');
};

export const cleanupStaleCaches = (now = Date.now()) => {
  const runtimeDirectory = getRuntimeDirectory();
  const cutoff = now - RUNTIME_CACHE_RETENTION_MS;
  for (const directory of ['Cache', 'Code Cache', 'GPUCache']) {
    removeStaleFiles(path.join(runtimeDirectory, directory), cutoff);
  }
};

/**
 * Must run before Electron creates its default session. Existing session state
 * is migrated together with the disposable caches, then future Chromium files
 * are written under Runtime.
 */
export const prepareAppStorage = () => {
  if (
    typeof app.getPath !== 'function' ||
    typeof app.setPath !== 'function'
  ) {
    return;
  }

  try {
    storageRoot = getElectronUserDataDirectory();
    migrateLegacyLayout();
    resetRuntimeCachesForLayout();
    cleanupStaleCaches();
    app.commandLine?.appendSwitch('user-data-dir', getRuntimeDirectory());
    app.setPath('userData', getRuntimeDirectory());
    app.setPath('sessionData', getRuntimeDirectory());
  } catch (error) {
    // A storage migration must never prevent the app from opening. The path
    // helpers below retain legacy fallbacks when a move could not complete.
    console.warn('Subnota storage layout migration skipped:', error);
  }
};
