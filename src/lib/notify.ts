import { useEffect } from 'react';
import type { CalEvent, EventType } from './events';
import { daysBetween, nextOccurrence, fmtDate } from './events';

const K_SENT = 'cal.notified';

/** Thông báo trình duyệt khi app đang mở (bổ sung cho email từ Apps Script) */
export function useBrowserReminders(events: CalEvent[], types: EventType[]) {
  useEffect(() => {
    const check = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const sent: string[] = JSON.parse(localStorage.getItem(K_SENT) || '[]').filter((k: string) => k.startsWith(todayKey));
      for (const ev of events) {
        const occ = nextOccurrence(ev, now);
        if (!occ) continue;
        const diff = daysBetween(now, occ);
        if (!ev.reminders.includes(diff)) continue;
        // Ngày diễn ra: chờ đến 1 tiếng trước giờ sự kiện (nếu có giờ)
        if (diff === 0 && ev.time && occ.getTime() - now.getTime() > 3600000) continue;
        const key = `${todayKey}|${ev.id}|${diff}`;
        if (sent.includes(key)) continue;
        const t = types.find(x => x.id === ev.typeId);
        const body = `${t ? t.icon + ' ' + t.name + ' • ' : ''}${fmtDate(occ)}${ev.time ? ' ' + ev.time : ''}`;
        try {
          new Notification(diff === 0 ? `🔔 Hôm nay: ${ev.title}` : `⏰ Còn ${diff} ngày: ${ev.title}`, { body, tag: key });
        } catch { /* mobile cần service worker - bỏ qua */ }
        sent.push(key);
      }
      localStorage.setItem(K_SENT, JSON.stringify(sent));
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [events, types]);
}
