import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalEvent, EventType } from './lib/events';
import { local, sheet, mergeEvents } from './lib/storage';
import { HomeView } from './components/HomeView';
import { CalendarView } from './components/CalendarView';
import { EventList } from './components/EventList';
import { EventForm } from './components/EventForm';
import { SettingsView } from './components/SettingsView';
import { ConfirmDialog, type ConfirmState } from './components/ConfirmDialog';

type Tab = 'home' | 'calendar' | 'events' | 'settings';
type SyncState = 'local' | 'syncing' | 'ok' | 'error';

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [events, setEvents] = useState<CalEvent[]>(local.getEvents);
  const [types, setTypes] = useState<EventType[]>(local.getTypes);
  const [url, setUrl] = useState(local.getUrl);
  const [sync, setSync] = useState<SyncState>(url ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState('');
  const [editing, setEditing] = useState<Partial<CalEvent> | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => local.setEvents(events), [events]);
  useEffect(() => local.setTypes(types), [types]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Khóa scroll nền khi mở modal (iOS Safari cần position: fixed)
  useEffect(() => {
    if (!editing) return;
    const y = window.scrollY;
    const b = document.body.style;
    b.overflow = 'hidden'; b.position = 'fixed'; b.top = `-${y}px`; b.width = '100%';
    return () => {
      b.overflow = ''; b.position = ''; b.top = ''; b.width = '';
      window.scrollTo(0, y);
    };
  }, [editing]);

  const pullSeq = useRef(0);
  const lastPull = useRef(0);
  const pull = useCallback(async () => {
    if (!url) { setSync('local'); return; }
    const seq = ++pullSeq.current;
    setSync('syncing');
    try {
      const data = await sheet.list(url);
      if (seq !== pullSeq.current) return; // bỏ kết quả cũ nếu có lần pull mới hơn
      lastPull.current = Date.now();
      setEvents(cur => mergeEvents(cur, data.events));
      if (data.types?.length) setTypes(data.types);
      setSync('ok');
      setSyncError('');
    } catch (e) {
      if (seq !== pullSeq.current) return;
      setSync('error');
      setSyncError(String(e));
    }
  }, [url]);

  useEffect(() => { pull(); }, [pull]);

  // Quay lại từ nền / có mạng lại: đồng bộ (tối đa 1 lần / 60s)
  useEffect(() => {
    const refresh = () => {
      if (document.hidden || !navigator.onLine) return;
      if (Date.now() - lastPull.current > 60000) pull();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [pull]);

  const remote = async (fn: () => Promise<unknown>) => {
    if (!url) return;
    setSync('syncing');
    try { await fn(); setSync('ok'); }
    catch (e) { setSync('error'); setSyncError(String(e)); setToast('Lỗi đồng bộ Google Sheet'); }
  };

  const saveEvent = (ev: CalEvent) => {
    setEvents(list => {
      const i = list.findIndex(x => x.id === ev.id);
      return i >= 0 ? list.map(x => (x.id === ev.id ? ev : x)) : [...list, ev];
    });
    setEditing(null);
    setToast('Đã lưu sự kiện');
    remote(() => sheet.saveEvent(url, ev));
  };

  const deleteEvent = (id: string) => {
    setConfirmState({
      title: 'Xoá sự kiện',
      message: 'Bạn có chắc muốn xoá sự kiện này không?',
      confirmText: 'Xoá',
      danger: true,
      onConfirm: () => {
        setEvents(list => list.filter(x => x.id !== id));
        setEditing(null);
        setToast('Đã xoá');
        remote(() => sheet.deleteEvent(url, id));
      },
    });
  };

  const saveTypes = (t: EventType[]) => {
    setTypes(t);
    remote(() => sheet.saveTypes(url, t));
  };

  const saveUrl = (u: string) => { local.setUrl(u); setUrl(u.trim()); };

  const pushAll = async () => {
    await remote(async () => {
      await sheet.saveTypes(url, types);
      // Gửi theo lô nhỏ để nhanh hơn nhưng không quá tải mạng di động
      for (let i = 0; i < events.length; i += 3) {
        await Promise.all(events.slice(i, i + 3).map(ev => sheet.saveEvent(url, ev)));
      }
    });
    setToast('Đã đẩy toàn bộ dữ liệu lên Sheet');
  };

  const typeMap = useMemo(() => Object.fromEntries(types.map(t => [t.id, t])), [types]);
  const openNew = (preset?: Partial<CalEvent>) => setEditing(preset ?? {});

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
          <div>
            <h1>Âm lịch</h1>
          </div>
        </div>
        <button className={`sync sync-${sync}`} onClick={pull} title={syncError || 'Đồng bộ'}>
          <span className={`sync-dot ${sync === 'syncing' ? 'spin' : ''}`} />
          <span>{sync === 'local' ? 'Offline' : sync === 'syncing' ? 'Đang đồng bộ' : sync === 'ok' ? 'Đã đồng bộ' : 'Lỗi'}</span>
        </button>
      </header>

      <main className="content">
        {tab === 'home' && <HomeView events={events} typeMap={typeMap} onOpen={setEditing} onAdd={() => openNew()} />}
        {tab === 'calendar' && <CalendarView events={events} typeMap={typeMap} onOpen={setEditing} onAdd={openNew} />}
        {tab === 'events' && <EventList events={events} typeMap={typeMap} onOpen={setEditing} />}
        {tab === 'settings' && (
          <SettingsView url={url} onUrl={saveUrl} types={types} onTypes={saveTypes}
            onPull={pull} onPushAll={pushAll} syncError={sync === 'error' ? syncError : ''}
            toast={setToast} onConfirm={setConfirmState} />
        )}
      </main>

      {tab !== 'settings' && (
        <button className="fab" onClick={() => openNew()} aria-label="Thêm sự kiện">+</button>
      )}

      <nav className="bottomnav">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
          <span>Trang chủ</span>
        </button>
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Lịch</span>
        </button>
        <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span>Sự kiện</span>
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.4 1.13.2.04.41.06.62.06H21a2 2 0 0 1 0 4h-.09c-.66 0-1.26.39-1.51 1z" />
          </svg>
          <span>Cài đặt</span>
        </button>
      </nav>

      {editing && (
        <EventForm initial={editing} types={types} onTypes={saveTypes}
          onSave={saveEvent} onDelete={deleteEvent} onClose={() => setEditing(null)} onConfirm={setConfirmState} />
      )}
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
