import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { clearServerAuthCookie } from '../services/api';

function decodeJwtPayload(tokenStr: string): { id?: number; type?: string; role?: string } | null {
  try {
    const parts = tokenStr.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let bc = 0, bs = 0, buffer, i = 0; (buffer = padded.charAt(i++)); ) {
      buffer = chars.indexOf(buffer);
      if (~buffer) {
        bs = bc % 4 ? bs * 64 + buffer : buffer;
        if (bc++ % 4) {
          output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
      }
    }
    const jsonStr = decodeURIComponent(
      output
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

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

  const ACCOUNTS_STORAGE_KEY = 'Yelo_connected_accounts_v4';

  // Helper para persistir contas salvas de forma segura
  const persistSavedAccounts = async (accounts: SavedAccount[]) => {
    try {
      setSavedAccounts(accounts);
      await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch (err) {
      console.warn('Erro ao salvar lista de contas conectadas:', err);
    }
  };

  const refreshUser = useCallback(async (): Promise<UserData | null> => {
    try {
      const storedToken = await SecureStore.getItemAsync('Yelo_token');
      const storedUserRaw = await SecureStore.getItemAsync('Yelo_user');
      if (!storedToken) return null;

      await clearServerAuthCookie();

      const jwtPayload = decodeJwtPayload(storedToken);
      let parsedCurrent: UserData | null = null;
      if (storedUserRaw) {
        try {
          parsedCurrent = JSON.parse(storedUserRaw);
        } catch (_) { }
      }

      const effectiveType =
        jwtPayload?.type ||
        jwtPayload?.role ||
        parsedCurrent?.type ||
        (parsedCurrent?.slug === 'admin' ? 'admin' : 'psychologist');

      if (effectiveType === 'patient') {
        return parsedCurrent;
      }

      // Contas de Admin consultam /api/admin/me com o Bearer token de admin
      if (effectiveType === 'admin' || parsedCurrent?.slug === 'admin') {
        const adminRes = await api
          .get('/api/admin/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          })
          .catch(() => null);

        if (adminRes?.data) {
          const adm = adminRes.data;
          if (jwtPayload?.id && adm.id && Number(adm.id) !== Number(jwtPayload.id)) {
            return parsedCurrent;
          }
          let updatedAdmin: UserData | null = null;
          setUser((prev) => {
            if (prev && prev.type && prev.type !== 'admin' && prev.slug !== 'admin') {
              return prev;
            }
            const merged: UserData = {
              id: adm.id ?? jwtPayload?.id ?? prev?.id ?? 1,
              nome: adm.nome || prev?.nome || 'Administrador',
              email: adm.email || prev?.email || 'admin@yelopsi.com.br',
              slug: 'admin',
              fotoUrl: adm.fotoUrl ?? undefined,
              type: 'admin',
              isAdmin: true,
            };
            updatedAdmin = merged;
            SecureStore.setItemAsync('Yelo_user', JSON.stringify(merged)).catch(() => { });
            return merged;
          });

          if (updatedAdmin) {
            const finalAdmin = updatedAdmin as UserData;
            setSavedAccounts((prevAccounts) => {
              const idx = prevAccounts.findIndex((a) => {
                const p = decodeJwtPayload(a.token);
                if (p?.type === 'admin' && (!p.id || Number(p.id) === Number(finalAdmin.id))) {
                  return true;
                }
                return (
                  a.user.type === 'admin' &&
                  a.user.email.toLowerCase() === finalAdmin.email.toLowerCase()
                );
              });
              if (idx >= 0) {
                const clone = [...prevAccounts];
                clone[idx] = { token: storedToken, user: finalAdmin };
                SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(clone)).catch(() => { });
                return clone;
              }
              return prevAccounts;
            });
          }

          return updatedAdmin || parsedCurrent;
        }
        return parsedCurrent;
      }

      // Contas de Psicólogo consultam /api/psychologists/me com o Bearer token da conta
      const res = await api
        .get('/api/psychologists/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
        .catch(() => null);

      if (res?.data) {
        const p = res.data;
        // Garante que a resposta pertence exatamente ao ID do token atual (evita colisão por cookie)
        if (jwtPayload?.id && p.id && Number(p.id) !== Number(jwtPayload.id)) {
          return parsedCurrent;
        }

        let updatedUser: UserData | null = null;
        setUser((prev) => {
          // Se o usuário já alternou para Admin enquanto a requisição estava em trânsito, ignora
          if (prev && (prev.type === 'admin' || prev.slug === 'admin')) {
            return prev;
          }
          if (prev && prev.id && p.id && Number(prev.id) !== Number(p.id)) {
            return prev;
          }
          const isAdminFlag = Boolean(p.isAdmin);
          const merged: UserData = prev
            ? {
              ...prev,
              id: p.id || prev.id,
              nome: p.nome || prev.nome,
              email: p.email || prev.email,
              slug: p.slug || prev.slug,
              fotoUrl: p.fotoUrl || prev.fotoUrl,
              type: 'psychologist',
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
          SecureStore.setItemAsync('Yelo_user', JSON.stringify(merged)).catch(() => { });
          return merged;
        });

        // Sincroniza também na lista de contas salvas (apenas na conta de psicólogo correspondente)
        if (updatedUser) {
          const finalUser = updatedUser as UserData;
          setSavedAccounts((prevAccounts) => {
            const idx = prevAccounts.findIndex(
              (a) =>
                a.user.type !== 'admin' &&
                (Number(a.user.id) === Number(finalUser.id) ||
                  a.user.email.toLowerCase() === finalUser.email.toLowerCase())
            );
            if (idx >= 0) {
              const clone = [...prevAccounts];
              clone[idx] = { token: storedToken, user: finalUser };
              SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(clone)).catch(() => { });
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
        // Limpa o cookie nativo logo na inicialização para garantir uso do Bearer token
        await clearServerAuthCookie();

        // Limpa chaves legadas para garantir que contas antigas não apareçam sem terem sido conectadas
        await SecureStore.deleteItemAsync('Yelo_saved_accounts').catch(() => { });
        await SecureStore.deleteItemAsync('Yelo_connected_accounts_v3').catch(() => { });

        const storedToken = await SecureStore.getItemAsync('Yelo_token');
        const storedUser = await SecureStore.getItemAsync('Yelo_user');
        const storedAccountsRaw = await SecureStore.getItemAsync(ACCOUNTS_STORAGE_KEY);

        let accounts: SavedAccount[] = [];
        if (storedAccountsRaw) {
          try {
            accounts = JSON.parse(storedAccountsRaw);
          } catch (_) { }
        }

        // Repara cada conta salva de acordo com o payload real do seu JWT
        accounts = accounts.map((acc) => {
          const p = decodeJwtPayload(acc.token);
          const tokenType = p?.type || p?.role;
          if (tokenType === 'admin' || acc.user.type === 'admin') {
            const repairedUser: UserData = {
              ...acc.user,
              id: p?.id ?? acc.user.id,
              type: 'admin',
              isAdmin: true,
              slug: 'admin',
            };
            if (
              repairedUser.email === 'costa@anderson.com' ||
              repairedUser.nome === 'Anderson Costaa' ||
              (Number(repairedUser.id) !== 94 &&
                (repairedUser.email?.toLowerCase() === 'pix@yelopsi.com.br' ||
                  repairedUser.fotoUrl?.includes('profile-94')))
            ) {
              repairedUser.nome = 'Administrador';
              repairedUser.email = 'admin@yelopsi.com.br';
              repairedUser.fotoUrl = undefined;
            }
            return { token: acc.token, user: repairedUser };
          }
          return acc;
        });

        if (storedToken && storedUser) {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          setToken(storedToken);
          const parsed: UserData = JSON.parse(storedUser);
          const currentJwt = decodeJwtPayload(storedToken);
          const currentTokenType = currentJwt?.type || currentJwt?.role;

          if (currentTokenType === 'admin' || parsed.type === 'admin') {
            parsed.type = 'admin';
            parsed.isAdmin = true;
            parsed.slug = 'admin';
            if (currentJwt?.id) parsed.id = currentJwt.id;

            // Repara caso a sessão atual de Admin tenha sido sobrescrita por dados de Psicólogo
            if (
              parsed.email === 'costa@anderson.com' ||
              parsed.nome === 'Anderson Costaa' ||
              (Number(parsed.id) !== 94 &&
                (parsed.email?.toLowerCase() === 'pix@yelopsi.com.br' ||
                  parsed.fotoUrl?.includes('profile-94')))
            ) {
              parsed.nome = 'Administrador';
              parsed.email = 'admin@yelopsi.com.br';
              parsed.fotoUrl = undefined;
              await SecureStore.setItemAsync('Yelo_user', JSON.stringify(parsed)).catch(() => { });
            }
          }
          setUser(parsed);

          // Se não havia contas salvas na v4, inicia apenas com a conta logada no momento
          if (accounts.length === 0) {
            accounts = [{ token: storedToken, user: parsed }];
            await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          } else {
            const exists = accounts.some(
              (a) =>
                a.token === storedToken ||
                (a.user.type === parsed.type &&
                  a.user.email.toLowerCase() === parsed.email.toLowerCase())
            );
            if (!exists) {
              accounts.push({ token: storedToken, user: parsed });
            }
            await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          }
        } else {
          accounts = [];
          await SecureStore.deleteItemAsync(ACCOUNTS_STORAGE_KEY).catch(() => { });
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

  // signIn: Login principal na tela /login — inicia apenas com a conta logada
  // (ou adiciona se keepExistingAccounts=true ao conectar conta secundária no modal)
  const signIn = async (newToken: string, userData: UserData, keepExistingAccounts = false) => {
    try {
      // Se for admin, garante a flag isAdmin
      if (userData.type === 'admin') {
        userData.isAdmin = true;
      }

      await SecureStore.setItemAsync('Yelo_token', newToken);
      await SecureStore.setItemAsync('Yelo_user', JSON.stringify(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      await clearServerAuthCookie();

      setToken(newToken);
      setUser(userData);

      let accounts: SavedAccount[] = [];
      if (keepExistingAccounts) {
        const accountsRaw = await SecureStore.getItemAsync(ACCOUNTS_STORAGE_KEY);
        accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
        accounts = accounts.filter(
          (a) =>
            !(
              a.user.type === userData.type &&
              a.user.email.toLowerCase() === userData.email.toLowerCase()
            )
        );
      }
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
      await clearServerAuthCookie();
      delete api.defaults.headers.common['Authorization'];
      await SecureStore.deleteItemAsync('Yelo_token');
      await SecureStore.deleteItemAsync('Yelo_user');
      await SecureStore.deleteItemAsync('Yelo_saved_accounts').catch(() => { });
      await SecureStore.deleteItemAsync(ACCOUNTS_STORAGE_KEY).catch(() => { });
      setToken(null);
      setUser(null);
      setSavedAccounts([]);
    } catch (err) {
      console.error('Erro ao remover sessão local:', err);
    }
  };

  // Alterna o MODO / PAPEL (Admin <-> Psicólogo) na mesma conta autenticada
  const switchRole = async (targetRole: 'admin' | 'psychologist'): Promise<string> => {
    if (!user) return '/login';

    await clearServerAuthCookie();

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
    await clearServerAuthCookie();

    setToken(target.token);
    setUser(target.user);

    // Sincroniza dados reais da conta selecionada em background
    refreshUser();

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
          try {
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
          } catch {
            return {
              success: false,
              error: errText || 'E-mail não encontrado neste ambiente.',
            };
          }
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

      // Adiciona à lista mantendo a conta atual e ativa a nova conta conectada
      await signIn(resToken, resUser, true);
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
