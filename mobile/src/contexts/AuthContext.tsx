import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

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
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedToken = await SecureStore.getItemAsync('Yelo_token');
        const storedUser = await SecureStore.getItemAsync('Yelo_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessão local:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStorageData();
  }, []);

  const signIn = async (newToken: string, userData: UserData) => {
    try {
      await SecureStore.setItemAsync('Yelo_token', newToken);
      await SecureStore.setItemAsync('Yelo_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
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
    <AuthContext.Provider value={{ user, token, YeloToken: token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
