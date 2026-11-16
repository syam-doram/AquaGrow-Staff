import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getToken, setToken, clearToken } from '../services/api';

export interface StaffUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string;
  active: boolean;
}

interface AuthContextValue {
  user: StaffUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true,
  login: async () => {}, logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Role helpers
export const canStock   = (role: string) => ['stock_staff', 'shop_manager', 'owner', 'inventory_admin', 'operations_admin'].includes(role);
export const canBill    = (role: string) => ['billing_staff', 'shop_manager', 'owner', 'sales_admin', 'operations_admin'].includes(role);
export const canClose   = (role: string) => ['shop_manager', 'owner', 'operations_admin'].includes(role);
export const isManager  = (role: string) => ['shop_manager', 'owner', 'operations_admin', 'inventory_admin', 'sales_admin'].includes(role);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, validate token by fetching /staff/me
  const fetchMe = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const { data } = await api.get<StaffUser>('/staff/me');
      if (!data.active) { clearToken(); setUser(null); }
      else setUser(data);
    } catch {
      clearToken(); setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/staff/login', { email, password });
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
