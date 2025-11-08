import type { StatsRow } from '../api/client';

interface StatsSummaryProps {
  stats: StatsRow[];
  month: number;
  year: number;
}

export function StatsSummary({ stats, month, year }: StatsSummaryProps) {
  const total = stats.reduce((acc, row) => acc + row.total, 0);

  return (
    <div>
      <h3>Výdavky {month}/{year}</h3>
      {stats.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Zatiaľ žiadne bločky pre toto obdobie.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {stats.map((row) => (
            <li
              key={row.category}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}
            >
              <span>{row.category}</span>
              <strong>{row.total.toFixed(2)} €</strong>
            </li>
          ))}
          <li style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
            <span>Spolu</span>
            <strong>{total.toFixed(2)} €</strong>
          </li>
        </ul>
      )}
    </div>
  );
}
