import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Para testar no emulador Android local, use 10.0.2.2.
// Para testar no Expo Go (celular físico), use o IP da sua máquina na rede local (ex: 192.168.1.X).
const LOCAL_API = 'http://192.168.0.2:3001';

const api = axios.create({
  baseURL: LOCAL_API, // Será trocado pela URL de prod depois
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('Yelo_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API ERROR [${error.response.status}] at ${error.config.url}:`, error.response.data);
    } else {
      console.error(`API ERROR at ${error.config.url}:`, error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
