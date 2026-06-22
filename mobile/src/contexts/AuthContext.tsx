import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

type UserData = {
  id: number;
  nome: string;
  email: string;
  type?: string;
};

type AuthContextData = {
  user: UserData | null;
  loading: boolean;
  signIn: (token: string, user: UserData) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      const storedToken = await SecureStore.getItemAsync('Yelo_token');
      const storedUser = await SecureStore.getItemAsync('Yelo_user');

      if (storedToken && storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    }

    loadStorageData();
  }, []);

  const signIn = async (token: string, userData: UserData) => {
    await SecureStore.setItemAsync('Yelo_token', token);
    await SecureStore.setItemAsync('Yelo_user', JSON.stringify(userData));
    setUser(userData);
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('Yelo_token');
    await SecureStore.deleteItemAsync('Yelo_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
