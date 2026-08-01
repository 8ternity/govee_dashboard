import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { api } from '../api';

export default function AppFooter() {
  const t = useT();
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.getHealth().then((h) => setVersion(h?.version || '')).catch(() => {});
  }, []);

  return (
    <footer className="text-muted-foreground border-t pt-6 text-center text-xs">
      Govee Lighting Interaction for Twitch | {t('footer.version')} {version || '…'} - By{' '}
      <a
        href="https://twitch.tv/et34n1ty"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        ET34N1TY
      </a>
    </footer>
  );
}
