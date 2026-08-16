import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import '@mantine/core/styles.css';
import App from './App';
import MiniComposer from './features/mini/MiniComposer';
import MantineRoot from './components/MantineRoot';
import RenderErrorBoundary from './components/RenderErrorBoundary';
import SubnotaMark from './components/SubnotaMark';
import { localize, useUiLanguage } from './lib/uiLanguage';
import { DESKTOP_PLATFORM_FEATURES } from './platform/policy';
import './index.scss';

const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // Anonymous statistics only: do not persist a device identifier or collect IP properties.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_persistence: true,
    ip: false,
    loaded: (client) => client.register({ platform: 'desktop', environment: import.meta.env.MODE }),
  });
}

// The floating Quick Subnota panel window loads this same bundle with a `#mini`
// hash; everything else renders the full workspace.
const isMiniWindow = window.location.hash.replace(/^#/, '').split('?')[0] === 'mini';

// Renderer chrome that is only needed for the macOS hidden title bar uses this
// attribute instead of duplicating platform-specific React trees.
document.documentElement.dataset.desktopPlatform = DESKTOP_PLATFORM_FEATURES.platform;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('앱 루트 요소를 찾을 수 없습니다.');
}

function FatalRenderError() {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);

  return (
    <main
      aria-labelledby="fatal-render-error-title"
      className="fatal-render-error"
      role="alert"
    >
      <div className="fatal-render-error-content">
        <div className="fatal-render-error-brand">
          <SubnotaMark size={26} />
          <span>Subnota</span>
        </div>
        <h1 id="fatal-render-error-title">{t('문제가 발생했습니다.', 'Something went wrong.')}</h1>
        <p>{t('저장 완료된 내용은 이 기기에 남아 있습니다.', 'Content that was saved remains on this device.')}</p>
        <button
          className="fatal-render-error-reload"
          onClick={() => window.location.reload()}
          type="button"
        >
          {t('다시 불러오기', 'Reload')}
        </button>
      </div>
    </main>
  );
}

createRoot(rootElement).render(
  <MantineRoot>
    <RenderErrorBoundary
      fallback={() => <FatalRenderError />}
    >
      {isMiniWindow ? <MiniComposer /> : <App />}
    </RenderErrorBoundary>
  </MantineRoot>,
);
