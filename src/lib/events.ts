import { lunarToSolar, solarToLunar, lunarMonthLength } from './lunar';

export interface EventType { id: string; name: string; icon: string; color: string }

export interface CalEvent {
  id: string;
  title: string;
  typeId: string;
  calendar: 'solar' | 'lunar';
  day: number;
  month: number;
  year: number;
  leap: boolean;           // tháng nhuận (chỉ với âm lịch)
  time: string;            // HH:mm
  repeat: 'yearly' | 'monthly' | 'none';
  reminders: number[];     // số ngày báo trước, ví dụ [3,2,1,0]
  notifyEmail: string;     // email nhận cảnh báo (Apps Script gửi)
  note: string;
  updatedAt: number;
}

export const DEFAULT_TYPES: EventType[] = [
  { id: 'gio', name: 'Ngày giỗ', icon: '', color: '#64748b' },
  { id: 'cuoi', name: 'Ngày cưới', icon: '', color: '#ec4899' },
  { id: 'kiniem', name: 'Kỷ niệm', icon: '', color: '#f43f5e' },
  { id: 'sinhnhat', name: 'Sinh nhật', icon: '', color: '#f59e0b' },
  { id: 'le', name: 'Ngày lễ', icon: '', color: '#10b981' },
  { id: 'hop', name: 'Công việc', icon: '', color: '#3b82f6' },
  { id: 'khac', name: 'Khác', icon: '', color: '#0284c7' },
];

export const REMINDER_PRESETS = [7, 3, 2, 1, 0];
export const DEFAULT_REMINDERS = [3, 2, 1, 0];

/** Tính lần diễn ra kế tiếp (>= đầu ngày hôm nay) */
export function nextOccurrence(ev: CalEvent, from = new Date()): Date | null {
  const [hh, mi] = (ev.time || '00:00').split(':').map(Number);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const mk = (d: number, m: number, y: number) => new Date(y, m - 1, d, hh || 0, mi || 0);

  if (ev.calendar === 'solar') {
    if (ev.repeat === 'none') {
      const d = mk(ev.day, ev.month, ev.year);
      return d >= today ? d : null;
    }
    if (ev.repeat === 'monthly') {
      for (let i = 0; i < 14; i++) {
        const y = today.getFullYear(), m = today.getMonth() + 1 + i;
        const dim = new Date(y, m, 0).getDate();
        const d = new Date(y, m - 1, Math.min(ev.day, dim), hh || 0, mi || 0);
        if (d >= today) return d;
      }
      return null;
    }
    for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) {
      const dim = new Date(y, ev.month, 0).getDate();
      const d = mk(Math.min(ev.day, dim), ev.month, y);
      if (d >= today) return d;
    }
    return null;
  }

  // Âm lịch
  const tl = solarToLunar(today.getDate(), today.getMonth() + 1, today.getFullYear());
  const conv = (d: number, m: number, y: number, leap: boolean) => {
    const day = Math.min(d, lunarMonthLength(m, y, leap));
    const s = lunarToSolar(day, m, y, leap) ?? lunarToSolar(day, m, y, false);
    return s ? mk(s[0], s[1], s[2]) : null;
  };
  if (ev.repeat === 'none') {
    const d = conv(ev.day, ev.month, ev.year, ev.leap);
    return d && d >= today ? d : null;
  }
  if (ev.repeat === 'monthly') {
    let m = tl.month, y = tl.year;
    for (let i = 0; i < 14; i++) {
      const d = conv(ev.day, m, y, false);
      if (d && d >= today) return d;
      m++; if (m > 12) { m = 1; y++; }
    }
    return null;
  }
  // Hằng năm: giỗ/kỷ niệm âm lịch - dùng tháng thường (tháng nhuận dùng tháng chính)
  for (let y = tl.year - 1; y <= tl.year + 2; y++) {
    const d = conv(ev.day, ev.month, y, false);
    if (d && d >= today) return d;
  }
  return null;
}

/** Ngày diễn ra (dương) của sự kiện trong một tháng dương lịch - dùng cho lưới lịch */
export function occursOn(ev: CalEvent, date: Date): boolean {
  const n = nextOccurrence(ev, date);
  return !!n && n.getFullYear() === date.getFullYear() && n.getMonth() === date.getMonth() && n.getDate() === date.getDate();
}

export const daysBetween = (a: Date, b: Date) => {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db.getTime() - da.getTime()) / 86400000);
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const pad = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** Số năm kể từ năm gốc (giỗ lần thứ / kỷ niệm năm thứ) */
export function anniversaryCount(ev: CalEvent, occ: Date): number | null {
  if (ev.repeat !== 'yearly' || !ev.year) return null;
  if (ev.calendar === 'solar') return occ.getFullYear() - ev.year;
  const l = solarToLunar(occ.getDate(), occ.getMonth() + 1, occ.getFullYear());
  return l.year - ev.year;
}
