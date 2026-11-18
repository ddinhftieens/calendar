import type { CalEvent, EventType } from './events';
import { DEFAULT_TYPES } from './events';

const K_EVENTS = 'cal.events';
const K_TYPES = 'cal.types';
const K_URL = 'cal.sheetUrl';
const K_EMAIL = 'cal.email';

// Có thể điền sẵn URL Web App Apps Script tại đây để mọi thiết bị dùng chung
export const DEFAULT_SHEET_URL = '';

export const local = {
  getEvents: (): CalEvent[] => JSON.parse(localStorage.getItem(K_EVENTS) || '[]'),
  setEvents: (e: CalEvent[]) => localStorage.setItem(K_EVENTS, JSON.stringify(e)),
  getTypes: (): EventType[] => {
    const t = localStorage.getItem(K_TYPES);
    return t ? JSON.parse(t) : DEFAULT_TYPES;
  },
  setTypes: (t: EventType[]) => localStorage.setItem(K_TYPES, JSON.stringify(t)),
  getUrl: () => localStorage.getItem(K_URL) ?? DEFAULT_SHEET_URL,
  setUrl: (u: string) => localStorage.setItem(K_URL, u.trim()),
  getEmail: () => localStorage.getItem(K_EMAIL) ?? '',
  setEmail: (e: string) => localStorage.setItem(K_EMAIL, e.trim()),
};

/**
 * Gọi Apps Script. Dùng Content-Type text/plain để tránh CORS preflight.
 */
async function call<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Lỗi Apps Script');
  return json.data as T;
}

export const sheet = {
  list: (url: string) => call<{ events: CalEvent[]; types: EventType[] | null }>(url, { action: 'list' }),
  saveEvent: (url: string, event: CalEvent) => call(url, { action: 'saveEvent', event }),
  deleteEvent: (url: string, id: string) => call(url, { action: 'deleteEvent', id }),
  saveTypes: (url: string, types: EventType[]) => call(url, { action: 'saveTypes', types }),
  testEmail: (url: string, email: string) => call(url, { action: 'testEmail', email }),
};
