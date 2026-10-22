import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ProgressProvider } from './app/ProgressProvider';
import { SpeechProvider } from './app/SpeechProvider';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('没有找到 #root');

createRoot(root).render(
  <StrictMode>
    <ProgressProvider>
      <SpeechProvider>
        <App />
      </SpeechProvider>
    </ProgressProvider>
  </StrictMode>,
);
