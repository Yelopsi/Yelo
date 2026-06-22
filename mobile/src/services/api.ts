import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Para testar no emulador Android local, use 10.0.2.2.
// Para testar no Expo Go (celular físico), use o IP da sua máquina na rede local (ex: 192.168.1.X).
const LOCAL_API = 'http://192.168.0.49:3001';

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

export default api;
