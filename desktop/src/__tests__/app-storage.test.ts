import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => ({
  userData: '',
  setPath: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => electronState.userData,
    setPath: electronState.setPath,
  },
}));

const { prepareAppStorage } = await import('../app-storage');

describe('app storage layout', () => {
  afterEach(() => {
    fs.rmSync(electronState.userData, { force: true, recursive: true });
    electronState.setPath.mockClear();
  });

  it('migrates the legacy layout and points new sessions at Runtime', () => {
    electronState.userData = fs.mkdtempSync(
      path.join(os.tmpdir(), 'subnota-storage-test-'),
    );
    fs.writeFileSync(
      path.join(electronState.userData, 'subnota-local.sqlite3'),
      'database',
    );
    fs.mkdirSync(path.join(electronState.userData, 'models', 'Xenova'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(electronState.userData, 'models', 'Xenova', 'tokenizer.json'),
      'tokenizer',
    );
    fs.mkdirSync(path.join(electronState.userData, 'Cache', 'Cache_Data'), {
      recursive: true,
    });
    const oldCacheEntry = path.join(
      electronState.userData,
      'Cache',
      'Cache_Data',
      'old-entry',
    );
    fs.writeFileSync(oldCacheEntry, 'cache');
    const recentCacheEntry = path.join(
      electronState.userData,
      'Cache',
      'Cache_Data',
      'recent-entry',
    );
    fs.writeFileSync(recentCacheEntry, 'cache');
    const oldTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000);
    fs.utimesSync(oldCacheEntry, oldTime, oldTime);
    fs.writeFileSync(
      path.join(electronState.userData, 'models', 'Xenova', 'stale.tmp'),
      'temporary',
    );
    fs.writeFileSync(
      path.join(electronState.userData, 'models', 'Xenova', 'resume.part'),
      'partial',
    );

    prepareAppStorage();

    expect(
      fs.existsSync(
        path.join(electronState.userData, 'Data', 'subnota-local.sqlite3'),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          electronState.userData,
          'Models',
          'Embedding',
          'Xenova',
          'tokenizer.json',
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(electronState.userData, 'Runtime', 'Cache', 'Cache_Data'),
      ),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          electronState.userData,
          'Models',
          'Embedding',
          'Xenova',
          'stale.tmp',
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          electronState.userData,
          'Models',
          'Embedding',
          'Xenova',
          'resume.part',
        ),
      ),
    ).toBe(true);
    expect(electronState.setPath).toHaveBeenCalledWith(
      'userData',
      path.join(electronState.userData, 'Runtime'),
    );
    expect(electronState.setPath).toHaveBeenCalledWith(
      'sessionData',
      path.join(electronState.userData, 'Runtime'),
    );
  });
});
