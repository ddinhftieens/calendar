export interface ConfirmState {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface Props {
  state: ConfirmState | null;
  onClose: () => void;
}

export function ConfirmDialog({ state, onClose }: Props) {
  if (!state) return null;
  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{state.title || 'Xác nhận'}</h3>
        <p>{state.message}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onClose}>Huỷ</button>
          <button
            type="button"
            className={state.danger ? 'confirm-danger' : 'confirm-ok'}
            onClick={() => { state.onConfirm(); onClose(); }}
          >
            {state.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
