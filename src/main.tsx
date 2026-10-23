import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function bootstrap() {
  // Replaced at build time, so the mocks never reach the production bundle.
  if (import.meta.env.MODE === 'mock') {
    try {
      const { startMockApi } = await import('./mocks/browser');
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
}

void bootstrap();
