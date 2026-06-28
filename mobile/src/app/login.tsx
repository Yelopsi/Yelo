import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, TouchableWithoutFeedback, Keyboard, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Preencha e-mail e senha.');
      return;
    }
    setErrorMsg('');
    setLoadingLocal(true);
    try {
      let response;
      let userData;
      let tokenStr;
      let userType;

      try {
        // 1. Tenta login como Psicólogo (que também cobre Admins novos)
        response = await api.post('/api/psychologists/login', {
          email,
          password
        });
        tokenStr = response.data.token;
        userType = response.data.type || 'psychologist';
        userData = {
          id: response.data.id,
          nome: response.data.nome,
          email: response.data.email,
          type: userType
        };
      } catch (err: any) {
        if (err.response && err.response.status === 401) {
          // 2. Fallback para rota admin legado
          response = await api.post('/api/admin/login', {
            email,
            password
          });
          tokenStr = response.data.token;
          userType = 'admin';
          userData = {
            id: response.data.user.id,
            nome: response.data.user.nome,
            email: response.data.user.email,
            type: userType
          };
        } else {
          throw err;
        }
      }

      // Salva no SecureStore
      await signIn(tokenStr, userData);
      
      // Redireciona dependendo de quem está logando
      const destination = userType === 'admin' ? '/(admin)' : '/(tabs)';
      
      router.replace(destination);
    } catch (error: any) {
      console.error(error);
      const isPsi = email.toLowerCase().includes('psi') || email.toLowerCase().includes('teste');
      const destination = isPsi ? '/(tabs)' : '/(admin)';

      // Fallback amigável caso a API não esteja rodando ou a rota de login não exista ainda (404)
      if (error.message === 'Network Error' || (error.response && (error.response.status >= 500 || error.response.status === 404))) {
        Alert.alert(
          'Servidor Indisponível (Testes)',
          'A rota de login da API não foi encontrada ou o servidor está offline. Entrando em Modo Offline (Testes).',
          [
            { 
              text: 'Entrar Offline', 
              onPress: async () => {
                await signIn('offline-token', { id: 1, nome: isPsi ? 'Psicólogo (Offline)' : 'Admin (Offline)', email: email });
                router.replace(destination);
              }
            }
          ]
        );
      } else {
        setErrorMsg('E-mail ou senha inválidos.');
      }
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" backgroundColor="transparent" translucent={true} />
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
