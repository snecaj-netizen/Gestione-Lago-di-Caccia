import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a full name to "First Name + L." (e.g. "Stefano Necaj" -> "Stefano N.")
 */
export function formatUserName(fullName: string | undefined | null): string {
  if (!fullName) return '---';
  const trimmed = fullName.trim();
  if (!trimmed) return '---';
  
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName} ${lastName.charAt(0)}.`;
}
