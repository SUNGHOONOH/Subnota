import { useEffect, type ReactNode } from 'react';
import { MantineProvider, useMantineColorScheme } from '@mantine/core';
import { mantineTheme } from '../lib/mantineTheme';
import { DARK_MODE_ENABLED } from '../lib/constants';

// 앱은 다크 모드를 <html>의 `.dark` 클래스로 제어한다(theme-toggle.tsx).
// Mantine은 `data-mantine-color-scheme` 속성을 보므로, `.dark` 클래스를
// 단일 소스로 삼아 Mantine 쪽을 따라오게 동기화한다.
function ColorSchemeSync(): null {
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () =>
      setColorScheme(root.classList.contains('dark') ? 'dark' : 'light');

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [setColorScheme]);

  return null;
}

// 초기 릴리스: 다크 모드 비활성화 — 라이트로 고정하고 남아있을 수 있는
// `.dark` 클래스를 걷어낸다. DARK_MODE_ENABLED로 복원.
function ForceLightMode(): null {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  return null;
}

export default function MantineRoot({ children }: { children: ReactNode }) {
  if (!DARK_MODE_ENABLED) {
    return (
      <MantineProvider theme={mantineTheme} forceColorScheme="light">
        <ForceLightMode />
        {children}
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <ColorSchemeSync />
      {children}
    </MantineProvider>
  );
}
