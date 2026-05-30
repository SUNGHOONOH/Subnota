/* global chrome */

const input = document.getElementById('appUrl');
const saveButton = document.getElementById('saveButton');
const status = document.getElementById('status');

chrome.storage.sync.get(['subnotaAppUrl']).then(result => {
  input.value = result.subnotaAppUrl || 'https://subnota.com';
});

saveButton.addEventListener('click', async () => {
  const value = input.value.trim();
  if (!/^https?:\/\//i.test(value)) {
    status.textContent = 'http 또는 https 주소를 입력하세요.';
    return;
  }

  await chrome.storage.sync.set({ subnotaAppUrl: value.replace(/\/$/, '') });
  status.textContent = '저장되었습니다.';
});
