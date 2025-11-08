import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ReceiptDetail, ReceiptSummary, StatsResponse } from './api/client';
import { QRScanner } from './components/QRScanner';
import { UploadPanel } from './components/UploadPanel';
import { ReceiptTable } from './components/ReceiptTable';
import { StatsSummary } from './components/StatsSummary';

export default function App() {
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(true);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);

  const now = useMemo(() => ({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }), []);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [receiptList, statsResponse] = await Promise.all([
        api.getReceipts(),
        api.getStats(now.year, now.month),
      ]);
      setReceipts(receiptList);
      setStats(statsResponse);
      if (receiptList.length) {
        const full = await api.getReceipt(receiptList[0].receipt_id);
        setSelectedReceipt(full);
      } else {
        setSelectedReceipt(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať dáta');
    }
  }, [now.month, now.year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buildPayloadFromInput = (raw: string) => {
    const value = raw.trim();
    if (!value) {
      throw new Error('QR kód je prázdny');
    }
    const looksLikeQr =
      value.includes('{') ||
      value.includes('=') ||
      value.includes('&') ||
      value.includes('?') ||
      value.startsWith('V');
    if (looksLikeQr) {
      return { qr_code: value };
    }
    return { receipt_id: value };
  };

  const handleReceiptFetched = useCallback(
    async (payload: Parameters<typeof api.fetchReceipt>[0], options?: { fromScanner?: boolean }) => {
      if (options?.fromScanner) {
        setScannerActive(false);
        setScannerMessage('Spracovávam QR kód…');
      }
      setLoading(true);
      setError(null);
      try {
        const receipt = await api.fetchReceipt(payload);
        await loadData();
        setSelectedReceipt(receipt);
        if (options?.fromScanner) {
          setScannerMessage('Bloček bol uložený. Klikni na "Skenovať znova" ak chceš pokračovať.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nepodarilo sa uložiť bloček';
        setError(message);
        if (options?.fromScanner) {
          setScannerMessage(`Skenovanie zlyhalo: ${message}. Oprav problém a skús znova.`);
        }
      } finally {
        setLoading(false);
      }
    },
    [loadData],
  );

  const resumeScanner = () => {
    setScannerMessage(null);
    setScannerActive(true);
  };

  return (
    <div className="app-shell">
      <header style={{ marginBottom: '2rem' }}>
        <h1>Receipt Analyzer</h1>
        <p style={{ color: '#64748b' }}>
          Naskenuj alebo nahraj bloček z eKasa portálu a získaj okamžitý prehľad výdavkov.
        </p>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="card">
          <h2>QR skener</h2>
          <QRScanner
            active={scannerActive}
            onDetected={(value) => {
              try {
                const payload = buildPayloadFromInput(value);
                handleReceiptFetched(payload, { fromScanner: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : 'QR kód je neplatný');
              }
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
            <button className="button" type="button" onClick={resumeScanner} disabled={scannerActive}>
              {scannerActive ? 'Skenovanie aktívne' : 'Skenovať znova'}
            </button>
            {scannerMessage && <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{scannerMessage}</span>}
          </div>
        </section>

        <section className="card">
          <h2>Alternatívne načítanie</h2>
          <UploadPanel
            onUploadJson={(json) => handleReceiptFetched({ payload: json as Record<string, unknown> })}
            onSubmitReceiptId={(value) => handleReceiptFetched(buildPayloadFromInput(value))}
          />
        </section>
      </div>

      {error && (
        <div className="card" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Posledné bločky</h2>
          <button className="button" onClick={loadData} disabled={loading}>
            {loading ? 'Obnovujem…' : 'Obnoviť'}
          </button>
        </div>
        {receipts.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Zatiaľ žiadne bločky.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '0.5rem',
                  background: selectedReceipt?.receipt_id === receipt.receipt_id ? '#e0f2fe' : '#f8fafc',
                  cursor: 'pointer',
                }}
                onClick={async () => {
                  const detail = await api.getReceipt(receipt.receipt_id);
                  setSelectedReceipt(detail);
                }}
              >
                <div style={{ fontWeight: 600 }}>{receipt.merchant_name ?? 'Neznámy obchod'}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {receipt.issue_date ? new Date(receipt.issue_date).toLocaleString() : '—'} · {receipt.total_amount ?? '—'} €
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="card">
          <h2>Detail bločku</h2>
          {selectedReceipt ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>{selectedReceipt.merchant_name ?? 'Neznámy obchod'}</h3>
                <p style={{ color: '#94a3b8', margin: 0 }}>
                  {selectedReceipt.issue_date ? new Date(selectedReceipt.issue_date).toLocaleString() : '—'}
                </p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {selectedReceipt.total_amount?.toFixed(2) ?? '—'} €
                </p>
              </div>
              <ReceiptTable items={selectedReceipt.items} />
            </>
          ) : (
            <p style={{ color: '#94a3b8' }}>Vyber bloček zo zoznamu alebo naskenuj nový.</p>
          )}
        </section>

        <section className="card">
          <h2>Štatistiky</h2>
          {stats ? <StatsSummary stats={stats.totals} month={stats.month} year={stats.year} /> : <p>Nahrávam…</p>}
        </section>
      </div>
    </div>
  );
}
