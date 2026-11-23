import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ConsentGate } from './components/ConsentGate';
import './styles.css';

// 離線快取（PWA）。被嵌在其他頁面（iframe）中時瀏覽器不允許，略過。
let embedded = true;
try {
  embedded = window.top !== window.self;
} catch {
  /* 跨來源 iframe */
}
if (!embedded && 'serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true });
  } catch {
    /* 不支援時忽略 */
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConsentGate>
      <App />
    </ConsentGate>
  </React.StrictMode>,
);
