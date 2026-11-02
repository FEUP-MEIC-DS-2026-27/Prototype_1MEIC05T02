import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Contract = {
  researcherId: string;
  name: string;
  position: string;
  type: "contract" | "scholarship";
  group: string;
  funding: string;
  supervisor: string;
  renewable: boolean;
  start: string;
  end: string;
};

type Status = "expired" | "critical" | "warning" | "ok";
type SortKey = "name" | "group" | "end";
type Session = { token: string; user: string };

const API = "http://localhost:8080";
const DAY = 86_400_000;
const SESSION_KEY = "humanise-session";

const STATUS_LABEL: Record<Status, string> = {
  expired: "Ended",
  critical: "Ends ≤ 30 days",
  warning: "Ends ≤ 90 days",
  ok: "Stable",
};

const daysLeft = (end: string) =>
  Math.ceil((new Date(end).getTime() - Date.now()) / DAY);

const statusOf = (d: number): Status =>
  d < 0 ? "expired" : d <= 30 ? "critical" : d <= 90 ? "warning" : "ok";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtRemaining = (d: number) =>
  d < 0
    ? `Ended ${-d}d ago`
    : d < 60
      ? `${d} days`
      : `${Math.round(d / 30.4)} months`;

const progress = (start: string, end: string) => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.min(1, Math.max(0, (Date.now() - s) / (e - s)));
};

function loadSession(): Session | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  } catch {
    return undefined;
  }
}

function saveSession(s?: Session) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: session just won't survive a refresh */
  }
}

/* ------------------------------ Login ------------------------------ */

function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }
      const { token } = await res.json();
      onLogin({ token, user: username });
    } catch {
      setError("Cannot reach the server. Is the gateway running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <div className="brand">
          <span className="logo">H</span>
          <div>
            <h1>HumanISE.info</h1>
            <p className="muted">Research radiator</p>
          </div>
        </div>

        <label>
          Username
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="hint muted">
          Demo accounts: <code>manager</code> / <code>manager123</code> or{" "}
          <code>researcher</code> / <code>researcher123</code>
        </p>
      </form>
    </main>
  );
}

/* ---------------------------- Dashboard ---------------------------- */

