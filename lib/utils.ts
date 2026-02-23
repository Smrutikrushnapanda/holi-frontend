import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prefer explicit env; fall back to deployed backend to avoid localhost in production builds.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'https://holi-backend-production.up.railway.app/api';
