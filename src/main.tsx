import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { safeLocalStorage, safeSessionStorage } from './lib/safeLocalStorage';

// Try to polyfill window.localStorage and window.sessionStorage if blocked by third-party iframe cookie/storage rules
function applyStoragePolyfills() {
  if (typeof window === 'undefined') return;

  // 1. Try to redefine on Window.prototype (this intercepts both direct accesses 'localStorage' and 'window.localStorage')
  try {
    Object.defineProperty(Window.prototype, 'localStorage', {
      get() { return safeLocalStorage; },
      configurable: true,
    });
  } catch (e) {
    console.warn("Could not polyfill localStorage on Window.prototype:", e);
  }

  try {
    Object.defineProperty(Window.prototype, 'sessionStorage', {
      get() { return safeSessionStorage; },
      configurable: true,
    });
  } catch (e) {
    console.warn("Could not polyfill sessionStorage on Window.prototype:", e);
  }

  // 2. Try to redefine directly on window object as a fallback
  try {
    Object.defineProperty(window, 'localStorage', {
      value: safeLocalStorage,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  } catch (e) {
    // Expected in many browsers if non-configurable
  }

  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: safeSessionStorage,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  } catch (e) {
    // Expected in many browsers if non-configurable
  }
}

applyStoragePolyfills();

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

