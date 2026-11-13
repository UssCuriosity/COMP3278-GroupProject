// Who is logged in, plus the log in / sign up dialog.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import { type User, api, errorMessage } from './api';
import { AsyncForm, Field, Modal, toast } from './ui';

// Demo accounts created by db/seed.sql (they all share this demo password).
const DEMO_PASSWORD = 'lantern123';
const DEMO_ACCOUNTS = [
  { label: 'Alice (guest)', email: 'alice@example.com' },
  { label: 'Ben (host)', email: 'ben@example.com' },
];

type Mode = 'login' | 'register';

interface Auth {
  user: User | null;
  loading: boolean;
  openAuth(mode?: Mode): void;
  /** Resolves to true once the user is logged in, false if they close the dialog. */
  ensureLogin(): Promise<boolean>;
  logout(): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User | null }>('GET', '/auth/me') });
  const user = me.data?.user ?? null;

  const [mode, setMode] = useState<Mode | null>(null);
  const waiting = useRef<((loggedIn: boolean) => void)[]>([]);

  const finish = useCallback((loggedIn: boolean) => {
    setMode(null);
    waiting.current.forEach((resolve) => resolve(loggedIn));
    waiting.current = [];
  }, []);

  // After logging in or out, everything on screen may differ (favourites, trips ...).
  const setUser = useCallback(
    async (next: User | null) => {
      queryClient.setQueryData(['me'], { user: next });
      await queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const auth: Auth = {
    user,
    loading: me.isPending,
    openAuth: (next = 'login') => setMode(next),
    ensureLogin: () => {
      if (user) return Promise.resolve(true);
      setMode((current) => current ?? 'login');
      return new Promise((resolve) => waiting.current.push(resolve));
    },
    logout: async () => {
      try {
        await api('POST', '/auth/logout');
        await setUser(null);
        toast('You are logged out.');
      } catch (error) {
        toast(errorMessage(error), 'error');
      }
    },
  };

  return (
    <AuthContext.Provider value={auth}>
      {children}
      {mode && (
        <AuthDialog
          mode={mode}
          onMode={setMode}
          onClose={() => finish(false)}
          onSuccess={async (next, isNew) => {
            await setUser(next);
            finish(true);
            const firstName = next.name.split(' ')[0];
            toast(isNew ? `Account created. Welcome, ${firstName}!` : `Welcome back, ${firstName}!`);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}

function AuthDialog({ mode, onMode, onClose, onSuccess }: { mode: Mode; onMode: (mode: Mode) => void; onClose: () => void; onSuccess: (user: User, isNew: boolean) => Promise<void> }) {
  const isLogin = mode === 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoError, setDemoError] = useState('');

  const submit = async (payload: Record<string, unknown>) => {
    const { user } = await api<{ user: User }>('POST', isLogin ? '/auth/login' : '/auth/register', payload);
    await onSuccess(user, !isLogin);
  };

  return (
    <Modal title="Welcome to Lantern Stays" onClose={onClose}>
      <div className="tabs">
        <button className={`tab${isLogin ? ' is-active' : ''}`} type="button" onClick={() => onMode('login')}>
          Log in
        </button>
        <button className={`tab${isLogin ? '' : ' is-active'}`} type="button" onClick={() => onMode('register')}>
          Sign up
        </button>
      </div>

      <AsyncForm key={mode} onSubmit={(data) => submit(Object.fromEntries(data))}>
        {!isLogin && (
          <Field label="Full name">
            <input type="text" name="name" required maxLength={100} autoComplete="name" autoFocus />
          </Field>
        )}
        <Field label="Email">
          <input type="email" name="email" required autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={isLogin} />
        </Field>
        <Field label="Password" hint={isLogin ? undefined : 'At least 8 characters.'}>
          <input type="password" name="password" required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-block" type="submit">
          {isLogin ? 'Log in' : 'Create account'}
        </button>
      </AsyncForm>

      {isLogin && (
        <div className="demo-box">
          <span className="muted">Demo accounts:</span>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              className="chip chip-button"
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
                setDemoError('');
                submit({ email: account.email, password: DEMO_PASSWORD }).catch((error) => setDemoError(errorMessage(error)));
              }}
            >
              {account.label}
            </button>
          ))}
          {demoError && (
            <p className="form-error" role="alert">
              {demoError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
