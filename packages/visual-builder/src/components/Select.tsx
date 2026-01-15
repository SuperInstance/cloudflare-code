/**
 * Select component
 */

import React, { useState } from 'react';

export interface SelectProps {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Select({
  value,
  onChange,
  children,
  placeholder,
  disabled = false,
  className = '',
  id,
}: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`select-group ${className}`}>
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        }`}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {children}
      </select>
    </div>
  );
}