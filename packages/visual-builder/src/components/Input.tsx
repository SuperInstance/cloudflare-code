/**
 * Input component
 */

import React, { useState } from 'react';

export interface InputProps {
  type?: 'text' | 'number' | 'email' | 'password';
  value: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  className = '',
  id,
}: InputProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange?.(e);
  };

  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        id={inputId}
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        }`}
      />
    </div>
  );
}