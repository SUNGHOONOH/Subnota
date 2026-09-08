import type { ReactNode } from 'react';
import { VisuallyHidden } from '@mantine/core';

import AuthScreen from '../auth/AuthScreen';
import BootBrandMark from '../../components/BootBrandMark';
import WorkspaceBootSkeleton from '../../components/WorkspaceBootSkeleton';
import type { UiLanguage } from '../../lib/appSettings';
import {
  type BootMarkVariant,
  type BootPhase,
} from '../../lib/bootPhase';
import { localize } from '../../lib/uiLanguage';

interface AppEntryGateProps {
  authNotice: string | null;
  bootMarkVariant: BootMarkVariant;
  bootPhase: BootPhase;
  children: ReactNode;
  error: string | null;
  isBooting: boolean;
  isSignedIn: boolean;
  isWorkspaceOwnerTransition: boolean;
  language: UiLanguage;
  pendingResetEmail: string | null;
}

const AppEntryGate = ({
  authNotice,
  bootMarkVariant,
  bootPhase,
  children,
  error,
  isBooting,
  isSignedIn,
  isWorkspaceOwnerTransition,
  language,
  pendingResetEmail,
}: AppEntryGateProps) => {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);

  if (isBooting) {
    // Phase B — 로컬이 아직이면 실제 셸 모양의 스켈레톤으로 넘어간다.
    if (bootPhase === 'shell') {
      return <WorkspaceBootSkeleton />;
    }

    // Phase A — 브랜드 모션. 흩어진 메모가 모여 로고가 된다(BootBrandMark).
    // 전부 CSS다. 부팅 화면에 JS 모션 라이브러리를 다시 끌어들이지 말 것 —
    // 가장 먼저 그려져야 하는 화면이 번들 평가를 기다리게 된다.
    return (
      <main className="loading-screen">
        <span className="auth-bg-orb orb-1" />
        <span className="auth-bg-orb orb-2" />
        <div className="boot-card">
          <BootBrandMark variant={bootMarkVariant} />
          <VisuallyHidden role="status">
            {t('Subnota를 여는 중', 'Opening Subnota')}
          </VisuallyHidden>
        </div>
      </main>
    );
  }

  if (isSignedIn && isWorkspaceOwnerTransition) {
    return <WorkspaceBootSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <AuthScreen
        initialError={error}
        initialNotice={authNotice}
        initialResetEmail={pendingResetEmail}
      />
    );
  }

  return children;
};

export default AppEntryGate;
