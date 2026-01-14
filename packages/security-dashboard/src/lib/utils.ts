import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, subDays, subHours, subMonths } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getSeverityColor(severity: string): string {
  const colors = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-blue-600 bg-blue-50 border-blue-200',
    info: 'text-gray-600 bg-gray-50 border-gray-200',
  };
  return colors[severity as keyof typeof colors] || colors.info;
}

export function getSeverityTextColor(severity: string): string {
  const colors = {
    critical: 'text-red-600',
    high: 'text-orange-600',
    medium: 'text-yellow-600',
    low: 'text-blue-600',
    info: 'text-gray-600',
  };
  return colors[severity as keyof typeof colors] || colors.info;
}

export function getStatusColor(status: string): string {
  const colors = {
    open: 'text-blue-600 bg-blue-50 border-blue-200',
    investigating: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    contained: 'text-orange-600 bg-orange-50 border-orange-200',
    eradicated: 'text-green-600 bg-green-50 border-green-200',
    resolved: 'text-green-600 bg-green-50 border-green-200',
    active: 'text-green-600 bg-green-50 border-green-200',
    inactive: 'text-gray-600 bg-gray-50 border-gray-200',
    pending: 'text-gray-600 bg-gray-50 border-gray-200',
    running: 'text-blue-600 bg-blue-50 border-blue-200',
    completed: 'text-green-600 bg-green-50 border-green-200',
    failed: 'text-red-600 bg-red-50 border-red-200',
    compliant: 'text-green-600 bg-green-50 border-green-200',
    'non-compliant': 'text-red-600 bg-red-50 border-red-200',
    partial: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
  };
  return colors[status as keyof typeof colors] || colors.pending;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function getDateRangePreset(preset: string): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case '24h':
      return { start: subHours(now, 24), end: now };
    case '7d':
      return { start: subDays(now, 7), end: now };
    case '30d':
      return { start: subDays(now, 30), end: now };
    case '90d':
      return { start: subDays(now, 90), end: now };
    case '1y':
      return { start: subMonths(now, 12), end: now };
    default:
      return { start: subDays(now, 7), end: now };
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function downloadFile(data: Blob, filename: string): void {
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(() => false);
}

export function calculateCVSSSeverity(score: number): string {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  if (score > 0) return 'low';
  return 'info';
}

export function getComplianceScore(controls: any[]): number {
  if (controls.length === 0) return 0;
  const compliantCount = controls.filter(
    c => c.status === 'compliant'
  ).length;
  return Math.round((compliantCount / controls.length) * 100);
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

export function filterBy<T>(
  array: T[],
  filters: Record<keyof T, any>
): T[] {
  return array.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      return item[key as keyof T] === value;
    });
  });
}

export function calculateTrend(current: number, previous: number): {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
} {
  if (previous === 0) {
    return { direction: 'stable', percentage: 0 };
  }
  const percentage = ((current - previous) / previous) * 100;
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(percentage) > 5) {
    direction = percentage > 0 ? 'up' : 'down';
  }
  return { direction, percentage: Math.abs(percentage) };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRandomColor(): string {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    }).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadFile(blob, `${filename}.csv`);
}

export function exportToJSON(data: any[], filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadFile(blob, `${filename}.json`);
}

export function parseQueryString(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}
