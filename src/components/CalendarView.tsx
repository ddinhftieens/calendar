import { useMemo, useRef, useState } from 'react';
import type { CalEvent, EventType } from '../lib/events';
import { occursOn, WEEKDAYS, pad } from '../lib/events';
import { solarToLunar, yearCanChi, dayCanChi, monthCanChi, tietKhi, gioHoangDao, dayZodiacImage, isHoangDao, tuoiXung } from '../lib/lunar';

interface Props {
  events: CalEvent[];
  typeMap: Record<string, EventType>;
  onOpen: (e: CalEvent) => void;
  onAdd: (preset?: Partial<CalEvent>) => void;
}

const HOLIDAYS_SOLAR: Record<string, string> = {
  '1/1': 'Tết Dương lịch', '14/2': 'Valentine', '8/3': 'Quốc tế Phụ nữ', '30/4': 'Giải phóng miền Nam',
  '1/5': 'Quốc tế Lao động', '1/6': 'Quốc tế Thiếu nhi', '2/9': 'Quốc khánh', '20/10': 'Phụ nữ Việt Nam',
  '20/11': 'Nhà giáo Việt Nam', '24/12': 'Giáng sinh',
};
const HOLIDAYS_LUNAR: Record<string, string> = {
  '1/1': 'Tết Nguyên Đán', '2/1': 'Mùng 2 Tết', '3/1': 'Mùng 3 Tết', '15/1': 'Rằm tháng Giêng',
  '10/3': 'Giỗ Tổ Hùng Vương', '15/4': 'Phật Đản', '5/5': 'Tết Đoan Ngọ', '15/7': 'Vu Lan',
  '15/8': 'Tết Trung Thu', '23/12': 'Ông Công Ông Táo',
};

export function CalendarView({ events, typeMap, onOpen, onAdd }: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
      const evs = events.filter(ev => occursOn(ev, d));
      const holiday = HOLIDAYS_SOLAR[`${d.getDate()}/${d.getMonth() + 1}`] || (!l.leap && HOLIDAYS_LUNAR[`${l.day}/${l.month}`]) || '';
      return { d, l, evs, holiday };
    });
  }, [cursor, events]);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const sel = cells.find(c => sameDay(c.d, selected)) ?? (() => {
    const l = solarToLunar(selected.getDate(), selected.getMonth() + 1, selected.getFullYear());
    return { d: selected, l, evs: events.filter(ev => occursOn(ev, selected)), holiday: '' };
  })();

  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const goToday = () => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); };

  const touchX = useRef<number | null>(null);

  return (
    <div className="calendar">
      <div className="cal-head">
        <div className="cal-title">
          <b>Tháng {cursor.getMonth() + 1}, {cursor.getFullYear()}</b>
          <small>ÂL {sel.l.day}/{sel.l.month}{sel.l.leap ? ' nhuận' : ''} • Năm {yearCanChi(sel.l.year)}</small>
        </div>
        <div className="cal-nav">
          <button className="cal-nav-arrow" onClick={() => move(-1)} aria-label="Tháng trước">‹</button>
          <button className="today-btn" onClick={goToday}>Hôm nay</button>
          <button className="cal-nav-arrow" onClick={() => move(1)} aria-label="Tháng sau">›</button>
        </div>
      </div>

      <div className="cal-grid-wrapper">
        <div className="cal-grid-bg" style={{ backgroundImage: `url(${dayZodiacImage(sel.l.jd)})` }} aria-hidden="true" />
        <div className="cal-grid"
          onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => <div key={w} className={`cal-wd ${w === 'CN' ? 'sun' : ''}`}>{w}</div>)}
          {cells.map(({ d, l, evs, holiday }) => {
            const out = d.getMonth() !== cursor.getMonth();
            const cls = ['cal-cell', out && 'out', sameDay(d, today) && 'today', sameDay(d, selected) && 'selected',
              d.getDay() === 0 && 'sun', holiday && 'holiday'].filter(Boolean).join(' ');
            return (
              <button key={d.toISOString()} className={cls} onClick={() => {
                setSelected(d);
                if (out) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}>
                <span className="sd">{d.getDate()}</span>
                <span className={`ld ${l.day === 1 || l.day === 15 ? 'mark' : ''}`}>{l.day === 1 ? `${l.day}/${l.month}` : l.day}</span>
                {evs.length > 0 && (
                  <span className="dots">
                    {evs.slice(0, 3).map(ev => <i key={ev.id} style={{ background: typeMap[ev.typeId]?.color ?? '#0284c7' }} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="day-detail">
        <div className="dd-head">
          <div className="dd-solar">{WEEKDAYS[sel.d.getDay()]}, {pad(sel.d.getDate())}/{pad(sel.d.getMonth() + 1)}/{sel.d.getFullYear()}</div>
          <div className="dd-badges">
            <span className={`dd-dao ${isHoangDao(sel.l.month, sel.l.jd) ? 'good' : 'bad'}`}>
              {isHoangDao(sel.l.month, sel.l.jd) ? 'Hoàng đạo' : 'Hắc đạo'}
            </span>
            <span className="dd-lunar">ÂL {sel.l.day}/{sel.l.month}{sel.l.leap ? ' (nhuận)' : ''}</span>
          </div>
        </div>
        <div className="dd-meta">
          <div className="dd-meta-item">
            <small>Ngày</small>
            <span>{dayCanChi(sel.l.jd)}</span>
          </div>
          <div className="dd-meta-item">
            <small>Tháng</small>
            <span>{monthCanChi(sel.l.month, sel.l.year)}</span>
          </div>
          <div className="dd-meta-item">
            <small>Tiết khí</small>
            <span>{tietKhi(sel.l.jd)}</span>
          </div>
        </div>

        <div className="dd-xung">
          <small>Tuổi xung</small>
          <span>Tuổi {tuoiXung(sel.l.jd)}</span>
        </div>

        <div className="dd-hours">
          <small>Giờ hoàng đạo</small>
          <div className="dd-hours-list">
            {gioHoangDao(sel.l.jd).map(h => <span key={h}>{h}</span>)}
          </div>
        </div>

        {sel.holiday && <div className="holiday-tag">{sel.holiday}</div>}
        {sel.evs.map(ev => {
          const t = typeMap[ev.typeId];
          return (
            <button key={ev.id} className="dd-event" style={{ ['--c' as string]: t?.color ?? '#0284c7' }} onClick={() => onOpen(ev)}>
              <span className="up-dot" />
              <span className="up-body"><b>{ev.title}</b><small>{t?.name}{ev.time ? ` • ${ev.time}` : ''}</small></span>
            </button>
          );
        })}
        <button className="ghost-btn" onClick={() => onAdd({
          calendar: 'solar', day: sel.d.getDate(), month: sel.d.getMonth() + 1, year: sel.d.getFullYear(),
        })}>+ Thêm sự kiện ngày này</button>
      </section>
    </div>
  );
}
