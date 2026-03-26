import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { MonitoringStatusProvider } from './context/MonitoringStatusContext';
import App from './App';
import { initApi } from './services';
import './styles/index.css';

function isNativePlatform(): boolean {
  try {
    return (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
}

const Router = isNativePlatform() ? HashRouter : BrowserRouter;

initApi().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Router>
        <MonitoringStatusProvider>
          <App />
        </MonitoringStatusProvider>
      </Router>
    </React.StrictMode>
  );
});
