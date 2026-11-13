import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
// Fonts are bundled with the app (not loaded from Google), so visitors' browsers only contact this site for them.
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import './styles/base.css';
import './styles/team.css';
import './styles/dex.css';
import './styles/matchup.css';
import './styles/calc.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
