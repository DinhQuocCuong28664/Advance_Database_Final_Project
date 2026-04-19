import { useFlash } from '../../context/FlashContext';

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export default function ToastContainer() {
  const { toasts, dismiss } = useFlash();

  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone || 'info'}`}>
          <span className="toast-icon">{ICONS[t.tone] || ICONS.info}</span>
          <span className="toast-text">{t.text}</span>
          <button
            className="toast-close"
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
