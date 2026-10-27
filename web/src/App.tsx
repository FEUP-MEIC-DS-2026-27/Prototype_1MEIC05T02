import { useState } from "react";

type Contract = {
  researcherId: string;
  name: string;
  type: "contract" | "scholarship";
  start: string;
  end: string;
};

const API = "http://localhost:8080";
const daysLeft = (end: string) =>
  Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);

export default function App() {
  const [token, setToken] = useState<string>();
  const [rows, setRows] = useState<Contract[]>([]);
  const [error, setError] = useState<string>();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return setError("Invalid credentials");
    const { token } = await res.json();
    setToken(token);
    await loadContracts(token);
  }

  async function loadContracts(t: string) {
    const res = await fetch(`${API}/api/contracts`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 403) return setError("You are not authorised to view contracts.");
    if (!res.ok) return setError(`Error ${res.status}`);
    setRows(await res.json());
  }

  if (!token)
    return (
      <form onSubmit={login}>
        <h2>HumanISE.info login</h2>
        <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Log in</button>
        {error && <p>{error}</p>}
      </form>
    );

  return (
    <>
      <button onClick={() => { setToken(undefined); setRows([]); setError(undefined); }}>Log out</button>
      {error && <p>{error}</p>}
      <table>
        <thead>
          <tr><th>Researcher</th><th>Type</th><th>Ends</th><th>Days left</th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.researcherId} style={{ background: daysLeft(c.end) < 90 ? "#fdd" : undefined }}>
              <td>{c.name}</td><td>{c.type}</td><td>{c.end.slice(0, 10)}</td><td>{daysLeft(c.end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}