function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "end", dir: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`${API}/api/contracts`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.status === 401) return onLogout(); // token missing or expired
      if (res.status === 403) {
        setError("Your account is not authorised to view contract information.");
        return;
      }
      if (!res.ok) {
        setError(`Unexpected error (${res.status}).`);
        return;
      }
      setRows(await res.json());
    } catch {
      setError("Cannot reach the server. Is the gateway running?");
    } finally {
      setLoading(false);
    }
  }, [session.token, onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => [...new Set(rows.map((r) => r.group))].sort(), [rows]);

  const stats = useMemo(() => {
    const withDays = rows.map((r) => ({ r, d: daysLeft(r.end) }));
    const active = withDays.filter((x) => x.d >= 0);
    const ending90 = active.filter((x) => x.d <= 90);
    const next = [...active].sort((a, b) => a.d - b.d)[0];
    const avgMonths = active.length
      ? active.reduce((sum, x) => sum + x.d, 0) / active.length / 30.4
      : 0;
    return {
      total: rows.length,
      active: active.length,
      ending90: ending90.length,
      ended: withDays.length - active.length,
      scholarships: rows.filter((r) => r.type === "scholarship").length,
      contracts: rows.filter((r) => r.type === "contract").length,
      next,
      avgMonths,
    };
  }, [rows]);

  // Number of contracts ending in each of the next 6 calendar months
  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const count = rows.filter((r) => {
        const t = new Date(r.end).getTime();
        return t >= Math.max(start.getTime(), now.getTime()) && t < end.getTime();
      }).length;
      return {
        label: start.toLocaleDateString("en-GB", { month: "short" }),
        count,
      };
    });
  }, [rows]);
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.count));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q && !`${r.name} ${r.position} ${r.supervisor} ${r.funding}`.toLowerCase().includes(q))
          return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (groupFilter !== "all" && r.group !== groupFilter) return false;
        if (statusFilter !== "all" && statusOf(daysLeft(r.end)) !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const va = a[sort.key];
        const vb = b[sort.key];
        return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
      });
  }, [rows, query, typeFilter, groupFilter, statusFilter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "");
  const resetFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setGroupFilter("all");
    setStatusFilter("all");
  };
  const filtersActive =
    query || typeFilter !== "all" || groupFilter !== "all" || statusFilter !== "all";

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="logo">H</span>
          <div>
            <h1>Contracts &amp; scholarships</h1>
            <p className="muted">Staffing availability and continuity</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="user">
            <span className="avatar">{session.user.charAt(0).toUpperCase()}</span>
            {session.user}
          </span>
          <button onClick={onLogout}>Log out</button>
        </div>
      </header>

      {error && (
        <div className="alert big">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && !error && <p className="muted">Loading…</p>}

      {!error && !loading && (
        <>
          <section className="cards">
            <div className="card stat">
              <span className="stat-label">Researchers with data</span>
              <span className="stat-value">{stats.total}</span>
              <span className="muted small">
                {stats.contracts} contracts · {stats.scholarships} scholarships
              </span>
            </div>
            <div className="card stat">
              <span className="stat-label">Active</span>
              <span className="stat-value">{stats.active}</span>
              <span className="muted small">{stats.ended} already ended</span>
            </div>
            <div className="card stat accent-warn">
              <span className="stat-label">Ending within 90 days</span>
              <span className="stat-value">{stats.ending90}</span>
              <span className="muted small">
                {stats.next
                  ? `Next: ${stats.next.r.name} (${fmtRemaining(stats.next.d)})`
                  : "Nothing upcoming"}
              </span>
            </div>
            <div className="card stat">
              <span className="stat-label">Average time remaining</span>
              <span className="stat-value">
                {stats.avgMonths.toFixed(1)}
                <small> months</small>
              </span>
              <span className="muted small">across active contracts</span>
            </div>
          </section>

          <section className="card">
            <h2>Contracts ending per month</h2>
            <div className="bars" role="img" aria-label="Contracts ending per month">
              {monthly.map((m) => (
                <div className="bar-col" key={m.label}>
                  <span className="bar-count">{m.count}</span>
                  <div className="bar" style={{ height: `${(m.count / maxMonthly) * 100}%` }} />
                  <span className="bar-label">{m.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="filters">
              <input
                type="search"
                placeholder="Search name, position, supervisor, funding…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                <option value="contract">Contract</option>
                <option value="scholarship">Scholarship</option>
              </select>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="all">All groups</option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              {filtersActive && (
                <button className="link" onClick={resetFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <p className="muted small">
              Showing {visible.length} of {rows.length}
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("name")}>
                      Researcher{arrow("name")}
                    </th>
                    <th>Type</th>
                    <th className="sortable" onClick={() => toggleSort("group")}>
                      Group{arrow("group")}
                    </th>
                    <th>Funding</th>
                    <th>Supervisor</th>
                    <th>Progress</th>
                    <th className="sortable" onClick={() => toggleSort("end")}>
                      Ends{arrow("end")}
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => {
                    const d = daysLeft(c.end);
                    const st = statusOf(d);
                    return (
                      <tr key={c.researcherId}>
                        <td>
                          <div className="strong">{c.name}</div>
                          <div className="muted small">{c.position}</div>
                        </td>
                        <td>
                          <span className={`pill type-${c.type}`}>{c.type}</span>
                        </td>
                        <td>{c.group}</td>
                        <td>{c.funding}</td>
                        <td>{c.supervisor}</td>
                        <td className="progress-cell">
                          <div className="progress">
                            <div
                              className={`progress-fill ${st}`}
                              style={{ width: `${progress(c.start, c.end) * 100}%` }}
                            />
                          </div>
                          <span className="muted small">
                            {fmtDate(c.start)} → {fmtDate(c.end)}
                          </span>
                        </td>
                        <td>
                          <div className="strong">{fmtDate(c.end)}</div>
                          <div className="muted small">
                            {fmtRemaining(d)}
                            {c.renewable && d >= 0 ? " · renewable" : ""}
                          </div>
                        </td>
                        <td>
                          <span className={`pill status-${st}`}>{STATUS_LABEL[st]}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">
                        No researchers match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="muted small footnote">
            Only contract data you are permitted to see is shown. Mock data for demonstration.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------- App ------------------------------- */

export default function App() {
  const [session, setSession] = useState<Session | undefined>(loadSession);

  const login = (s: Session) => {
    saveSession(s);
    setSession(s);
  };
  const logout = useCallback(() => {
    saveSession(undefined);
    setSession(undefined);
  }, []);

  return session ? <Dashboard session={session} onLogout={logout} /> : <Login onLogin={login} />;
}