const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let activeDialog = null;
let returnFocusTo = null;
let toastTimer = null;

function trapFocus(event) {
  const dialog = event.currentTarget;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDialog(dialog);
    return;
  }
  if (event.key !== 'Tab') return;

  const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openDialog(dialog, { initialFocus } = {}) {
  if (activeDialog && activeDialog !== dialog) closeDialog(activeDialog);
  returnFocusTo = document.activeElement;
  dialog.classList.remove('hidden');
  dialog.addEventListener('keydown', trapFocus);
  activeDialog = dialog;
  (initialFocus ?? dialog.querySelector(FOCUSABLE))?.focus();
}

export function closeDialog(dialog = activeDialog) {
  if (!dialog) return;
  dialog.classList.add('hidden');
  dialog.removeEventListener('keydown', trapFocus);
  if (dialog === activeDialog) {
    activeDialog = null;
    returnFocusTo?.focus?.();
    returnFocusTo = null;
  }
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  clearTimeout(toastTimer); // evita que timers antiguos oculten un toast nuevo
  toastTimer = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3500);
}