import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { AssetGate } from './components/common/AssetGate';
import { ThemeProvider } from './theme/ThemeProvider';
import { StadiumDataProvider } from './data/StadiumDataProvider';
import { PlayerModalProvider } from './data/PlayerModalProvider';
import { PlayerHoverProvider } from './data/PlayerHoverProvider';
import { TeamModalProvider } from './data/TeamModalProvider';
import { EditorModalProvider } from './data/EditorModalProvider';
import { RecruitModalProvider } from './data/RecruitModalProvider';
import { GameModalProvider } from './data/GameModalProvider';
import { RecruitingExperienceProvider } from './data/RecruitingExperienceProvider';
import { ConfirmDialogProvider } from './data/ConfirmDialogProvider';
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
     <AssetGate>
      <RecruitingExperienceProvider>
       <StadiumDataProvider>
        <ConfirmDialogProvider>
         {/*
           RecruitModalProvider sits ABOVE PlayerModalProvider on purpose. Opening
           a player has to be able to hand off to the recruit view when the id
           turns out to be a prospect (recruits share the roster and would
           otherwise get the full player workspace), and a provider can only read
           context from above it. It holds nothing but state, so nothing between
           the two is lost by lifting it.
         */}
         <RecruitModalProvider>
          <PlayerModalProvider>
           <PlayerHoverProvider>
           <TeamModalProvider>
            <EditorModalProvider>
              <GameModalProvider>
                <HashRouter>
                  <App />
                </HashRouter>
              </GameModalProvider>
            </EditorModalProvider>
           </TeamModalProvider>
           </PlayerHoverProvider>
          </PlayerModalProvider>
         </RecruitModalProvider>
        </ConfirmDialogProvider>
       </StadiumDataProvider>
      </RecruitingExperienceProvider>
     </AssetGate>
    </ThemeProvider>
  </React.StrictMode>,
);
