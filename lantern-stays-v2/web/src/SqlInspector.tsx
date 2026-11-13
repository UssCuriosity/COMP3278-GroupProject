// SQL inspector: a drawer listing the SQL statements the server ran for every
// action in the app, newest first. It makes the database work behind each
// click visible (C = INSERT, R = SELECT, U = UPDATE, D = DELETE).
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { type SqlCall, type SqlLogEntry, sqlLog } from './api';
import { Icon } from './ui';

const KINDS: Record<string, { label: string; css: string }> = {
  SELECT: { label: 'READ', css: 'read' },
  INSERT: { label: 'CREATE', css: 'create' },
  REPLACE: { label: 'CREATE', css: 'create' },
  UPDATE: { label: 'UPDATE', css: 'update' },
  DELETE: { label: 'DELETE', css: 'delete' },
};

const TOKEN =
  /('[^']*')|(\?)|\b(SELECT|FROM|WHERE|AND|OR|NOT|EXISTS|IN|JOIN|LEFT|ON|GROUP BY|ORDER BY|INSERT|IGNORE|INTO|VALUES|UPDATE|SET|DELETE|AS|CASE|WHEN|THEN|ELSE|END|FOR UPDATE|START TRANSACTION|COMMIT|ROLLBACK|DESC|ASC|TRUE|FALSE|IS|NULL|COUNT|SUM|MIN|MAX|AVG|COALESCE|DATEDIFF|CURDATE|OVER|LIMIT|OFFSET)\b/g;

// Colours keywords, strings and "?" placeholders. Built from React nodes, so
// the SQL text is always inserted as text, never as HTML.
function highlight(sql: string) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of sql.matchAll(TOKEN)) {
    if (match.index > last) nodes.push(sql.slice(last, match.index));
    const css = match[1] ? 'sql-string' : match[2] ? 'sql-param' : 'sql-keyword';
    nodes.push(
      <span key={match.index} className={css}>
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }
  nodes.push(sql.slice(last));
  return nodes;
}

function Statement({ statement }: { statement: SqlLogEntry }) {
  const verb = statement.sql.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  const kind = KINDS[verb] ?? { label: 'TX', css: 'tx' };
  const rows = (n: number) => `${n} row${n === 1 ? '' : 's'}`;
  return (
    <div className={`sql-statement sql-${kind.css}`}>
      <span className="sql-badge">{kind.label}</span>
      <div className="sql-main">
        <pre className="sql-code">{highlight(statement.sql)}</pre>
        {statement.params.length > 0 && (
          <div className="sql-params">
            params: <code>{JSON.stringify(statement.params).replace(/,/g, ', ')}</code>
          </div>
        )}
        <div className="sql-meta">
          {statement.error ? (
            <span className="sql-outcome sql-failed">✕ {statement.error}</span>
          ) : statement.rows !== undefined ? (
            <span className="sql-outcome">→ {rows(statement.rows)}</span>
          ) : statement.affected !== undefined ? (
            <span className="sql-outcome">→ {rows(statement.affected)} affected</span>
          ) : null}
          {statement.ms !== undefined && <span>{statement.ms.toFixed(1)} ms</span>}
        </div>
      </div>
    </div>
  );
}

function Call({ call }: { call: SqlCall }) {
  return (
    <section className="sql-call">
      <header className="sql-call-head">
        <span className={`sql-method sql-method-${call.method.toLowerCase()}`}>{call.method}</span>
        <span className="sql-path">{call.path}</span>
        <span className={`sql-status${call.status >= 400 ? ' sql-status-error' : ''}`}>{call.status}</span>
        <span className="sql-time">{call.time}</span>
      </header>
      {call.statements.map((statement, index) => (
        <Statement key={index} statement={statement} />
      ))}
    </section>
  );
}

const STORAGE_KEY = 'lantern-inspector';

function readOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // private mode: just do not remember the choice
  }
}

export function SqlInspector() {
  const calls = useSyncExternalStore(sqlLog.subscribe, sqlLog.getCalls);
  const total = useSyncExternalStore(sqlLog.subscribe, sqlLog.getTotal);
  const [open, setOpen] = useState(readOpen);

  useEffect(() => {
    document.body.classList.toggle('inspector-open', open);
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  return (
    <>
      {open && (
        <aside className="inspector" aria-label="SQL inspector">
          <div className="inspector-head">
            <strong>
              <Icon name="database" size={16} /> SQL inspector
            </strong>
            <span className="inspector-note">Statements the server sent to MySQL, newest first</span>
            <button className="inspector-btn" type="button" onClick={sqlLog.clear}>
              Clear
            </button>
            <button className="inspector-btn" type="button" onClick={() => setOpen(false)}>
              Hide
            </button>
          </div>
          <div className="inspector-list">
            {calls.length ? calls.map((call) => <Call key={call.key} call={call} />) : <p className="sql-empty">Nothing yet. Use the app and the SQL behind every action appears here.</p>}
          </div>
        </aside>
      )}
      <button className="inspector-toggle" type="button" title="Show the SQL behind each action" onClick={() => setOpen(!open)}>
        <Icon name="database" size={16} />
        SQL
        <span className="inspector-count">{total}</span>
      </button>
    </>
  );
}
