import { useMemo, useState } from 'react';
import type { CalEvent, EventType } from '../lib/events';
import { DEFAULT_REMINDERS, REMINDER_PRESETS, uid, pad, WEEKDAYS } from '../lib/events';
import { lunarToSolar, solarToLunar } from '../lib/lunar';
import { local } from '../lib/storage';
import type { ConfirmState } from './ConfirmDialog';

interface Props {
  initial: Partial<CalEvent>;
  types: EventType[];
  onTypes: (t: EventType[]) => void;
  onSave: (e: CalEvent) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onConfirm: (c: ConfirmState) => void;
}

const COLORS = ['#0284c7', '#06b6d4', '#0ea5e9', '#1e40af', '#10b981', '#ec4899', '#f59e0b', '#64748b'];

export function EventForm({ initial, types, onTypes, onSave, onDelete, onClose, onConfirm }: Props) {
  const today = new Date();
  const [ev, setEv] = useState<CalEvent>(() => ({
    id: uid(), title: '', typeId: types[0]?.id ?? 'khac', calendar: 'solar',
    day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear(), leap: false,
    time: '', repeat: 'yearly', reminders: DEFAULT_REMINDERS, notifyEmail: local.getEmail(), note: '',
    updatedAt: Date.now(), ...initial,
  } as CalEvent));
  const isEdit = !!initial.id;
  const [newType, setNewType] = useState<{ name: string; icon: string; color: string } | null>(null);
  const set = <K extends keyof CalEvent>(k: K, v: CalEvent[K]) => setEv(e => ({ ...e, [k]: v }));

  const switchCalendar = (c: 'solar' | 'lunar') => {
    if (c === ev.calendar) return;
    if (c === 'lunar') {
      const l = solarToLunar(ev.day, ev.month, ev.year);
      setEv(e => ({ ...e, calendar: 'lunar', day: l.day, month: l.month, year: l.year, leap: l.leap }));
    } else {
      const s = lunarToSolar(ev.day, ev.month, ev.year, ev.leap) ?? lunarToSolar(ev.day, ev.month, ev.year, false);
      if (s) setEv(e => ({ ...e, calendar: 'solar', day: s[0], month: s[1], year: s[2], leap: false }));
      else set('calendar', 'solar');
    }
  };

  const solarValue = `${ev.year}-${pad(ev.month)}-${pad(ev.day)}`;
  const preview = useMemo(() => {
    if (ev.calendar === 'solar') {
      const l = solarToLunar(ev.day, ev.month, ev.year);
      return `Âm lịch: ${l.day}/${l.month}${l.leap ? ' nhuận' : ''}/${l.year}`;
    }
    const s = lunarToSolar(ev.day, ev.month, ev.year, ev.leap);
    return s ? `Dương lịch: ${WEEKDAYS[new Date(s[2], s[1] - 1, s[0]).getDay()]}, ${pad(s[0])}/${pad(s[1])}/${s[2]}` : 'Năm này không có tháng nhuận đó';
  }, [ev.calendar, ev.day, ev.month, ev.year, ev.leap]);

  const toggleReminder = (d: number) =>
    set('reminders', ev.reminders.includes(d) ? ev.reminders.filter(x => x !== d) : [...ev.reminders, d].sort((a, b) => b - a));

  const addType = () => {
    if (!newType?.name.trim()) return;
    const t: EventType = { id: uid(), name: newType.name.trim(), icon: newType.icon || '📌', color: newType.color };
    onTypes([...types, t]);
    set('typeId', t.id);
    setNewType(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ev.title.trim()) return alert('Vui lòng nhập tên sự kiện');
    onConfirm({
      title: isEdit ? 'Lưu thay đổi' : 'Tạo sự kiện',
      message: isEdit ? 'Xác nhận lưu thay đổi sự kiện này?' : 'Xác nhận tạo sự kiện mới?',
      confirmText: isEdit ? 'Lưu' : 'Tạo',
      onConfirm: () => {
        if (ev.notifyEmail) local.setEmail(ev.notifyEmail);
        onSave({ ...ev, title: ev.title.trim(), updatedAt: Date.now() });
      },
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="sheet" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{isEdit ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <label className="field">
          <span>Tên sự kiện</span>
          <input autoFocus={!isEdit} value={ev.title} onChange={e => set('title', e.target.value)} placeholder="Nhập tên sự kiện" />
        </label>

        <div className="field">
          <span>Loại</span>
          <div className="type-chips">
            {types.map(t => (
              <button type="button" key={t.id} className={`type-chip ${ev.typeId === t.id ? 'on' : ''}`}
                style={{ ['--c' as string]: t.color }} onClick={() => set('typeId', t.id)}>
                <i className="type-dot" style={{ background: t.color }} />
                {t.name}
              </button>
            ))}
            <button type="button" className="type-chip add" onClick={() => setNewType({ name: '', icon: '', color: COLORS[0] })}>
              + Mới
            </button>
          </div>
          {newType && (
            <div className="new-type">
              <div className="new-type-row">
                <input placeholder="Tên loại mới" value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} />
                <button type="button" className="primary sm" onClick={addType}>Thêm</button>
                <button type="button" className="icon-btn sm" onClick={() => setNewType(null)} aria-label="Huỷ">✕</button>
              </div>
              <div className="colors">
                {COLORS.map(c => <i key={c} className={newType.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setNewType({ ...newType, color: c })} />)}
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <span>Loại lịch</span>
          <div className="segmented">
            <button type="button" className={ev.calendar === 'solar' ? 'on' : ''} onClick={() => switchCalendar('solar')}>Dương lịch</button>
            <button type="button" className={ev.calendar === 'lunar' ? 'on' : ''} onClick={() => switchCalendar('lunar')}>Âm lịch</button>
          </div>
        </div>

        <div className={ev.calendar === 'lunar' ? 'date-grid-lunar' : 'date-grid-solar'}>
          {ev.calendar === 'solar' ? (
            <label className="field">
              <span>Ngày</span>
              <input type="date" value={solarValue} onChange={e => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                if (y) setEv(x => ({ ...x, day: d, month: m, year: y }));
              }} />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Ngày ÂL</span>
                <select value={ev.day} onChange={e => set('day', +e.target.value)}>
                  {Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Tháng ÂL</span>
                <select value={ev.month} onChange={e => set('month', +e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Năm</span>
                <input type="number" value={ev.year} onChange={e => set('year', +e.target.value)} />
              </label>
            </>
          )}
          <label className="field">
            <span>Giờ</span>
            <input type="time" value={ev.time} onChange={e => set('time', e.target.value)} />
          </label>
        </div>
        {ev.calendar === 'lunar' && (
          <label className="check"><input type="checkbox" checked={ev.leap} onChange={e => set('leap', e.target.checked)} /> Tháng nhuận</label>
        )}
        <div className="preview">{preview}</div>

        <div className="field">
          <span>Lặp lại</span>
          <div className="segmented">
            {([['yearly', 'Hằng năm'], ['monthly', 'Hằng tháng'], ['none', 'Một lần']] as const).map(([v, l]) => (
              <button type="button" key={v} className={ev.repeat === v ? 'on' : ''} onClick={() => set('repeat', v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Nhắc trước</span>
          <div className="chips-wrap">
            {REMINDER_PRESETS.map(d => (
              <button type="button" key={d} className={`chip-btn sm ${ev.reminders.includes(d) ? 'on' : ''}`} onClick={() => toggleReminder(d)}>
                {d === 0 ? 'Đúng ngày' : `${d} ngày`}
              </button>
            ))}
          </div>
          <input type="email" placeholder="Email (tuỳ chọn)" value={ev.notifyEmail}
            onChange={e => set('notifyEmail', e.target.value)} />
        </div>

        <label className="field">
          <span>Ghi chú</span>
          <textarea rows={2} value={ev.note} onChange={e => set('note', e.target.value)} placeholder="Ghi chú thêm..." />
        </label>

        <div className="sheet-actions">
          {isEdit && (
            <button type="button" className="danger" onClick={() => onDelete(ev.id)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Xoá
            </button>
          )}
          <button type="submit" className="primary grow">{isEdit ? 'Lưu thay đổi' : 'Tạo sự kiện'}</button>
        </div>
      </form>
    </div>
  );
}
