/**
 * Tab component
 */

import React from 'react';

interface TabProps {
  id: string;
  label: string;
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Tab({
  id,
  label,
  children,
  isActive = false,
  onClick,
  className = '',
}: TabProps) {
  return (
    <div className={`tab ${className}`}>
      <button
        id={id}
        className={`tab-button ${isActive ? 'active' : ''}`}
        onClick={onClick}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${id}`}
      >
        {label}
      </button>
      {isActive && (
        <div
          id={`panel-${id}`}
          role="tabpanel"
          aria-labelledby={id}
          className="tab-content"
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface TabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  activeTab,
  onTabChange,
  children,
  className = '',
}: TabsProps) {
  return (
    <div className={`tabs ${className}`}>
      {children}
    </div>
  );
}