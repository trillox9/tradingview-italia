import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Stylesheet cascade order: base design tokens/reset -> portal -> panels -> supercharts -> modals/standalone pages
import './styles/global.css';
import './styles/home.css';
import './styles/panels.css';
import './styles/chart.css';
import './styles/modals.css';

import App from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
