import { useT } from '../i18n';

export default function AppFooter() {
  const t = useT();

  return (
    <footer className="text-muted-foreground border-t pt-6 text-center text-xs">
      Govee Lighting Interaction for Twitch | {t('footer.version')} 1.0 - By{' '}
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
