import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  padding?: number;
  clickable?: boolean;
}

export default function Card({
  title,
  children,
  padding = 24,
  clickable = false,
}: CardProps) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: `${padding}px`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
      }}
    >
      {title && (
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            color: '#1f2937',
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
