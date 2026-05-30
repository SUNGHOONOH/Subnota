/* global chrome */

const DEFAULT_APP_URL = 'https://subnota.com';

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(['subnotaAppUrl']);
  if (!stored.subnotaAppUrl) {
    await chrome.storage.sync.set({ subnotaAppUrl: DEFAULT_APP_URL });
  }
});

chrome.action.onClicked.addListener(tab => {
  void saveTab(tab);
});

chrome.commands.onCommand.addListener(command => {
  if (command !== 'save-current-page') {
    return;
  }

  void chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    void saveTab(tabs[0]);
  });
});

async function saveTab(tab) {
  if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
    return;
  }

  const { subnotaAppUrl } = await chrome.storage.sync.get(['subnotaAppUrl']);
  const appUrl = new URL(subnotaAppUrl || DEFAULT_APP_URL);
  appUrl.searchParams.set('captureUrl', tab.url);
  if (tab.title) {
    appUrl.searchParams.set('captureTitle', tab.title);
  }

  await chrome.tabs.create({ url: appUrl.toString() });
}
