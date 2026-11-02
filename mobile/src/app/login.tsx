import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, TouchableWithoutFeedback, Keyboard, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import {
  checkBiometricsCapability,
  getBiometricAccount,
  saveBiometricAccount,
  removeBiometricAccount,
  promptBiometricAuthentication,
  BiometricCapability,
} from '../services/biometrics';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [biometricCap, setBiometricCap] = useState<BiometricCapability>({
    hasHardware: false,
    isEnrolled: false,
    available: false,
    biometryType: 'generic',
    label: 'Face ID',
  });
  const [savedBiometricAccount, setSavedBiometricAccount] = useState<{ token: string; user: any } | null>(null);

  const hasAutoPromptedRef = useRef(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const navigateAfterLogin = (userType: string) => {
    if (userType === 'admin') {
      router.replace('/(admin)');
    } else if (userType === 'patient') {
      router.replace('/(paciente)');
    } else {
      router.replace('/(tabs)');
    }
  };

  useEffect(() => {
    async function initBiometrics() {
      try {
        const cap = await checkBiometricsCapability();
        setBiometricCap(cap);
        const account = await getBiometricAccount();
        setSavedBiometricAccount(account);

        // Se há biometria configurada e credenciais salvas, dispara o prompt nativo uma vez
        if (account && cap.available && !hasAutoPromptedRef.current) {
          hasAutoPromptedRef.current = true;
          setTimeout(() => {
            handleBiometricLogin(account);
          }, 350);
        }
      } catch (err) {
        console.warn('Erro ao inicializar biometria na tela de login:', err);
      }
    }
    initBiometrics();
  }, []);

  const handleBiometricLogin = async (accountToUse = savedBiometricAccount) => {
    if (!accountToUse) return;
    setErrorMsg('');
    setLoadingLocal(true);

    try {
      const auth = await promptBiometricAuthentication(
        `Autentique-se com ${biometricCap.label} para entrar no Yelo`
      );

      if (auth.success) {
        await signIn(accountToUse.token, accountToUse.user);
        const userType = accountToUse.user?.type || 'psychologist';
        navigateAfterLogin(userType);
      } else if (auth.error && auth.error !== 'Autenticação cancelada.') {
        setErrorMsg(auth.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha na autenticação biométrica.');
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleForgetBiometrics = () => {
    Alert.alert(
      'Desvincular Biometria',
      'Deseja remover as credenciais biométricas salvas neste aparelho? Você precisará digitar seu e-mail e senha para acessar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await removeBiometricAccount();
            setSavedBiometricAccount(null);
          },
        },
      ]
    );
  };

  const handleLogin = async () => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Por favor, preencha e-mail e senha.');
      return;
    }
    setErrorMsg('');
    setLoadingLocal(true);

    try {
      let tokenStr = '';
      let userType = 'psychologist';
      let userData: any = null;

      try {
        // 1. Tenta login como Psicólogo ou Admin
        const response = await api.post('/api/psychologists/login', {
          email: cleanEmail,
          password
        });
        tokenStr = response.data.token;
        userType = response.data.type || (response.data.isAdmin ? 'admin' : 'psychologist');
        userData = {
          id: response.data.id,
          nome: response.data.nome,
          email: response.data.email,
          type: userType,
          slug: response.data.slug,
          fotoUrl: response.data.fotoUrl
        };
      } catch (psiErr: any) {
        // 2. Se não encontrou o e-mail na base de profissionais/admin, tenta como Paciente
        const status = psiErr.response?.status;
        const errText = psiErr.response?.data?.error || '';

        if (status === 401 && (errText.includes('não encontrado') || errText.includes('inválido'))) {
          try {
            const patientRes = await api.post('/api/patients/login', {
              email: cleanEmail,
              password
            });
            tokenStr = patientRes.data.token;
            userType = 'patient';
            userData = {
              id: patientRes.data.id,
              nome: patientRes.data.nome,
              email: patientRes.data.email,
              type: userType
            };
          } catch (patientErr: any) {
            throw patientErr;
          }
        } else {
          throw psiErr;
        }
      }

      if (!tokenStr) {
        throw new Error('Falha ao receber token de acesso do servidor.');
      }

      // Salva a sessão no SecureStore de forma segura
      await signIn(tokenStr, userData);
      
      // Se o aparelho possui biometria cadastrada e ainda não está salva para esta conta, oferece ativar
      if (biometricCap.available && !savedBiometricAccount) {
        Alert.alert(
          `Ativar ${biometricCap.label}?`,
          `Deseja usar o ${biometricCap.label} para entrar mais rápido nas próximas vezes?`,
          [
            {
              text: 'Agora não',
              style: 'cancel',
              onPress: () => navigateAfterLogin(userType),
            },
            {
              text: `Ativar ${biometricCap.label}`,
              onPress: async () => {
                try {
                  const auth = await promptBiometricAuthentication(
                    `Confirme com ${biometricCap.label} para registrar seu acesso rápido`
                  );
                  if (auth.success) {
                    await saveBiometricAccount(tokenStr, userData);
                  }
                } catch (e) {
                  console.warn('Erro ao ativar biometria pós-login:', e);
                } finally {
                  navigateAfterLogin(userType);
                }
              },
            },
          ]
        );
      } else {
        navigateAfterLogin(userType);
      }
    } catch (error: any) {
      console.warn('Erro na autenticação:', error?.response?.data || error.message);
      const backendMessage = error.response?.data?.error;
      
      if (backendMessage) {
        setErrorMsg(backendMessage);
      } else if (error.message === 'Network Error' || error.code === 'ECONNABORTED') {
        setErrorMsg('Não foi possível conectar ao servidor. Verifique sua conexão.');
      } else {
        setErrorMsg('E-mail ou senha incorretos.');
      }
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* SVG Doodles simulados via blur bubbles */}
            <View className="absolute -top-10 -left-10 w-40 h-40 bg-[#d1fae5] rounded-full blur-3xl opacity-50" />
            <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#cffafe] rounded-full blur-3xl opacity-50" />

            {/* APP AUTH BOX */}
            <View className="w-full max-w-[420px] bg-white rounded-[24px] p-8 shadow-sm border border-[#f0f0f0]" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 40, shadowOffset: { width: 0, height: 10 }}}>
              
              {/* TOP BAR */}
              <View className="flex-row items-center justify-between mb-8">
                <TouchableOpacity 
                  onPress={() => { if (router.canGoBack()) router.back(); }}
                  className="w-10 h-10 rounded-full bg-[#f3f4f6] items-center justify-center"
                >
                  <Feather name="chevron-left" size={24} color="#333" />
                </TouchableOpacity>
                <Image 
                  source={require('../../assets/images/logo-escura.png')} 
                  style={{ height: 28, resizeMode: 'contain', width: 100 }}
                />
                <View className="w-10" />
              </View>

              <Text className="text-[28px] text-[#1B4332] leading-tight mb-2 font-title">Bem-vindo/a de volta</Text>
              <Text className="text-[15px] text-[#666] mb-6 font-sans">Acesse sua conta para continuar.</Text>

              {/* CARD DE LOGIN BIOMÉTRICO (SE ATIVADO) */}
              {savedBiometricAccount && (
                <View className="mb-6 p-5 rounded-[20px] bg-[#f0fdf4] border border-[#bbf7d0] items-center">
                  <View className="w-16 h-16 rounded-full bg-[#1B4332] items-center justify-center mb-2 shadow-sm overflow-hidden">
                    {savedBiometricAccount.user?.fotoUrl ? (
                      <Image 
                        source={{ uri: savedBiometricAccount.user.fotoUrl }} 
                        style={{ width: 64, height: 64 }}
                      />
                    ) : (
                      <Feather name="user" size={28} color="#fff" />
                    )}
                  </View>
                  <Text className="text-[17px] font-bold text-[#1B4332] font-title text-center">
                    {savedBiometricAccount.user?.nome || 'Profissional Yelo'}
                  </Text>
                  <Text className="text-[13px] text-[#4b5563] font-sans mb-4 text-center">
                    {savedBiometricAccount.user?.email}
                  </Text>

                  <TouchableOpacity
                    onPress={() => handleBiometricLogin(savedBiometricAccount)}
                    className="w-full bg-[#1B4332] py-4 rounded-full flex-row items-center justify-center"
                    style={{ shadowColor: '#1B4332', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } }}
                    disabled={loadingLocal}
                  >
                    {loadingLocal ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Feather name="shield" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text className="text-white font-bold text-[16px] font-sans">
                          Entrar com {biometricCap.label}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleForgetBiometrics}
                    className="mt-3 py-1"
                  >
                    <Text className="text-[#9ca3af] text-[12px] font-medium font-sans">
                      Desvincular biometria deste aparelho
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {savedBiometricAccount && (
                <View className="flex-row items-center mb-6">
                  <View className="flex-1 h-[1px] bg-[#e5e7eb]" />
                  <Text className="px-3 text-[#9ca3af] text-[11px] font-semibold font-sans uppercase">Ou entre com e-mail e senha</Text>
                  <View className="flex-1 h-[1px] bg-[#e5e7eb]" />
                </View>
              )}

              {/* FORMULÁRIO */}
              <View className="mb-4 relative">
                <Text className="text-[13px] font-bold text-[#4b5563] mb-1.5 tracking-wide uppercase font-sans">E-mail</Text>
                <TextInput
                  className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3.5 text-[16px] text-[#111] font-sans"
                  placeholder="seu@email.com"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View className="mb-2 relative">
                <Text className="text-[13px] font-bold text-[#4b5563] mb-1.5 tracking-wide uppercase font-sans">Senha</Text>
                <View className="relative justify-center">
                  <TextInput
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] pl-4 pr-12 py-3.5 text-[16px] text-[#111] font-sans"
                    placeholder="Sua senha secreta"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity 
                    className="absolute right-4 z-10 p-1"
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              {errorMsg ? (
                <Text className="text-red-500 text-[14px] font-sans mt-2 mb-4 text-center bg-red-50 p-2 rounded-lg">{errorMsg}</Text>
              ) : <View className="h-4 mb-4" />}

              <TouchableOpacity 
                className="w-full bg-[#1B4332] py-4 rounded-full items-center justify-center flex-row"
                style={{ shadowColor: '#1B4332', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 8 }}}
                onPress={handleLogin}
                disabled={loadingLocal}
              >
                {loadingLocal ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-[16px] font-sans">Entrar</Text>
                )}
              </TouchableOpacity>
              
              {/* DIVIDER */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-[1px] bg-[#e5e7eb]" />
                <Text className="px-4 text-[#9ca3af] text-[13px] font-semibold font-sans">OU ACESSE COM</Text>
                <View className="flex-1 h-[1px] bg-[#e5e7eb]" />
              </View>

              {/* SOCIAL BUTTONS */}
              <TouchableOpacity className="w-full bg-white border border-[#e5e7eb] py-3.5 rounded-full items-center justify-center flex-row mb-3">
                <Image 
                  source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png' }} 
                  style={{ width: 18, height: 18, marginRight: 10 }}
                />
                <Text className="text-[#3c4043] font-semibold text-[15px] font-sans">Continuar com o Google</Text>
              </TouchableOpacity>

              <TouchableOpacity className="w-full bg-black border border-black py-3.5 rounded-full items-center justify-center flex-row mb-6">
                <Image 
                  source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/120px-Apple_logo_black.svg.png' }} 
                  style={{ width: 16, height: 19, marginRight: 10, tintColor: 'white' }}
                />
                <Text className="text-white font-semibold text-[15px] font-sans">Continuar com a Apple</Text>
              </TouchableOpacity>

              {/* FOOTER LINKS */}
              <View className="items-center mt-2">
                <TouchableOpacity className="mb-4" onPress={() => router.push('/recuperar-senha')}>
                  <Text className="text-[#6b7280] font-medium text-[15px] font-sans">Esqueceu sua senha?</Text>
                </TouchableOpacity>
                
                <View className="flex-row mb-4">
                  <Text className="text-[#6b7280] text-[15px] font-sans">Não tem uma conta? </Text>
                  <TouchableOpacity onPress={() => router.push('/cadastro')}>
                    <Text className="text-[#1B4332] font-bold text-[15px] font-sans">Cadastre-se</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
