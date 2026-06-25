import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import App from './App';
import MiniComposer from './features/mini/MiniComposer';
import MantineRoot from './components/MantineRoot';
import './index.scss';

// The floating Mini Subnota tray window loads this same bundle with a `#mini`
// hash; everything else renders the full workspace.
const isMiniWindow =
  window.location.hash.replace(/^#/, '').split('?')[0] === 'mini';

createRoot(document.getElementById('root')!).render(
  <MantineRoot>{isMiniWindow ? <MiniComposer /> : <App />}</MantineRoot>,
);
