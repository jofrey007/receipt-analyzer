import { ChangeEvent, useState } from 'react';

interface UploadPanelProps {
  onUploadJson: (payload: unknown) => void;
  onSubmitReceiptId: (value: string) => void;
}

export function UploadPanel({ onUploadJson, onSubmitReceiptId }: UploadPanelProps) {
  const [receiptId, setReceiptId] = useState('');

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      onUploadJson(json);
    } catch (error) {
      alert('Súbor nie je platné JSON.');
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!receiptId.trim()) return;
    onSubmitReceiptId(receiptId.trim());
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <div>
        <label htmlFor="receipt-file" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
          Nahraj JSON z FS portálu
        </label>
        <input id="receipt-file" type="file" accept="application/json" onChange={handleFile} />
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          Stiahni detail bločku ako JSON a vlož ho sem.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid" style={{ gap: '0.75rem' }}>
        <label htmlFor="receipt-id" style={{ fontWeight: 600 }}>
          Alebo zadaj priamo receiptId / kód z QR
        </label>
        <input
          id="receipt-id"
          type="text"
          value={receiptId}
          onChange={(e) => setReceiptId(e.target.value)}
          placeholder="MP1234567890"
          style={{
            padding: '0.65rem',
            borderRadius: '0.5rem',
            border: '1px solid #cbd5f5',
            fontSize: '1rem',
          }}
        />
        <button className="button" type="submit">
          Stiahnuť z FS
        </button>
      </form>
    </div>
  );
}
