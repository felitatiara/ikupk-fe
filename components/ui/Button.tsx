import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  [key: string]: any;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  disabled = false,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded border-none cursor-pointer transition-all';

  const variantStyles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
  };

  const sizeStyles = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const style = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  return (
    <button
      disabled={disabled}
      style={{
        backgroundColor: variant === 'primary' ? '#4f46e5' : variant === 'secondary' ? '#e5e7eb' : variant === 'danger' ? '#dc2626' : '#16a34a',
        color: variant === 'secondary' ? '#1f2937' : 'white',
        padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '8px 16px',
        fontSize: size === 'sm' ? '14px' : size === 'lg' ? '16px' : '14px',
        borderRadius: '6px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontWeight: 600,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
