// Tiny DOM toolkit: element builder, icons, formatting, toasts and dialogs.
// Everything user-supplied is inserted as text nodes, never as HTML.

const DIRECT_PROPS = new Set(['checked', 'disabled', 'selected', 'htmlFor', 'required', 'hidden']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [key, val] of Object.entries(props || {})) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'value') value = val;
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2), val);
    else if (DIRECT_PROPS.has(key)) el[key] = val;
    else el.setAttribute(key, val === true ? '' : String(val));
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  if (value !== undefined) el.value = value; // after children, so <select> can find its <option>
  return el;
}

const ICONS = {
  heart: '<path d="M12 20.500s-7.500-4.600-7.500-10.200A4.300 4.300 0 0 1 12 7.500a4.300 4.300 0 0 1 7.500 2.800c0 5.600-7.500 10.200-7.500 10.200z"/>',
  star: '<path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900-4.300-4.100 5.900-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6M16 4.800a3.500 3.500 0 0 1 0 6.400M18 14.300c2.100.8 3.500 2.700 3.500 5.700"/>',
  bed: '<path d="M3 18v-8.500M3 13h18v5M21 13v-1.500a3 3 0 0 0-3-3h-7V13M3 18h18"/><circle cx="7" cy="10.500" r="1.800"/>',
  bath: '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V6a2.500 2.500 0 0 1 5 0M7 19l-1 2M17 19l1 2"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4.500h6V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.500l12 7.500-12 7.500z"/>',
  database: '<ellipse cx="12" cy="6" rx="7.500" ry="3"/><path d="M4.500 6v6c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3V6M4.500 12v6c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3v-6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  calendar: '<rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
};

export function icon(name, { size = 18, filled = false } = {}) {
  const span = document.createElement('span');
  span.className = `icon${filled ? ' icon-filled' : ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}

// ---- formatting ------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (number) => String(number).padStart(2, '0');
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parts = (iso) => iso.slice(0, 10).split('-').map(Number);

export const todayISO = () => toISO(new Date());

export function addDays(iso, days) {
  const [y, m, d] = parts(iso);
  return toISO(new Date(y, m - 1, d + days));
}

export function nightsBetween(checkIn, checkOut) {
  const [y1, m1, d1] = parts(checkIn);
  const [y2, m2, d2] = parts(checkOut);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function formatDate(iso) {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatRange(checkIn, checkOut) {
  const [y1, m1, d1] = parts(checkIn);
  const [y2, m2] = parts(checkOut);
  if (y1 === y2 && m1 === m2) return `${d1} – ${formatDate(checkOut)}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${formatDate(checkOut)}`;
  return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
}

export const money = (amount) => `HK$${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
export const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

// ---- toasts ----------------------------------------------------------------
export function toast(message, kind = 'ok') {
  const el = h('div', { class: `toast toast-${kind}`, role: 'status' }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('toast-out'), 3600);
  setTimeout(() => el.remove(), 4000);
}

// ---- dialogs ---------------------------------------------------------------
export function openModal({ title, content, wide = false }) {
  const dialog = h('dialog', { class: `modal${wide ? ' modal-wide' : ''}` });
  const close = () => dialog.close();
  dialog.append(
    h(
      'div',
      { class: 'modal-box' },
      h(
        'div',
        { class: 'modal-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('x'))
      ),
      h('div', { class: 'modal-body' }, content)
    )
  );
  // A click on the dimmed backdrop lands on the <dialog> element itself.
  dialog.addEventListener('mousedown', (event) => {
    if (event.target === dialog) close();
  });
  const closed = new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve();
    });
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close, closed };
}

// Resolves to true when the user confirms, false otherwise.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  let answer = false;
  const modal = openModal({
    title,
    content: [
      h('p', { class: 'modal-text' }, message),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => modal.close() }, 'Keep it'),
        h(
          'button',
          {
            class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
            type: 'button',
            onclick: () => {
              answer = true;
              modal.close();
            },
          },
          confirmLabel
        )
      ),
    ],
  });
  return modal.closed.then(() => answer);
}

// Runs an async action from a button: disables the button while it runs and
// shows a toast if it fails. Returns true on success.
export async function runAction(button, action) {
  if (button) button.disabled = true;
  try {
    await action();
    return true;
  } catch (error) {
    toast(error.message || 'Something went wrong.', 'error');
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

// A <form> whose submit handler is async; failures appear inside the form
// (toasts would be hidden behind an open dialog).
export function asyncForm(props, onSubmit, ...children) {
  const errorBox = h('p', { class: 'form-error', hidden: true, role: 'alert' });
  const form = h('form', { ...props, novalidate: false }, ...children, errorBox);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    errorBox.hidden = true;
    if (submit) submit.disabled = true;
    try {
      await onSubmit(new FormData(form), form);
    } catch (error) {
      errorBox.textContent = error.message || 'Something went wrong.';
      errorBox.hidden = false;
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  return form;
}

export const field = (label, control, hint) =>
  h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint && h('span', { class: 'field-hint' }, hint));
