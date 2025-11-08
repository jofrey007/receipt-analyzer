import type { ReceiptItem } from '../api/client';

interface ReceiptTableProps {
  items: ReceiptItem[];
}

export function ReceiptTable({ items }: ReceiptTableProps) {
  if (!items.length) {
    return <p style={{ color: '#94a3b8' }}>Bloček zatiaľ nemá položky.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Položka</th>
            <th>Množstvo</th>
            <th>Jednotková cena</th>
            <th>Spolu</th>
            <th>Kategória</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit_price?.toFixed(2) ?? '—'}</td>
              <td>{item.total_price?.toFixed(2) ?? '—'}</td>
              <td>
                {item.category ? <span className="badge">{item.category}</span> : item.suggested_category ?? 'Nezaradené'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
