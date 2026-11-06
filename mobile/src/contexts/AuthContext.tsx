import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export type UserData = {
  id: number;
  nome: string;
  email: string;
  type?: 'psychologist' | 'patient' | 'admin' | string;
  slug?: string;
  fotoUrl?: string;
};

export type AuthContextData = {
  user: UserData | null;
  token: string | null;
  YeloToken: string | null;
  loading: boolean;
  signIn: (token: string, user: UserData) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (fields: Partial<UserData>) => Promise<void>;
  refreshUser: () => Promise<UserData | null>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<UserData | null> => {
    try {
      const storedToken = await SecureStore.getItemAsync('Yelo_token');
      if (!storedToken) return null;

      const res = await api.get('/api/psychologists/me').catch(() => null);
      if (res?.data) {
        const p = res.data;
        let updatedUser: UserData | null = null;
        setUser((prev) => {
          const merged: UserData = prev
            ? {
                ...prev,
                nome: p.nome || prev.nome,
                email: p.email || prev.email,
                slug: p.slug || prev.slug,
                fotoUrl: p.fotoUrl || prev.fotoUrl,
              }
            : {
                id: p.id,
                nome: p.nome,
                email: p.email,
                slug: p.slug,
                fotoUrl: p.fotoUrl,
                type: 'psychologist',
              };
          updatedUser = merged;
          SecureStore.setItemAsync('Yelo_user', JSON.stringify(merged)).catch(() => {});
          return merged;
        });
        return updatedUser;
      }
    } catch {
      // Falha silenciosa em caso de conexão instável
    }
    return null;
  }, []);

  const updateUser = useCallback(async (fields: Partial<UserData>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged: UserData = { ...prev, ...fields };
      SecureStore.setItemAsync('Yelo_user', JSON.stringify(merged)).catch((err) =>
        console.error('Erro ao atualizar usuário localmente:', err)
      );
      return merged;
    });
  }, []);

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedToken = await SecureStore.getItemAsync('Yelo_token');
        const storedUser = await SecureStore.getItemAsync('Yelo_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessão local:', err);
      } finally {
        setLoading(false);
      }

      // Sincroniza foto e dados atualizados em background
      refreshUser();
    }

    loadStorageData();
  }, [refreshUser]);

  const signIn = async (newToken: string, userData: UserData) => {
    try {
      await SecureStore.setItemAsync('Yelo_token', newToken);
      await SecureStore.setItemAsync('Yelo_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      // Busca dados complementares logo após login
      refreshUser();
    } catch (err) {
      console.error('Erro ao salvar sessão local:', err);
    }
  };

  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync('Yelo_token');
      await SecureStore.deleteItemAsync('Yelo_user');
      setToken(null);
      setUser(null);
    } catch (err) {
      console.error('Erro ao remover sessão local:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, YeloToken: token, loading, signIn, signOut, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
