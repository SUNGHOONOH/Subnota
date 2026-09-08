import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(
  resolve(__dirname, '../features/settings/SettingsModal.tsx'),
  'utf8',
);
const dialogSource = readFileSync(
  resolve(__dirname, '../features/settings/SettingsDeleteAccountDialog.tsx'),
  'utf8',
);

describe('settings delete-account dialog boundary', () => {
  it('keeps the confirmation UI in the account feature component', () => {
    expect(modalSource).toContain(
      "import SettingsDeleteAccountDialog from './SettingsDeleteAccountDialog';",
    );
    expect(modalSource).toContain('const submitDeleteAccount = async');
    expect(dialogSource).toContain('<Modal');
    expect(dialogSource).toContain("'계정 삭제 확인'");
  });

  it('preserves the confirmation gate and in-progress lock', () => {
    expect(dialogSource).toContain(
      'deleteConfirmation.trim() !== deleteWord || isDeletingAccount',
    );
    expect(dialogSource).toContain('withCloseButton={!isDeletingAccount}');
    expect(dialogSource).toContain('<SubnotaSpinner size={16} />');
  });

  it('keeps parent-owned deletion state and submit callback wiring', () => {
    expect(modalSource).toContain('deleteConfirmation={deleteConfirmation}');
    expect(modalSource).toContain('onSubmit={() => void submitDeleteAccount()}');
    expect(modalSource).toContain('onChangeConfirmation={setDeleteConfirmation}');
  });
});
