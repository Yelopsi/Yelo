import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export type UserData = {
  id: number;
  nome: string;
  email: string;
  type?: 'psychologist' | 'patient' | 'admin' | string;
  isAdmin?: boolean;
  slug?: string;
  fotoUrl?: string;
};

export type SavedAccount = {
  token: string;
  user: UserData;
};

export type AuthContextData = {
  user: UserData | null;
  token: string | null;
  YeloToken: string | null;
  loading: boolean;
  savedAccounts: SavedAccount[];
  canAccessAdmin: boolean;
  canAccessPsychologist: boolean;
  signIn: (token: string, user: UserData) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (fields: Partial<UserData>) => Promise<void>;
  refreshUser: () => Promise<UserData | null>;
  switchRole: (targetRole: 'admin' | 'psychologist') => Promise<string>;
  switchAccount: (targetEmail: string) => Promise<string>;
  connectAccount: (email: string, password: string) => Promise<{ success: boolean; error?: string; route?: string }>;
  removeSavedAccount: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper para persistir contas salvas de forma segura
  const persistSavedAccounts = async (accounts: SavedAccount[]) => {
    try {
      setSavedAccounts(accounts);
      await SecureStore.setItemAsync('Yelo_saved_accounts', JSON.stringify(accounts));
    } catch (err) {
      console.warn('Erro ao salvar lista de contas conectadas:', err);
    }
  };

  const refreshUser = useCallback(async (): Promise<UserData | null> => {
    try {
      const storedToken = await SecureStore.getItemAsync('Yelo_token');
      if (!storedToken) return null;

      const res = await api.get('/api/psychologists/me').catch(() => null);
      if (res?.data) {
        const p = res.data;
        let updatedUser: UserData | null = null;
        setUser((prev) => {
          const isAdminFlag = prev?.isAdmin ?? (p.isAdmin || prev?.type === 'admin' || false);
          const merged: UserData = prev
            ? {
                ...prev,
                nome: p.nome || prev.nome,
                email: p.email || prev.email,
                slug: p.slug || prev.slug,
                fotoUrl: p.fotoUrl || prev.fotoUrl,
                isAdmin: isAdminFlag,
              }
            : {
                id: p.id,
                nome: p.nome,
                email: p.email,
                slug: p.slug,
                fotoUrl: p.fotoUrl,
                type: 'psychologist',
                isAdmin: isAdminFlag,
              };
          updatedUser = merged;
          SecureStore.setItemAsync('Yelo_user', JSON.stringify(merged)).catch(() => {});
          return merged;
        });

        // Sincroniza também na lista de contas salvas
        if (updatedUser) {
          const finalUser = updatedUser as UserData;
          setSavedAccounts((prevAccounts) => {
            const idx = prevAccounts.findIndex(
              (a) => a.user.email.toLowerCase() === finalUser.email.toLowerCase()
            );
            if (idx >= 0) {
              const clone = [...prevAccounts];
              clone[idx] = { token: storedToken, user: finalUser };
              SecureStore.setItemAsync('Yelo_saved_accounts', JSON.stringify(clone)).catch(() => {});
              return clone;
            }
            return prevAccounts;
          });
        }

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
        const storedAccountsRaw = await SecureStore.getItemAsync('Yelo_saved_accounts');

        let accounts: SavedAccount[] = [];
        if (storedAccountsRaw) {
          try {
            accounts = JSON.parse(storedAccountsRaw);
          } catch (_) {}
        }

        if (storedToken && storedUser) {
          setToken(storedToken);
          const parsed: UserData = JSON.parse(storedUser);
          if (parsed.type === 'admin') {
            parsed.isAdmin = true;
          }
          setUser(parsed);

          // Garante que a conta ativa está presente em savedAccounts
          const exists = accounts.some(
            (a) => a.user.email.toLowerCase() === parsed.email.toLowerCase()
          );
          if (!exists) {
            accounts.push({ token: storedToken, user: parsed });
            await SecureStore.setItemAsync('Yelo_saved_accounts', JSON.stringify(accounts));
          }
        }
        setSavedAccounts(accounts);
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
      // Se for admin, garante a flag isAdmin
      if (userData.type === 'admin') {
        userData.isAdmin = true;
      }

      await SecureStore.setItemAsync('Yelo_token', newToken);
      await SecureStore.setItemAsync('Yelo_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);

      // Salva ou atualiza a conta no histórico de contas conectadas
      const accountsRaw = await SecureStore.getItemAsync('Yelo_saved_accounts');
      let accounts: SavedAccount[] = accountsRaw ? JSON.parse(accountsRaw) : [];
      accounts = accounts.filter(
        (a) => a.user.email.toLowerCase() !== userData.email.toLowerCase()
      );
      accounts.push({ token: newToken, user: userData });
      await persistSavedAccounts(accounts);

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

  // Alterna o MODO / PAPEL (Admin <-> Psicólogo) na mesma conta autenticada
  const switchRole = async (targetRole: 'admin' | 'psychologist'): Promise<string> => {
    if (!user) return '/login';

    const updatedUser: UserData = {
      ...user,
      type: targetRole,
      isAdmin: true, // Preserva a credencial de admin
    };

    await SecureStore.setItemAsync('Yelo_user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    // Atualiza na lista de contas salvas
    if (token) {
      const updatedAccounts = savedAccounts.map((a) =>
        a.user.email.toLowerCase() === user.email.toLowerCase()
          ? { token, user: updatedUser }
          : a
      );
      await persistSavedAccounts(updatedAccounts);
    }

    return targetRole === 'admin' ? '/(admin)' : '/(tabs)';
  };

  // Alterna para outra CONTA salva (outro e-mail / credencial)
  const switchAccount = async (targetEmail: string): Promise<string> => {
    const target = savedAccounts.find(
      (a) => a.user.email.toLowerCase() === targetEmail.toLowerCase()
    );
    if (!target) {
      throw new Error('Conta não encontrada.');
    }

    await SecureStore.setItemAsync('Yelo_token', target.token);
    await SecureStore.setItemAsync('Yelo_user', JSON.stringify(target.user));
    api.defaults.headers.common['Authorization'] = `Bearer ${target.token}`;
    setToken(target.token);
    setUser(target.user);

    const dest =
      target.user.type === 'admin'
        ? '/(admin)'
        : target.user.type === 'patient'
        ? '/(paciente)'
        : '/(tabs)';
    return dest;
  };

  // Conecta uma NOVA conta sem precisar sair da atual
  const connectAccount = async (
    emailInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; error?: string; route?: string }> => {
    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      let resToken = '';
      let resUser: UserData | null = null;
      let targetRoute = '/(tabs)';

      try {
        const res = await api.post('/api/psychologists/login', {
          email: cleanEmail,
          password: passwordInput,
        });

        resToken = res.data.token;
        const uType = res.data.type || (res.data.isAdmin ? 'admin' : 'psychologist');
        resUser = {
          id: res.data.id,
          nome: res.data.nome,
          email: res.data.email,
          type: uType,
          isAdmin: res.data.isAdmin || uType === 'admin',
          slug: res.data.slug,
          fotoUrl: res.data.fotoUrl,
        };
        targetRoute = uType === 'admin' ? '/(admin)' : '/(tabs)';
      } catch (err: any) {
        // Tenta como paciente se não for psicólogo/admin
        const status = err.response?.status;
        const errText = err.response?.data?.error || '';
        if (status === 401 && (errText.includes('não encontrado') || errText.includes('inválido'))) {
          const pRes = await api.post('/api/patients/login', {
            email: cleanEmail,
            password: passwordInput,
          });
          resToken = pRes.data.token;
          resUser = {
            id: pRes.data.id,
            nome: pRes.data.nome,
            email: pRes.data.email,
            type: 'patient',
          };
          targetRoute = '/(paciente)';
        } else {
          return {
            success: false,
            error: err.response?.data?.error || 'E-mail ou senha incorretos.',
          };
        }
      }

      if (!resToken || !resUser) {
        return { success: false, error: 'Falha na autenticação do servidor.' };
      }

      // Adiciona à lista e ativa a nova conta
      await signIn(resToken, resUser);
      return { success: true, route: targetRoute };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro ao conectar conta.' };
    }
  };

  // Remove uma conta da lista de contas salvas
  const removeSavedAccount = async (emailToRemove: string) => {
    const updated = savedAccounts.filter(
      (a) => a.user.email.toLowerCase() !== emailToRemove.toLowerCase()
    );
    await persistSavedAccounts(updated);
  };

  // Verifica se o usuário tem privilégio de Admin (na conta ativa ou em alguma conectada)
  const canAccessAdmin = !!(
    user?.isAdmin ||
    user?.type === 'admin' ||
    savedAccounts.some((a) => a.user.isAdmin || a.user.type === 'admin')
  );

  // Verifica se o usuário tem acesso de Psicólogo
  const canAccessPsychologist = !!(
    user?.type === 'psychologist' ||
    user?.isAdmin ||
    user?.type === 'admin' ||
    savedAccounts.some((a) => a.user.type === 'psychologist' || a.user.isAdmin)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        YeloToken: token,
        loading,
        savedAccounts,
        canAccessAdmin,
        canAccessPsychologist,
        signIn,
        signOut,
        updateUser,
        refreshUser,
        switchRole,
        switchAccount,
        connectAccount,
        removeSavedAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
