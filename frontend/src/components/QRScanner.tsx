import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

interface QRScannerProps {
  onDetected: (value: string) => void;
  active: boolean;
}

export function QRScanner({ onDetected, active }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    let reader: BrowserQRCodeReader | null = null;
    let controls: { stop: () => void } | null = null;
    let isMounted = true;

    async function start() {
      try {
        reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current as HTMLVideoElement,
          (result) => {
            if (result && isMounted) {
              setIsScanning(false);
              onDetected(result.getText());
              controls?.stop();
            }
          },
        );
        setIsScanning(true);
      } catch (error) {
        console.error(error);
        setPermissionError('Nepodarilo sa spustiť kameru. Skontroluj povolenia.');
      }
    }

    start();

    return () => {
      isMounted = false;
      controls?.stop();
    };
  }, [active, onDetected]);

  return (
    <div>
      <div style={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', background: '#000' }} muted playsInline />
        {isScanning && active && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '2px solid rgba(59,130,246,0.6)',
              borderRadius: '0.75rem',
              pointerEvents: 'none',
            }}
          />
        )}
        {!active && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15,23,42,0.6)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '1rem',
            }}
          >
            Skener je pozastavený
          </div>
        )}
      </div>
      {permissionError && <p style={{ color: '#dc2626' }}>{permissionError}</p>}
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Namier foťák na QR kód z bločku (podporuje FS eKasa formát).
      </p>
    </div>
  );
}
