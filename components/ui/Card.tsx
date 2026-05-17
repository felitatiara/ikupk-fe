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
      className="ui-card"
      style={{
        padding: `${padding}px`,
        cursor: clickable ? 'pointer' : 'default',
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
