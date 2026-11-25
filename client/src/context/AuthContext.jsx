import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .get('/auth/me')
      .then((response) => {
        if (active) setUser(response.data.data.user || null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        setUser(response.data.data.user);
        return response.data.data.user;
      },
      async register(name, email, password) {
        const response = await api.post('/auth/register', { name, email, password });
        setUser(response.data.data.user);
        return response.data.data.user;
      },
      async logout() {
        await api.post('/auth/logout');
        setUser(null);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
