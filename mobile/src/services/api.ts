import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Determina dinamicamente a URL base do backend Yelo:
 * - Em produção (__DEV__ === false): https://www.yelopsi.com.br
 * - Em variável de ambiente: EXPO_PUBLIC_API_URL
 * - No Expo Go / Celular físico: extrai o IP da máquina local via Metro hostUri
 * - No Emulador Android: 10.0.2.2:3001
 * - No Simulador iOS / Web: localhost:3001
 */
export const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (!__DEV__) {
    return 'https://www.yelopsi.com.br';
  }

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri;
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

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('Yelo_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
  (response) => response,
  async (error) => {
    if (error.response) {
      console.warn(`API [${error.response.status}] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, error.response.data);
      // Se a sessão expirou no backend (Token inválido/expirado)
      if (error.response.status === 401 && error.config?.url !== '/api/psychologists/login' && error.config?.url !== '/api/patients/login') {
        try {
          await SecureStore.deleteItemAsync('Yelo_token');
          await SecureStore.deleteItemAsync('Yelo_user');
        } catch (_) {}
      }
    } else {
      console.warn(`API Network/Timeout Error ${error.config?.url}:`, error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
