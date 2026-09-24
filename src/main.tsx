import React from 'react';
import { createRoot } from 'react-dom/client';
import GameScreen from '../app/game';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameScreen />
  </React.StrictMode>,
);
