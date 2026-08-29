import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Intercept and safely wrap window.alert to avoid crash in sandboxed/restricted iframe environments
try {
  const originalAlert = window.alert;
  window.alert = function (message?: any) {
    try {
      if (typeof originalAlert === 'function') {
        originalAlert.call(window, message);
      } else {
        console.log("ALERT:", message);
      }
    } catch (e) {
      console.warn("window.alert is blocked/restricted by the browser sandbox. Content of alert:", message);
    }
  };
} catch (err) {
  console.warn("Could not wrap window.alert:", err);
}

// Safely handle global unhandled errors to filter out benign cross-origin third-party script errors (e.g. from browser extensions)
try {
  const isBenign = (msg: string, err: any) => {
    try {
      const message = (msg || '').toString().toLowerCase();
      return message.indexOf('script error') > -1 ||
             message.indexOf('access is denied') > -1 ||
             message.indexOf('localstorage') > -1 ||
             message.indexOf('securityerror') > -1 ||
             message.indexOf('could not reach cloud firestore backend') > -1 ||
             message.indexOf('firestore (12.12.0)') > -1 ||
             message.indexOf('operating in offline mode') > -1;
    } catch (e) {
      return false;
    }
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (isBenign(msg, event.error)) {
      console.warn('Benign cross-origin or extension Script Error ignored:', event);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    const msg = (event.reason && event.reason.message) ? event.reason.message.toString() : '';
    if (isBenign(msg, event.reason)) {
      console.warn('Unhandled promise rejection caught and silenced:', event.reason);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);
} catch (e) {
  console.warn("Could not register global error listeners:", e);
}

import App from './App.tsx';
import './index.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

