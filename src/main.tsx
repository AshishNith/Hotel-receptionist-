import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ClientConfigProvider } from './config/ThemeProvider.tsx';
import { BrowserRouter } from 'react-router-dom';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClientConfigProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClientConfigProvider>
  </StrictMode>,
);
