// Standard react index file
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './TestApp';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
