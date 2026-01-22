export * from './api';

export interface LanguageConfig {
  id: string;
  name: string;
  icon: string;
  extension: string;
  template: string;
  dependencies?: string[];
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface TabConfig {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface ModalConfig {
  title: string;
  content: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showClose?: boolean;
}

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}
