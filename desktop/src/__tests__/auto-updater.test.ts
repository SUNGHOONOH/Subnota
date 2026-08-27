import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckForUpdates = vi.fn();
const mockGetFeedURL = vi.fn(() => '');
const mockOn = vi.fn();
const mockQuitAndInstall = vi.fn();
const mockSetFeedURL = vi.fn();
const mockWebContentsSend = vi.fn();
const mockGetVersion = vi.fn(() => '1.0.0');

vi.mock('electron', () => ({
  app: { getVersion: () => mockGetVersion() },
  autoUpdater: {
    checkForUpdates: () => mockCheckForUpdates(),
    getFeedURL: () => mockGetFeedURL(),
    on: (...args: unknown[]) => mockOn(...args),
    quitAndInstall: () => mockQuitAndInstall(),
    setFeedURL: (...args: unknown[]) => mockSetFeedURL(...args),
  },
}));

describe('auto updater', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  let originalReleaseRepo: string | undefined;
  let originalMacFeedUrl: string | undefined;
  let originalGitHubRepository: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetFeedURL.mockReturnValue('');
    mockGetVersion.mockReturnValue('1.0.0');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    originalReleaseRepo = process.env.SUBNOTA_RELEASE_REPO;
    originalMacFeedUrl = process.env.SUBNOTA_MAC_UPDATE_FEED_URL;
    originalGitHubRepository = process.env.GITHUB_REPOSITORY;
    process.env.SUBNOTA_RELEASE_REPO = 'SUNGHOONOH/subnota-test';
    delete process.env.SUBNOTA_MAC_UPDATE_FEED_URL;
    delete process.env.GITHUB_REPOSITORY;
  });

  afterEach(() => {
    if (originalReleaseRepo === undefined) {
      delete process.env.SUBNOTA_RELEASE_REPO;
    } else {
      process.env.SUBNOTA_RELEASE_REPO = originalReleaseRepo;
    }
    if (originalMacFeedUrl === undefined) {
      delete process.env.SUBNOTA_MAC_UPDATE_FEED_URL;
    } else {
      process.env.SUBNOTA_MAC_UPDATE_FEED_URL = originalMacFeedUrl;
    }
    if (originalGitHubRepository === undefined) {
      delete process.env.GITHUB_REPOSITORY;
    } else {
      process.env.GITHUB_REPOSITORY = originalGitHubRepository;
    }
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  it('configures Squirrel.Mac feed URL for packaged macOS builds', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const { configureAutoUpdater } = await import('../auto-updater');

    const result = configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    });

    expect(result).toBe(true);
    expect(mockSetFeedURL).toHaveBeenCalledWith({
      url: 'https://github.com/SUNGHOONOH/subnota-test/releases/latest/download/RELEASES.json',
      serverType: 'json',
    });
    expect(mockOn).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
  });

  it('configures the public Squirrel.Windows update feed for packaged Windows builds', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const { configureAutoUpdater } = await import('../auto-updater');

    const result = configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    });

    expect(result).toBe(true);
    expect(mockSetFeedURL).toHaveBeenCalledWith({
      url: `https://update.electronjs.org/SUNGHOONOH/subnota-test/win32-${process.arch}/1.0.0`,
    });
  });

  it('does not configure native updates when no Subnota release feed is configured', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env.SUBNOTA_RELEASE_REPO = 'not-a-repository';
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.SUBNOTA_MAC_UPDATE_FEED_URL;
    const { configureAutoUpdater } = await import('../auto-updater');

    const result = configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    });

    expect(result).toBe(false);
    expect(mockSetFeedURL).not.toHaveBeenCalled();
  });

  it('rejects an update feed outside the configured GitHub release', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env.SUBNOTA_MAC_UPDATE_FEED_URL =
      'https://attacker.example/RELEASES.json';
    const { configureAutoUpdater } = await import('../auto-updater');

    const result = configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    });

    expect(result).toBe(false);
    expect(mockSetFeedURL).not.toHaveBeenCalled();
  });

  it('uses the Subnota release repository in packaged builds by default', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    delete process.env.SUBNOTA_RELEASE_REPO;
    delete process.env.GITHUB_REPOSITORY;
    const { configureAutoUpdater } = await import('../auto-updater');

    configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    });

    expect(mockSetFeedURL).toHaveBeenCalledWith({
      url: 'https://github.com/SUNGHOONOH/subnota/releases/latest/download/RELEASES.json',
      serverType: 'json',
    });
  });

  it('does not configure native updates outside packaged macOS builds', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const { configureAutoUpdater } = await import('../auto-updater');

    const result = configureAutoUpdater({
      isPackaged: false,
      notifyRenderer: mockWebContentsSend,
    });

    expect(result).toBe(false);
    expect(mockSetFeedURL).not.toHaveBeenCalled();
  });

  it('checks native updates only after the feed URL has been configured', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockGetFeedURL.mockReturnValue('https://example.com/RELEASES.json');
    const { checkForNativeUpdate } = await import('../auto-updater');

    const result = checkForNativeUpdate();

    expect(result).toBe(true);
    expect(mockCheckForUpdates).toHaveBeenCalledOnce();
  });

  it('does not start duplicate native update checks', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockGetFeedURL.mockReturnValue('https://example.com/RELEASES.json');
    const { checkForNativeUpdate } = await import('../auto-updater');

    expect(checkForNativeUpdate()).toBe(true);
    expect(checkForNativeUpdate()).toBe(true);

    expect(mockCheckForUpdates).toHaveBeenCalledOnce();
  });

  it('sends an update-downloaded event to the renderer', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const { configureAutoUpdater } = await import('../auto-updater');

    configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    });
    const downloadedListener = mockOn.mock.calls.find(([event]) => event === 'update-downloaded')?.[1] as (
      event: unknown,
      releaseNotes: string,
      releaseName: string,
      releaseDate: Date,
      updateUrl: string,
    ) => void;

    downloadedListener({}, '', 'Subnota 1.2.0', new Date('2026-06-02'), 'https://example.com/Subnota.zip');

    expect(mockWebContentsSend).toHaveBeenCalledWith('auto-update-downloaded', {
      releaseName: 'Subnota 1.2.0',
      updateUrl: 'https://example.com/Subnota.zip',
    });
  });

  it('marks update shutdown before Squirrel.Mac closes the windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const onInstallRequested = vi.fn();
    const { configureAutoUpdater } = await import('../auto-updater');

    configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
      onInstallRequested,
    });
    const listener = mockOn.mock.calls.find(([event]) => event === 'before-quit-for-update')?.[1] as () => void;

    listener();

    expect(onInstallRequested).toHaveBeenCalledOnce();
  });

  it('reports an asynchronous native install failure to the shutdown guard', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { configureAutoUpdater } = await import('../auto-updater');

    configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
      onError,
    });
    const listener = mockOn.mock.calls.find(([event]) => event === 'error')?.[1] as (
      error: Error,
    ) => void;

    listener(new Error('install failed'));

    expect(onError).toHaveBeenCalledOnce();
    expect(mockWebContentsSend).toHaveBeenCalledWith(
      'auto-update-error',
      expect.any(Object),
    );
    consoleError.mockRestore();
  });

  it('quits and installs a downloaded update', async () => {
    const { installNativeUpdate } = await import('../auto-updater');

    installNativeUpdate();

    expect(mockQuitAndInstall).toHaveBeenCalledOnce();
  });
});
