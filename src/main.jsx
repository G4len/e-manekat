import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx'; 

// Mencari elemen root di index.html
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Gagal menemukan elemen root. Pastikan index.html memiliki <div id="root"></div>');
}

// Render aplikasi utama
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
