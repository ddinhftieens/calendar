import { useMemo, useState } from 'react';
import type { CalEvent, EventType } from '../lib/events';
import { nextOccurrence, daysBetween, pad } from '../lib/events';

interface Props {
  events: CalEvent[];
  typeMap: Record<string, EventType>;
  onOpen: (e: CalEvent) => void;
}

const REPEAT_LABEL = { yearly: 'Hằng năm', monthly: 'Hằng tháng', none: 'Một lần' };

export function EventList({ events, typeMap, onOpen }: Props) {
  const [filter, setFilter] = useState('all');
  const now = new Date();

  const list = useMemo(() => events
    .filter(e => filter === 'all' || e.typeId === filter)
    .map(ev => ({ ev, occ: nextOccurrence(ev, now) }))
    .sort((a, b) => (a.occ?.getTime() ?? Infinity) - (b.occ?.getTime() ?? Infinity)), [events, filter]);

  const usedTypes = Object.values(typeMap).filter(t => events.some(e => e.typeId === t.id));

  return (
    <div className="event-list">
      {usedTypes.length > 0 && (
        <div className="chips-scroll">
          <button className={`chip-btn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>Tất cả ({events.length})</button>
          {usedTypes.map(t => (
            <button key={t.id} className={`chip-btn ${filter === t.id ? 'on' : ''}`} style={{ ['--c' as string]: t.color }}
              onClick={() => setFilter(t.id)}>{t.name}</button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <section className="empty-card">
          <h3>Chưa có sự kiện nào</h3>
          <p>Nhấn nút + bên dưới để thêm sự kiện mới</p>
        </section>
      ) : (
        list.map(({ ev, occ }) => {
          const t = typeMap[ev.typeId];
          const days = occ ? daysBetween(now, occ) : null;
          return (
            <button key={ev.id} className="ev-card" style={{ ['--c' as string]: t?.color ?? '#0284c7' }} onClick={() => onOpen(ev)}>
              <div className="ev-date-box">
                <b>{occ ? occ.getDate() : pad(ev.day)}</b>
                <span>Thg {occ ? occ.getMonth() + 1 : ev.month}</span>
              </div>
              <div className="ev-info">
                <div className="ev-title-row">
                  <b>{ev.title}</b>
                  {t && <span className="ev-tag">{t.name}</span>}
                </div>
                <small>
                  {ev.calendar === 'lunar' ? `ÂL ${pad(ev.day)}/${pad(ev.month)} • ` : ''}
                  {REPEAT_LABEL[ev.repeat]}{ev.time ? ` • ${ev.time}` : ''}
                </small>
              </div>
              <div className={`ev-badge ${days !== null && days <= 3 ? 'soon' : ''}`}>
                {days === null ? 'Đã qua' : days === 0 ? 'Hôm nay' : `${days} ngày`}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
