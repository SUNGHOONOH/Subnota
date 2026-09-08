import SubnotaMark from '../../components/SubnotaMark';

import {
  Row,
  RowAction,
  Section,
} from './SettingsPrimitives';

interface SettingsAccountSectionProps {
  email?: string | null;
  isOnline: boolean;
  isPasswordAccount: boolean;
  isSignedIn: boolean;
  isWorking: boolean;
  provider?: string | null;
  providerLabel: string;
  providerValueLabel: string;
  onOpenDeleteDialog: () => void;
  onPasswordReset: () => void;
  onSignOut: () => void;
  translate: (korean: string, english: string) => string;
}

export default function SettingsAccountSection({
  email,
  isOnline,
  isPasswordAccount,
  isSignedIn,
  isWorking,
  provider,
  providerLabel,
  providerValueLabel,
  onOpenDeleteDialog,
  onPasswordReset,
  onSignOut,
  translate: t,
}: SettingsAccountSectionProps) {
  return (
    <div className="settings-reference-sections">
      <Section title={t('로그인', 'Sign in')}>
        <Row
          description={email ?? t('로그인되지 않음', 'Not signed in')}
          label={t('이메일', 'Email')}
        />
        <Row
          description={
            <ProviderValue label={providerValueLabel} provider={provider} />
          }
          label={t('로그인 방식', 'Sign-in method')}
        />
        <Row
          action={
            <RowAction
              disabled={!isSignedIn || !email || !isPasswordAccount}
              onClick={onPasswordReset}
            >
              {t('재설정', 'Reset')}
            </RowAction>
          }
          description={
            isPasswordAccount
              ? t(
                  '코드를 메일로 보내고 로그아웃합니다. 로그인 화면에서 새 비밀번호를 정합니다.',
                  'Emails a code and signs out this device. Choose a new password on the sign-in screen.',
                )
              : t(
                  `${providerLabel} 계정은 ${providerLabel}에서 비밀번호를 관리합니다.`,
                  `Your ${providerLabel} account manages its password with ${providerLabel}.`,
                )
          }
          label={t('비밀번호', 'Password')}
        />
      </Section>
      <Section title={t('세션', 'Session')}>
        <Row
          action={
            <RowAction color="red" disabled={!isSignedIn} onClick={onSignOut}>
              {t('로그아웃', 'Sign out')}
            </RowAction>
          }
          description={t(
            '이 기기의 로컬 데이터는 그대로 유지됩니다.',
            'Local data on this device stays here.',
          )}
          label={t('이 기기에서 로그아웃', 'Sign out on this device')}
        />
        <Row
          action={
            <RowAction
              color="red"
              disabled={!isSignedIn || !isOnline || isWorking}
              onClick={onOpenDeleteDialog}
            >
              {t('계정 및 데이터 삭제', 'Delete account & data')}
            </RowAction>
          }
          description={
            isOnline
              ? t(
                  '계정, 서버 데이터, 이 기기의 로컬 데이터를 모두 삭제합니다.',
                  'Deletes your account, server data, and local data on this device.',
                )
              : t(
                  '계정 삭제는 인터넷 연결이 필요합니다.',
                  'You need an internet connection to delete your account.',
                )
          }
          label={t('계정 삭제', 'Delete account')}
        />
      </Section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="settings-reference-provider-icon"
      viewBox="0 0 24 24"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SubnotaIcon() {
  return (
    <span
      aria-hidden="true"
      className="settings-reference-provider-icon settings-reference-subnota-logo"
    >
      <SubnotaMark size={16} />
    </span>
  );
}

function ProviderValue({
  label,
  provider,
}: {
  label: string;
  provider?: string | null;
}) {
  const isGoogle = provider?.toLowerCase() === 'google';

  return (
    <span className="settings-reference-provider-value">
      {isGoogle ? <GoogleIcon /> : <SubnotaIcon />}
      <span>{label}</span>
    </span>
  );
}
