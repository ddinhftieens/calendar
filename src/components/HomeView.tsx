import { useEffect, useMemo, useState } from 'react';
import type { CalEvent, EventType } from '../lib/events';
import { nextOccurrence, daysBetween, fmtDate, WEEKDAYS, anniversaryCount, pad } from '../lib/events';
import { solarToLunar, yearCanChi, dayCanChi, monthCanChi, tietKhi } from '../lib/lunar';

interface Props {
  events: CalEvent[];
  typeMap: Record<string, EventType>;
  onOpen: (e: CalEvent) => void;
  onAdd: () => void;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (id === undefined) id = setInterval(() => setNow(new Date()), ms); };
    const stop = () => { if (id !== undefined) { clearInterval(id); id = undefined; } };
    const onVis = () => { if (document.hidden) stop(); else { setNow(new Date()); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [ms]);
  return now;
}

export function HomeView({ events, typeMap, onOpen, onAdd }: Props) {
  // Tick theo giây chỉ để đồng hồ/đếm ngược; danh sách tính lại theo ngày (dayKey)
  const now = useNow();
  const dayKey = now.toDateString();
  const lunar = useMemo(() => solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear()), [dayKey]);

  const upcoming = useMemo(() => events
    .map(ev => ({ ev, occ: nextOccurrence(ev, new Date()) }))
    .filter((x): x is { ev: CalEvent; occ: Date } => !!x.occ)
    .sort((a, b) => a.occ.getTime() - b.occ.getTime()), [events, dayKey]);

  const hero = upcoming[0];
  const rest = useMemo(() => upcoming.slice(1, 20), [upcoming]);

  return (
    <div className="home">
      <section className="today-card">
        <div className="today-top">
          <div>
            <div className="weekday">{WEEKDAYS[now.getDay()]}</div>
            <div className="month-year">Tháng {now.getMonth() + 1}, {now.getFullYear()}</div>
          </div>
          <div className="clock">{pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}</div>
        </div>

        <div className="today-main">
          <div className="today-solar-num">
            <span className="today-label">Dương lịch</span>
            <div className="big-day">{now.getDate()}</div>
          </div>
          <div className="today-lunar-box">
            <span className="today-label">Âm lịch</span>
            <div className="lunar-row">
              <span className="lunar-day">{lunar.day}</span>
              <span className="lunar-month">/ Tháng {lunar.month}{lunar.leap ? ' (nhuận)' : ''}</span>
            </div>
          </div>
        </div>

        <div className="canchi-bar">
          <span>Năm {yearCanChi(lunar.year)}</span>
          <span>Tháng {monthCanChi(lunar.month, lunar.year)}</span>
          <span>Ngày {dayCanChi(lunar.jd)}</span>
          <span>Tiết {tietKhi(lunar.jd)}</span>
        </div>
      </section>

      {hero ? (
        <HeroCountdown ev={hero.ev} occ={hero.occ} now={now} type={typeMap[hero.ev.typeId]} onClick={() => onOpen(hero.ev)} />
      ) : (
        <section className="empty-card" onClick={onAdd}>
          <h3>Chưa có sự kiện nào</h3>
          <p>Nhấn để thêm ngày giỗ, ngày cưới, sinh nhật, kỷ niệm...</p>
        </section>
      )}

      {upcoming.length > 1 && (
        <section>
          <h2 className="section-title">Sắp diễn ra</h2>
          <div className="upcoming-list">
            {rest.map(({ ev, occ }) => (
              <UpcomingItem key={ev.id} ev={ev} occ={occ} now={now} type={typeMap[ev.typeId]} onClick={() => onOpen(ev)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function splitTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function eventSub(ev: CalEvent, occ: Date) {
  const n = anniversaryCount(ev, occ);
  const lunar = ev.calendar === 'lunar' ? ` • ÂL ${ev.day}/${ev.month}` : '';
  const label = n && n > 0 ? ` • ${ev.typeId === 'gio' ? 'Giỗ lần' : 'Năm thứ'} ${n}` : '';
  return `${WEEKDAYS[occ.getDay()]}, ${fmtDate(occ)}${lunar}${label}`;
}

function HeroCountdown({ ev, occ, now, type, onClick }: { ev: CalEvent; occ: Date; now: Date; type?: EventType; onClick: () => void }) {
  const days = daysBetween(now, occ);
  const t = splitTime(occ.getTime() - now.getTime());
  const color = type?.color ?? '#0284c7';
  return (
    <section className="hero" style={{ ['--c' as string]: color }} onClick={onClick}>
      <div className="hero-top">
        <span className="chip">{type?.name ?? 'Sự kiện'}</span>
        <span className="hero-next">Gần nhất</span>
      </div>
      <h2 className="hero-title">{ev.title}</h2>
      <div className="hero-sub">{eventSub(ev, occ)}{ev.time && ` • ${ev.time}`}</div>
      {days === 0 && occ.getTime() <= now.getTime() ? (
        <div className="hero-today">Đang diễn ra hôm nay!</div>
      ) : (
        <div className="countdown">
          {([['d', 'Ngày'], ['h', 'Giờ'], ['m', 'Phút'], ['s', 'Giây']] as const).map(([k, l]) => (
            <div key={k} className="cd-box">
              <span className="cd-num">{pad(t[k])}</span>
              <span className="cd-label">{l}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UpcomingItem({ ev, occ, now, type, onClick }: { ev: CalEvent; occ: Date; now: Date; type?: EventType; onClick: () => void }) {
  const days = daysBetween(now, occ);
  const t = splitTime(occ.getTime() - now.getTime());
  const color = type?.color ?? '#0284c7';
  return (
    <button className="up-item" style={{ ['--c' as string]: color }} onClick={onClick}>
      <span className="up-dot" />
      <span className="up-body">
        <b>{ev.title}</b>
        <small>{eventSub(ev, occ)}{ev.time ? ` • ${ev.time}` : ''}</small>
      </span>
      <span className={`up-count ${days <= 3 ? 'soon' : ''}`}>
        {days === 0 ? <><b>Hôm nay</b><small>{pad(t.h)}:{pad(t.m)}:{pad(t.s)}</small></>
          : <><b>{days}</b><small>ngày</small></>}
      </span>
    </button>
  );
}
