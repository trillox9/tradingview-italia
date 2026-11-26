import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Stylesheet cascade order: base design tokens/reset -> panels -> supercharts -> drawing tools -> context menus -> modals
import './styles/global.css';
import './styles/panels.css';
import './styles/chart.css';
import './styles/drawingTools.css';
import './styles/contextMenus.css';
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
