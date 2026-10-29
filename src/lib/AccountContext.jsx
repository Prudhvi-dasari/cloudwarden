import { createContext, useContext, useEffect, useState } from 'react';
import { applyTheme } from './theme';
import { clearUserSession, getStoredUser, syncAccount } from './authSession';
import { identifyMinilytics } from './minilytics';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    let alive = true;

    async function applySession(sessionUser) {
      if (!sessionUser) {
        if (!alive) return;
        setUser(null);
        try { localStorage.removeItem('itransfer_user_session'); } catch (e) {}
        applyTheme('indigo');
        return;
      }
      try {
        const synced = await syncAccount(sessionUser);
        if (!alive) return;
        setUser(synced);
        identifyMinilytics(synced);
        applyTheme(synced?.user_metadata?.theme || 'indigo');
      } catch (e) {
        console.warn('Account session:', e.message);
      }
    }

    identifyMinilytics(getStoredUser());

    let subscription = null;
    let started = false;
    async function listen() {
      if (started) return;
      started = true;
      const { supabase } = await import('./supabase.js');
      if (!alive) return;
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session?.user) applySession(data.session.user);
      const auth = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) setTimeout(() => { applySession(session.user); }, 0);
        else if (event === 'SIGNED_OUT') setTimeout(() => { applySession(null); }, 0);
      });
      subscription = auth.data.subscription;
    }

    if (getStoredUser()) listen();
    const onNeed = () => { listen(); };
    window.addEventListener('sta-auth-needed', onNeed);

    return () => {
      alive = false;
      subscription?.unsubscribe();
      window.removeEventListener('sta-auth-needed', onNeed);
    };
  }, []);

  return (
    <AccountContext.Provider value={{ user, setUser, signOut: clearUserSession }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
