import { format, formatDistanceToNow, differenceInHours, parseISO } from 'date-fns';
import type { ConfidenceLevel } from '@/types/case';

export function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string, fmt: string = 'dd MMM yyyy'): string {
  return format(parseISO(dateString), fmt);
}

export function formatDateTime(dateString: string): string {
  return format(parseISO(dateString), 'dd MMM yyyy, HH:mm');
}

export function formatRelativeTime(dateString: string): string {
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getSlaStatus(deadline: string): { label: string; variant: 'default' | 'warning' | 'danger' } {
  const hoursLeft = differenceInHours(parseISO(deadline), new Date());
  if (hoursLeft < 0) return { label: `${Math.abs(hoursLeft)}h overdue`, variant: 'danger' };
  if (hoursLeft < 8) return { label: `${hoursLeft}h left`, variant: 'warning' };
  return { label: `${hoursLeft}h left`, variant: 'default' };
}

export function formatConfidence(score: number): string {
  // Score can be 0-1 or 0-100; normalize to percentage with 2 decimals
  const pct = score <= 1 ? score * 100 : score;
  return pct.toFixed(2);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-AU').format(num);
}
