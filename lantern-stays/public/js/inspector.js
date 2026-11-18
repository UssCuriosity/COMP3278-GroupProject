// SQL inspector: a drawer that lists the SQL statements the server ran for
// every action in the app, newest first. It makes the database work behind
// each click visible (C = INSERT, R = SELECT, U = UPDATE, D = DELETE).
import { onSql } from './api.js';
import { h, icon } from './dom.js';

const MAX_CALLS = 40;
const KINDS = {
  SELECT: { label: 'READ', css: 'read' },
  INSERT: { label: 'CREATE', css: 'create' },
  UPDATE: { label: 'UPDATE', css: 'update' },
  DELETE: { label: 'DELETE', css: 'delete' },
};
const TOKEN =
  /('[^']*')|(\?)|\b(SELECT|FROM|WHERE|AND|OR|NOT|EXISTS|IN|JOIN|LEFT|ON|GROUP BY|ORDER BY|INSERT|IGNORE|INTO|VALUES|UPDATE|SET|DELETE|AS|CASE|WHEN|THEN|ELSE|END|FOR UPDATE|START TRANSACTION|COMMIT|ROLLBACK|DESC|ASC|TRUE|FALSE|IS|NULL|COUNT|SUM|MIN|MAX|AVG|COALESCE|DATEDIFF|CURDATE)\b/g;

const calls = [];
let total = 0;
let open = false;
let panel;
let list;
let badge;

// Builds a <pre> with keywords, strings and placeholders coloured.
function highlight(sql) {
  const pre = h('pre', { class: 'sql-code' });
  let last = 0;
  for (const match of sql.matchAll(TOKEN)) {
    if (match.index > last) pre.append(sql.slice(last, match.index));
    const css = match[1] ? 'sql-string' : match[2] ? 'sql-param' : 'sql-keyword';
    pre.append(h('span', { class: css }, match[0]));
    last = match.index + match[0].length;
  }
  pre.append(sql.slice(last));
  return pre;
}

function statementBlock(statement) {
  const verb = statement.sql.trim().split(/\s+/)[0].toUpperCase();
  const kind = KINDS[verb] || { label: 'TX', css: 'tx' };
  let outcome = null;
  if (statement.error) outcome = h('span', { class: 'sql-outcome sql-failed' }, `✕ ${statement.error}`);
  else if (statement.rows !== undefined) outcome = h('span', { class: 'sql-outcome' }, `→ ${statement.rows} row${statement.rows === 1 ? '' : 's'}`);
  else if (statement.affected !== undefined) outcome = h('span', { class: 'sql-outcome' }, `→ ${statement.affected} row${statement.affected === 1 ? '' : 's'} affected`);

  return h(
    'div',
    { class: `sql-statement sql-${kind.css}` },
    h('span', { class: 'sql-badge' }, kind.label),
    h(
      'div',
      { class: 'sql-main' },
      highlight(statement.sql),
      statement.params && statement.params.length > 0 && h('div', { class: 'sql-params' }, 'params: ', h('code', {}, JSON.stringify(statement.params).replace(/,/g, ', '))),
      h('div', { class: 'sql-meta' }, outcome, statement.ms !== undefined && h('span', {}, `${statement.ms.toFixed(1)} ms`))
    )
  );
}

function callBlock(call) {
  return h(
    'section',
    { class: 'sql-call' },
    h(
      'header',
      { class: 'sql-call-head' },
      h('span', { class: `sql-method sql-method-${call.method.toLowerCase()}` }, call.method),
      h('span', { class: 'sql-path' }, call.path),
      h('span', { class: `sql-status${call.status >= 400 ? ' sql-status-error' : ''}` }, String(call.status)),
      h('span', { class: 'sql-time' }, call.time)
    ),
    call.statements.map(statementBlock)
  );
}

function paint() {
  badge.textContent = String(total);
  if (!open) return;
  list.replaceChildren(
    ...(calls.length
      ? calls.map(callBlock)
      : [h('p', { class: 'sql-empty' }, 'Nothing yet. Use the app and the SQL behind every action appears here.')])
  );
}

function setOpen(value) {
  open = value;
  panel.hidden = !open;
  document.body.classList.toggle('inspector-open', open);
  try {
    localStorage.setItem('lantern-inspector', open ? '1' : '0');
  } catch {
    /* private mode: just do not remember the choice */
  }
  paint();
}

function clear() {
  calls.length = 0;
  total = 0;
  paint();
}

export function initInspector() {
  badge = h('span', { class: 'inspector-count' }, '0');
  list = h('div', { class: 'inspector-list' });
  panel = h(
    'aside',
    { class: 'inspector', hidden: true, 'aria-label': 'SQL inspector' },
    h(
      'div',
      { class: 'inspector-head' },
      h('strong', {}, icon('database', { size: 16 }), ' SQL inspector'),
      h('span', { class: 'inspector-note' }, 'Statements the server sent to MySQL, newest first'),
      h(
        'button',
        {
          class: 'inspector-btn',
          type: 'button',
          onclick: clear,
        },
        'Clear'
      ),
      h('button', { class: 'inspector-btn', type: 'button', onclick: () => setOpen(false) }, 'Hide')
    ),
    list
  );
  const toggle = h('button', { class: 'inspector-toggle', type: 'button', title: 'Show the SQL behind each action', onclick: () => setOpen(!open) }, icon('database', { size: 16 }), 'SQL', badge);
  document.body.append(panel, toggle);

  onSql((call) => {
    if (!call) return clear();
    calls.unshift({ ...call, time: new Date().toLocaleTimeString('en-GB') });
    calls.length = Math.min(calls.length, MAX_CALLS);
    total += call.statements.length;
    paint();
    if (open) list.scrollTop = 0;
  });

  let remembered = false;
  try {
    remembered = localStorage.getItem('lantern-inspector') === '1';
  } catch {
    /* ignore */
  }
  if (remembered) setOpen(true);
}
