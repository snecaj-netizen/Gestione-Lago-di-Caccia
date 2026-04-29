import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registrazione automatica del Service Worker con log di debug
registerSW({ 
  immediate: true,
  onRegistered(r) {
    console.log('SW Registered: ', r);
  },
  onRegisterError(error) {
    console.error('SW Registration Error: ', error);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
