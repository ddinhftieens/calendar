import { useState } from 'react';
import type { EventType } from '../lib/events';
import { local, sheet } from '../lib/storage';
import type { ConfirmState } from './ConfirmDialog';

interface Props {
  url: string;
  onUrl: (u: string) => void;
  types: EventType[];
  onTypes: (t: EventType[]) => void;
  onPull: () => void;
  onPushAll: () => void;
  syncError: string;
  toast: (s: string) => void;
  onConfirm: (c: ConfirmState) => void;
}

export function SettingsView({ url, onUrl, types, onTypes, onPull, onPushAll, syncError, toast, onConfirm }: Props) {
  const [draft, setDraft] = useState(url);
  const [email, setEmail] = useState(local.getEmail());
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  const askPerm = async () => {
    if (typeof Notification === 'undefined') return toast('Trình duyệt không hỗ trợ');
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') new Notification('Lịch sự kiện', { body: 'Đã bật thông báo!' });
  };

  const testMail = async () => {
    if (!url || !email) return toast('Cần nhập URL và email');
    local.setEmail(email);
    try { await sheet.testEmail(url, email); toast('Đã gửi email thử'); }
    catch (e) { toast(String(e)); }
  };

  return (
    <div className="settings">
      <section className="card">
        <h3>Google Sheet</h3>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="URL Web App Apps Script (/exec)" />
        {syncError && <p className="err">{syncError}</p>}
        <div className="row">
          <button className="primary grow" onClick={() => onConfirm({
            title: 'Lưu kết nối',
            message: 'Lưu và kết nối URL Google Sheet này?',
            confirmText: 'Lưu',
            onConfirm: () => { onUrl(draft); toast('Đã lưu URL'); },
          })}>Lưu & kết nối</button>
        </div>
        {url && (
          <div className="row">
            <button className="ghost-btn grow" onClick={onPull}>Tải về</button>
            <button className="ghost-btn grow" onClick={() => onConfirm({
              title: 'Đẩy dữ liệu',
              message: 'Đẩy toàn bộ dữ liệu lên Google Sheet?',
              confirmText: 'Đẩy lên',
              onConfirm: onPushAll,
            })}>Đẩy lên</button>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Cảnh báo</h3>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email nhận nhắc nhở" />
        <div className="row">
          <button className="ghost-btn grow" onClick={() => { local.setEmail(email); toast('Đã lưu email'); }}>Lưu email</button>
          <button className="ghost-btn grow" onClick={testMail}>Gửi thử</button>
        </div>
        <button className="ghost-btn" onClick={askPerm} disabled={perm === 'granted'}>
          {perm === 'granted' ? 'Đã bật thông báo trình duyệt' : perm === 'denied' ? 'Thông báo đang bị chặn' : 'Bật thông báo trình duyệt'}
        </button>
      </section>

      <section className="card">
        <h3>Loại sự kiện</h3>
        {types.map((t, i) => (
          <div key={t.id} className="type-row">
            <input value={t.name} onChange={e => onTypes(types.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input type="color" value={t.color} onChange={e => onTypes(types.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
            <button className="icon-btn danger-icon" onClick={() => onConfirm({
              title: 'Xoá loại sự kiện',
              message: `Bạn có chắc muốn xoá loại "${t.name}"?`,
              confirmText: 'Xoá',
              danger: true,
              onConfirm: () => onTypes(types.filter(x => x.id !== t.id)),
            })} aria-label="Xoá">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        ))}
        <button className="ghost-btn" onClick={() => onTypes([...types, { id: Date.now().toString(36), name: 'Loại mới', icon: '', color: '#0284c7' }])}>+ Thêm loại</button>
      </section>
    </div>
  );
}
