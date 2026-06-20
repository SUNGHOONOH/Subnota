import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import App from './App';
import MantineRoot from './components/MantineRoot';
import './index.scss';

createRoot(document.getElementById('root')!).render(
  <MantineRoot>
    <App />
  </MantineRoot>,
);
