import React from 'react';

interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps {
  columns: TableColumn[];
  data: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export default function Table({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'Tidak ada data',
}: TableProps) {
  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align || 'left',
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: '#374151',
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '16px',
                      textAlign: col.align || 'left',
                      color: '#374151',
                    }}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#9ca3af',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
