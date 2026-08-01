import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { api } from './api';
import { LocaleProvider, setLocale } from './i18n';
import './index.css';

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setLocale(s?.lang))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
