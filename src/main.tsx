import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/roboto';
import './index.css';
import App from './App';

const bootstrap = async () => {
  // Replaced at build time, so the mocks never reach the production bundle.
  if (import.meta.env.MODE === 'mock') {
    try {
      const { startMockApi } = await import('./mocks/startMockApi');
      await startMockApi();
    } catch (error) {
      // e.g. service workers blocked; the app should still render.
      console.error('Failed to start the mock API', error);
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

void bootstrap();
