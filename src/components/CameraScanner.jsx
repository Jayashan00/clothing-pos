import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Modal } from './ui';
import { useT } from '../i18n';

// Scan with a phone or laptop camera when no USB scanner is connected.
export default function CameraScanner({ open, onClose, onScan }) {
  const t = useT();
  const video = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    let controls; let stopped = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(undefined, video.current, (res) => {
          if (res && !stopped) { stopped = true; onScan(res.getText()); controls?.stop(); onClose(); }
        });
      } catch (e) { setErr(t('camera.error')); }
    })();
    return () => { stopped = true; try { controls?.stop(); } catch { /* */ } };
  }, [open]); // eslint-disable-line
  return (
    <Modal open={open} onClose={onClose} title={t('camera.title')} icon={<Camera size={20} />}>
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <video ref={video} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-8 top-1/2 h-0.5 bg-saffron-400 shadow-[0_0_12px_#E8A317]" />
      </div>
      <p className="muted mt-3">{err || t('camera.hint')}</p>
    </Modal>
  );
}
