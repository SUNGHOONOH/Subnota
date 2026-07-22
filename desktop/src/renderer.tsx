import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import App from './App';
import MiniComposer from './features/mini/MiniComposer';
import MantineRoot from './components/MantineRoot';
import RenderErrorBoundary from './components/RenderErrorBoundary';
import './index.scss';

// The floating Mini Subnota panel window loads this same bundle with a `#mini`
// hash; everything else renders the full workspace.
const isMiniWindow = window.location.hash.replace(/^#/, '').split('?')[0] === 'mini';

createRoot(document.getElementById('root')!).render(
  <MantineRoot>
    <RenderErrorBoundary
      fallback={() => (
        <main className="fatal-render-error" role="alert">
          <h1>화면을 불러오지 못했습니다.</h1>
          <p>작성 중인 내용은 로컬에 보관되어 있습니다.</p>
          <button onClick={() => window.location.reload()} type="button">
            화면 다시 불러오기
          </button>
        </main>
      )}
    >
      {isMiniWindow ? <MiniComposer /> : <App />}
    </RenderErrorBoundary>
  </MantineRoot>,
);
