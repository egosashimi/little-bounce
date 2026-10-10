import React from 'react';
import { createRoot } from 'react-dom/client';
import GameScreen from '../app/game';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameScreen />
  </React.StrictMode>,
);

// Best-effort portrait lock (works in installed/fullscreen mode; the CSS rotate hint covers browsers).
try {
  (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait').catch(() => {});
} catch {
  /* unsupported */
}
