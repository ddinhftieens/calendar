import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Dọn Service Worker / cache cũ còn sót từ phiên bản PWA trước đó
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(rs => rs.forEach(r => r.unregister()))
    .catch(() => {});
  if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
