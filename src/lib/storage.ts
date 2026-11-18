import type { CalEvent, EventType } from './events';
import { DEFAULT_TYPES } from './events';

const K_EVENTS = 'cal.events';
const K_TYPES = 'cal.types';
const K_URL = 'cal.sheetUrl';
const K_EMAIL = 'cal.email';

// Có thể điền sẵn URL Web App Apps Script tại đây để mọi thiết bị dùng chung
export const DEFAULT_SHEET_URL = '';

/** Đọc localStorage an toàn (Safari riêng tư / dữ liệu hỏng không làm app trắng màn hình) */
export function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function safeSet(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
export function safeJson<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch { return fallback; }
}

export const local = {
  getEvents: (): CalEvent[] => {
    const v = safeJson<unknown>(K_EVENTS, []);
    return Array.isArray(v) ? (v as CalEvent[]) : [];
  },
  setEvents: (e: CalEvent[]) => { safeSet(K_EVENTS, JSON.stringify(e)); },
  getTypes: (): EventType[] => {
    const v = safeJson<unknown>(K_TYPES, null);
    return Array.isArray(v) && v.length ? (v as EventType[]) : DEFAULT_TYPES;
  },
  setTypes: (t: EventType[]) => { safeSet(K_TYPES, JSON.stringify(t)); },
  getUrl: () => safeGet(K_URL) ?? DEFAULT_SHEET_URL,
  setUrl: (u: string) => { safeSet(K_URL, u.trim()); },
  getEmail: () => safeGet(K_EMAIL) ?? '',
  setEmail: (e: string) => { safeSet(K_EMAIL, e.trim()); },
};

/** Gộp dữ liệu từ xa và cục bộ theo updatedAt (bản mới hơn thắng) - tránh mất sự kiện tạo lúc offline */
export function mergeEvents(localList: CalEvent[], remote: CalEvent[]): CalEvent[] {
  const map = new Map<string, CalEvent>();
  for (const e of remote) map.set(e.id, e);
  for (const e of localList) {
    const r = map.get(e.id);
    if (!r || (e.updatedAt || 0) > (r.updatedAt || 0)) map.set(e.id, e);
  }
  return [...map.values()];
}

/**
 * Gọi Apps Script. Dùng Content-Type text/plain để tránh CORS preflight.
 * Có timeout để không treo khi mạng di động yếu.
 */
async function call<T>(url: string, body: object, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Lỗi Apps Script');
    return json.data as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Hết thời gian chờ');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const sheet = {
  list: (url: string) => call<{ events: CalEvent[]; types: EventType[] | null }>(url, { action: 'list' }),
  saveEvent: (url: string, event: CalEvent) => call(url, { action: 'saveEvent', event }),
  deleteEvent: (url: string, id: string) => call(url, { action: 'deleteEvent', id }),
  saveTypes: (url: string, types: EventType[]) => call(url, { action: 'saveTypes', types }),
  testEmail: (url: string, email: string) => call(url, { action: 'testEmail', email }),
};
