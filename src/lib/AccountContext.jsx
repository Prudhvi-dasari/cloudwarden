import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, applyTheme } from './supabase';
import { clearUserSession, getStoredUser, syncAccount } from './authSession';

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
        applyTheme(synced?.user_metadata?.theme || 'indigo');
      } catch (e) {
        console.warn('Account session:', e.message);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session?.user) applySession(data.session.user);
      else setUser(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setTimeout(() => { applySession(session.user); }, 0);
      } else if (event === 'SIGNED_OUT') {
        setTimeout(() => { applySession(null); }, 0);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
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
