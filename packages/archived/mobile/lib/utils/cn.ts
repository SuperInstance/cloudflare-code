/**
 * Tailwind CSS class name merger
 *
 * Combines class names using clsx and tailwind-merge.
 */

// @ts-nocheck - External React/Next.js dependencies
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
