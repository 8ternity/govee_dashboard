import { useState, useRef } from 'react';
import { Settings, Download, Upload, Plus, Languages } from 'lucide-react';
import { api } from '../api';
import { useT, useLocale, setLocale } from '../i18n';
import ScanPanel from './ScanPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export default function SettingsMenu({ devices, onAdded, onError }) {
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const t = useT();
  const locale = useLocale();

  const handleLanguage = async (value) => {
    setOpen(false);
    try {
      await api.updateSettings({ lang: value });
      setLocale(value);
    } catch (err) {
      onError(err.message);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    setOpen(false);
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `govee-lightning-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleImportClick = () => {
    setOpen(false);
    fileRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!confirm(t('settings.importConfirm'))) {
      return;
    }

    setBusy(true);
    setOpen(false);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.importBackup(data);
      window.location.reload();
    } catch (err) {
      onError(err.message || t('settings.importFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy} aria-label={t('settings.title')}>
            <Settings /> {t('settings.title')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setScanOpen(true)} disabled={busy}>
            <Plus /> {t('settings.addLight')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExport} disabled={busy}>
            <Download /> {t('settings.export')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick} disabled={busy}>
            <Upload /> {t('settings.import')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages /> {t('settings.language')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={locale} onValueChange={handleLanguage}>
                <DropdownMenuRadioItem value="fr_CA">
                  {t('settings.language.fr_CA')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="en_US">
                  {t('settings.language.en_US')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings.addLight')}</DialogTitle>
          </DialogHeader>
          <ScanPanel
            devices={devices}
            open={scanOpen}
            embedded
            onAdded={onAdded}
            onError={onError}
          />
        </DialogContent>
      </Dialog>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleFile}
      />
    </div>
  );
}
