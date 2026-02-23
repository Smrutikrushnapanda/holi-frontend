import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prefer explicit env; otherwise use same-origin `/api` which is rewritten in next.config.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  '/api';
