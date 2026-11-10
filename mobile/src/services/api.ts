import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

let fallbackToCloud = false;

/**
 * Determina dinamicamente a URL base do backend Yelo:
 * - Em produção (__DEV__ === false): https://www.yelopsi.com.br
 * - Em builds EAS Update (nuvem Expo): https://www.yelopsi.com.br
 * - Sem servidor Metro local conectado: https://www.yelopsi.com.br
 * - Em variável de ambiente: EXPO_PUBLIC_API_URL
 * - No Expo Go conectado ao Metro local: extrai o IP da máquina local via Metro hostUri
 * - No Emulador Android: 10.0.2.2:3001
 * - No Simulador iOS / Web: localhost:3001
 */
export const getBaseUrl = (): string => {
  if (fallbackToCloud) {
    return 'https://www.yelopsi.com.br';
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  try {
    if (Updates.updateId) {
      return 'https://www.yelopsi.com.br';
    }
  } catch (_) {}

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (!__DEV__ || !hostUri || hostUri.includes('expo.dev') || hostUri.includes('exp.host') || hostUri.includes('u.expo.dev')) {
    return 'https://www.yelopsi.com.br';
  }

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:3001`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

let cookieClearedOnce = false;
let clearingPromise: Promise<void> | null = null;

/**
 * Limpa o cookie HttpOnly 'token' no jar nativo do sistema (NSURLSession no iOS / OkHttp no Android).
 * No servidor em produção, req.cookies.token tem prioridade sobre o header Authorization: Bearer.
 * Ao limpar o cookie nativo, garantimos que o backend sempre utilize o Bearer token da conta ativa no app.
 */
export const clearServerAuthCookie = async (): Promise<void> => {
  if (clearingPromise) return clearingPromise;
  const baseUrl = getBaseUrl();
  clearingPromise = axios
    .get(`${baseUrl}/logout`, {
      timeout: 4000,
      headers: {
        'x-yelo-client': 'mobile',
      },
    })
    .then(() => {
      cookieClearedOnce = true;
    })
    .catch(() => {
      // Ignora erro caso sem conexão no momento
    })
    .finally(() => {
      clearingPromise = null;
    });
  return clearingPromise;
};

api.interceptors.request.use(
  async (config) => {
    try {
      const reqUrl = config.url || '';
      if (!cookieClearedOnce && !reqUrl.includes('/logout') && !reqUrl.includes('/login')) {
        await clearServerAuthCookie();
      }

      const token = await SecureStore.getItemAsync('Yelo_token');
      if (token && !config.headers?.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const baseUrl = config.baseURL || getBaseUrl();
      if (!config.headers.Origin && !config.headers.origin) {
        config.headers.Origin = baseUrl;
      }
      if (!config.headers.Referer && !config.headers.referer) {
        config.headers.Referer = `${baseUrl}/`;
      }
      config.headers['x-yelo-client'] = 'mobile';
    } catch (e) {
      // Ignora falha de leitura em storage temporário
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  async (response) => {
    const reqUrl = response.config?.url || '';
    if (
      reqUrl.includes('/login') ||
      reqUrl.includes('/register') ||
      reqUrl.includes('/auth/google')
    ) {
      // O backend define Set-Cookie: token=... ao autenticar.
      // Removemos imediatamente o cookie do jar nativo para que a troca rápida de contas
      // use exclusivamente o header Authorization: Bearer <token>.
      await clearServerAuthCookie();
    }
    return response;
  },
  async (error) => {
    if (error.response) {
      const status = error.response.status;
      const reqConfig = error.config;
      const reqUrl = reqConfig?.url || '';

      // Se uma rota retornar 403 ou 401 por interferência de cookie residual de outra conta no jar nativo,
      // limpa o cookie via /logout e repete a requisição uma única vez com o Bearer token atual.
      if (
        (status === 403 || status === 401) &&
        reqConfig &&
        !reqConfig._retriedAfterCookieClear &&
        !reqUrl.includes('/login') &&
        !reqUrl.includes('/register') &&
        !reqUrl.includes('/logout')
      ) {
        reqConfig._retriedAfterCookieClear = true;
        await clearServerAuthCookie();
        const freshToken = await SecureStore.getItemAsync('Yelo_token');
        if (freshToken) {
          reqConfig.headers = reqConfig.headers || {};
          reqConfig.headers.Authorization = `Bearer ${freshToken}`;
          return api.request(reqConfig);
        }
      }

      console.warn(`API [${status}] ${reqConfig?.method?.toUpperCase()} ${reqUrl}:`, error.response.data);
      // Se a sessão realmente expirou no backend (Token inválido/expirado)
      const errMsg = String(error.response.data?.error || '');
      if (
        status === 401 &&
        !reqUrl.includes('/login') &&
        (errMsg.includes('token inválido') || errMsg.includes('nenhum token'))
      ) {
        try {
          await SecureStore.deleteItemAsync('Yelo_token');
          await SecureStore.deleteItemAsync('Yelo_user');
        } catch (_) {}
      }
    } else {
      console.warn(`API Network/Timeout Error ${error.config?.url}:`, error.message);

      // Se a requisição falhar por erro de rede/timeout contra um servidor local (computador desligado / fora da rede Wi-Fi),
      // faz fallback automático para o servidor em nuvem da Yelo em produção e tenta novamente
      const reqConfig = error.config;
      if (reqConfig && !reqConfig._retriedCloudFallback) {
        const currentBase = reqConfig.baseURL || getBaseUrl();
        const isLocal =
          currentBase.includes('localhost') ||
          currentBase.includes('127.0.0.1') ||
          currentBase.includes('10.0.2.2') ||
          currentBase.includes('192.168.') ||
          currentBase.includes('172.') ||
          currentBase.includes('10.');

        if (isLocal) {
          console.warn(`[API] Servidor local (${currentBase}) inacessível. Alternando automaticamente para https://www.yelopsi.com.br`);
          fallbackToCloud = true;
          api.defaults.baseURL = 'https://www.yelopsi.com.br';
          reqConfig._retriedCloudFallback = true;
          reqConfig.baseURL = 'https://www.yelopsi.com.br';
          return api.request(reqConfig);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
