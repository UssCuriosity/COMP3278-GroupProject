// Small presentational building blocks: icons, dialogs, toasts, form fields.
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { errorMessage } from './api';

const ICONS = {
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.5 2.800c0 5.600-7.500 10.200-7.500 10.200z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.900L12 16.900l-5.200 2.800 1-5.900-4.300-4.100 5.900-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6M16 4.800a3.500 3.500 0 0 1 0 6.400M18 14.300c2.100.8 3.500 2.700 3.500 5.700"/>',
  bed: '<path d="M3 18v-8.5M3 13h18v5M21 13v-1.5a3 3 0 0 0-3-3h-7V13M3 18h18"/><circle cx="7" cy="10.5" r="1.8"/>',
  bath: '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V6a2.500 2.500 0 0 1 5 0M7 19l-1 2M17 19l1 2"/>',
  check: '<path d="M5 12.5l4.5 4.500L19 7.500"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.500l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4.500h6V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.500l12 7.500-12 7.500z"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.500 6v6c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3V6M4.500 12v6c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3v-6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
} as const;

export function Icon({ name, size = 18, filled = false }: { name: keyof typeof ICONS; size?: number; filled?: boolean }) {
  return (
    <span className="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
    </span>
  );
}

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (!count || avg === null) return <span className="rating rating-new">New</span>;
  return (
    <span className="rating" title={`${avg} out of 5`}>
      <Icon name="star" size={14} filled />
      <strong>{avg.toFixed(1)}</strong>
      <span className="muted">({count})</span>
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? 'star-on' : 'star-off'}>
          <Icon name="star" size={15} filled />
        </span>
      ))}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

// ---- dialogs ---------------------------------------------------------------
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      // A click on the dimmed backdrop lands on the <dialog> element itself.
      onMouseDown={(event) => event.target === ref.current && ref.current.close()}
    >
      <div className="modal-box">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" type="button" aria-label="Close" onClick={() => ref.current?.close()}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}

// A form whose submit handler is async: disables the button while it runs and
// shows a failure inside the form (toasts would be hidden behind a dialog).
export function AsyncForm({ className = 'stack', onSubmit, children }: { className?: string; onSubmit: (data: FormData) => Promise<void>; children: ReactNode }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit(new FormData(event.currentTarget));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={className} onSubmit={handle}>
      <fieldset className="fieldset stack" disabled={busy}>
        {children}
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return (
    <Modal title={request.title} onClose={onClose}>
      <p className="modal-text">{request.message}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Keep it
        </button>
        <button
          className="btn btn-danger"
          type="button"
          onClick={() => {
            onClose();
            request.onConfirm();
          }}
        >
          {request.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ---- toasts ----------------------------------------------------------------
interface Toast {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}
let toasts: Toast[] = [];
let nextToastId = 1;
const toastListeners = new Set<() => void>();
const emit = () => toastListeners.forEach((listener) => listener());

export function toast(message: string, kind: Toast['kind'] = 'ok') {
  const id = nextToastId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

export function Toasts() {
  const items = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener);
      return () => void toastListeners.delete(listener);
    },
    () => toasts
  );
  return (
    <div className="toasts" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.kind}`} role="status">
          {item.message}
        </div>
      ))}
    </div>
  );
}
