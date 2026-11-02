import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type BiometryType = 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';

export type BiometricCapability = {
  hasHardware: boolean;
  isEnrolled: boolean;
  available: boolean;
  biometryType: BiometryType;
  label: string; // Ex: "Face ID", "Touch ID", "Biometria"
};

export const BIOMETRICS_STORAGE_KEYS = {
  ENABLED: 'yelo_biometrics_enabled',
  TOKEN: 'yelo_biometric_token',
  USER: 'yelo_biometric_user',
};

/**
 * Inspeciona as capacidades biométricas do hardware e sistema operacional.
 */
export async function checkBiometricsCapability(): Promise<BiometricCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        hasHardware: false,
        isEnrolled: false,
        available: false,
        biometryType: 'none',
        label: 'Biometria',
      };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometryType: BiometryType = 'generic';
    let label = 'Biometria';

    const hasFace = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasIris = supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS);

    if (hasFace) {
      biometryType = 'face';
      label = Platform.OS === 'ios' ? 'Face ID' : 'Reconhecimento Facial';
    } else if (hasFingerprint) {
      biometryType = 'fingerprint';
      label = Platform.OS === 'ios' ? 'Touch ID' : 'Impressão Digital';
    } else if (hasIris) {
      biometryType = 'iris';
      label = 'Leitor de Íris';
    } else {
      label = 'Biometria';
    }

    return {
      hasHardware,
      isEnrolled,
      available: hasHardware && isEnrolled,
      biometryType,
      label,
    };
  } catch (err) {
    console.warn('Erro ao verificar biometria:', err);
    return {
      hasHardware: false,
      isEnrolled: false,
      available: false,
      biometryType: 'none',
      label: 'Biometria',
    };
  }
}

/**
 * Retorna se o usuário habilitou o login biométrico no app e se existem credenciais salvas.
 */
export async function isBiometricsActive(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRICS_STORAGE_KEYS.ENABLED);
    const token = await SecureStore.getItemAsync(BIOMETRICS_STORAGE_KEYS.TOKEN);
    return enabled === 'true' && Boolean(token);
  } catch {
    return false;
  }
}

/**
 * Recupera os dados da conta salva para login biométrico.
 */
export async function getBiometricAccount(): Promise<{ token: string; user: any } | null> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRICS_STORAGE_KEYS.ENABLED);
    if (enabled !== 'true') return null;

    const token = await SecureStore.getItemAsync(BIOMETRICS_STORAGE_KEYS.TOKEN);
    const userStr = await SecureStore.getItemAsync(BIOMETRICS_STORAGE_KEYS.USER);

    if (!token || !userStr) return null;
    return {
      token,
      user: JSON.parse(userStr),
    };
  } catch (err) {
    console.warn('Erro ao obter credenciais biométricas:', err);
    return null;
  }
}

/**
 * Salva com segurança as credenciais e ativa o login biométrico.
 */
export async function saveBiometricAccount(token: string, user: any): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIOMETRICS_STORAGE_KEYS.ENABLED, 'true');
    await SecureStore.setItemAsync(BIOMETRICS_STORAGE_KEYS.TOKEN, token);
    await SecureStore.setItemAsync(BIOMETRICS_STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (err) {
    console.error('Erro ao salvar credenciais biométricas:', err);
    throw err;
  }
}

/**
 * Desativa o login biométrico e apaga credenciais salvas do cofre seguro.
 */
export async function removeBiometricAccount(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRICS_STORAGE_KEYS.ENABLED);
    await SecureStore.deleteItemAsync(BIOMETRICS_STORAGE_KEYS.TOKEN);
    await SecureStore.deleteItemAsync(BIOMETRICS_STORAGE_KEYS.USER);
  } catch (err) {
    console.error('Erro ao remover biometria:', err);
  }
}

/**
 * Dispara o prompt nativo de autenticação biométrica (Face ID / Touch ID / Digital).
 */
export async function promptBiometricAuthentication(promptMessage?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const capability = await checkBiometricsCapability();
    if (!capability.hasHardware) {
      return { success: false, error: 'Dispositivo sem hardware biométrico compatível.' };
    }
    if (!capability.isEnrolled) {
      return { success: false, error: 'Nenhuma biometria cadastrada neste aparelho. Configure nos Ajustes do sistema.' };
    }

    const message = promptMessage || `Autentique-se com ${capability.label} para acessar o Yelo`;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar senha',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    if (result.error === 'user_cancel' || result.error === 'app_cancel' || result.error === 'system_cancel') {
      return { success: false, error: 'Autenticação cancelada.' };
    }

    return { success: false, error: 'Biometria não reconhecida.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha na autenticação biométrica.' };
  }
}
