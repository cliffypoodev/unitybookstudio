// src/pages/Login.jsx — AUTH-1
//
// One page, three modes, decided by GET /api/auth/status:
//   1. No users exist   → first-run SETUP form (creates the first account and
//                         inherits every legacy book via the server migration).
//   2. Users, logged out → LOGIN form.
//   3. Logged in         → ACCOUNT panel: who you are, log out, add another user.
//
// Honesty note shown on setup: the login protects the app over the network;
// files on this Mac's disk are still readable by anyone with machine access.

import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const box = 'w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm';
const field = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm mb-3';
const button = 'w-full rounded-xl bg-foreground text-background px-4 py-3 text-sm font-semibold disabled:opacity-50';

export default function Login() {
  const [mode, setMode] = useState('loading'); // loading | setup | login | account
  const [me, setMe] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const status = await base44.auth.status();
      if (status.authenticated) { setMe(status.user); setMode('account'); }
      else if (!status.usersExist) setMode('setup');
      else setMode('login');
    } catch (e) {
      setError('Could not reach the server: ' + e.message);
      setMode('login');
    }
  };

  useEffect(() => { refresh(); }, []);

  const submit = async (fn, successNotice) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await fn();
      if (successNotice) setNotice(successNotice);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doSetup = () => submit(async () => {
    const result = await base44.auth.setup(username, password, displayName);
    console.log('[AUTH-1] Setup complete; migrated stores:', result.migrated);
    window.location.href = '/';
  });

  const doLogin = () => submit(async () => {
    await base44.auth.login(username, password);
    window.location.href = '/';
  });

  const doCreateUser = () => submit(async () => {
    const result = await base44.auth.createUser(username, password, displayName);
    setUsername(''); setPassword(''); setDisplayName('');
    return result;
  }, 'User created. They can log in from this screen with their own library.');

  if (mode === 'loading') {
    return <div className="fixed inset-0 flex items-center justify-center text-sm text-muted-foreground">Checking session…</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className={box}>
        <h1 className="font-display text-3xl mb-1">Unity Book Studio</h1>

        {mode === 'setup' && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Create the first account. All existing books in this studio will belong to it.
            </p>
            <input className={field} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <input className={field} placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className={field} placeholder="Password (8+ characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className={button} disabled={busy} onClick={doSetup}>Create account &amp; claim library</button>
            <p className="text-xs text-muted-foreground mt-4">
              This login protects the app on your network. Files on this computer's disk remain readable to anyone with access to the machine itself.
            </p>
          </>
        )}

        {mode === 'login' && (
          <>
            <p className="text-sm text-muted-foreground mb-6">Log in to your library.</p>
            <input className={field} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <input className={field} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            <button className={button} disabled={busy} onClick={doLogin}>Log in</button>
          </>
        )}

        {mode === 'account' && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Logged in as <span className="font-semibold text-foreground">{me?.display_name}</span> ({me?.username})
            </p>
            <div className="flex gap-3 mb-8">
              <button className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold" onClick={() => { window.location.href = '/'; }}>Go to library</button>
              <button className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold" disabled={busy} onClick={() => submit(() => base44.auth.logout())}>Log out</button>
            </div>
            <h2 className="text-sm font-semibold mb-2">Add another user</h2>
            <p className="text-xs text-muted-foreground mb-3">New users start with an empty library, fully separate from yours.</p>
            <input className={field} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className={field} placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className={field} placeholder="Password (8+ characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className={button} disabled={busy} onClick={doCreateUser}>Create user</button>
          </>
        )}

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {notice && <p className="text-sm text-green-700 mt-4">{notice}</p>}
      </div>
    </div>
  );
}
