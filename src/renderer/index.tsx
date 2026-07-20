import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './app';
import { ThemeProvider } from './theme/ThemeProvider';
import { StadiumDataProvider } from './data/StadiumDataProvider';
import { PlayerModalProvider } from './data/PlayerModalProvider';
import { EditorModalProvider } from './data/EditorModalProvider';
import { RecruitModalProvider } from './data/RecruitModalProvider';
import { GameModalProvider } from './data/GameModalProvider';
import { RecruitingExperienceProvider } from './data/RecruitingExperienceProvider';
import { applyDesignTokens } from '../design/applyTokens';
import './styles/globals.css';

// Must run before the first render — Tailwind's scales resolve through these
// CSS variables with no fallback values (see design/applyTokens.ts).
applyDesignTokens(document.documentElement);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <RecruitingExperienceProvider>
       <StadiumDataProvider>
        <PlayerModalProvider>
          <EditorModalProvider>
            <RecruitModalProvider>
              <GameModalProvider>
                <HashRouter>
                  <App />
                </HashRouter>
              </GameModalProvider>
            </RecruitModalProvider>
          </EditorModalProvider>
        </PlayerModalProvider>
       </StadiumDataProvider>
      </RecruitingExperienceProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
