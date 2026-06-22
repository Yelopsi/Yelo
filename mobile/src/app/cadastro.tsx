import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function CadastroScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { signIn } = useAuth();
  const router = useRouter();

  const handleCadastro = async () => {
    if (!nome || !email || !password || !confirmPassword) {
      setErrorMsg('Preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }
    if (!termosAceitos) {
      setErrorMsg('Você precisa aceitar os termos de uso.');
      return;
    }
    setErrorMsg('');
    setLoadingLocal(true);
    
    // Bypass: Simula um cadastro e loga automaticamente
    setTimeout(async () => {
      await signIn('fake-token', { id: 2, nome: nome, email: email });
      router.replace('/(tabs)');
      setLoadingLocal(false);
    }, 800);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, paddingVertical: 20 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* SVG Doodles simulados via blur bubbles */}
            <View className="absolute -top-10 -left-10 w-40 h-40 bg-[#d1fae5] rounded-full blur-3xl opacity-50" />
            <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#cffafe] rounded-full blur-3xl opacity-50" />

            {/* APP AUTH BOX */}
            <View className="w-full max-w-[500px] bg-white rounded-[24px] p-6 shadow-sm border border-[#f0f0f0]" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 40, shadowOffset: { width: 0, height: 10 }}}>
              
              {/* TOP BAR */}
              <View className="flex-row items-center justify-between mb-4">
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

              <Text className="text-[28px] text-[#1B4332] leading-tight mb-2 font-title text-center">Paciente, crie sua conta</Text>
              <Text className="text-[15px] text-[#666] mb-5 font-sans text-center">Sua jornada de cuidado começa aqui.</Text>

              {/* FORMULÁRIO */}
              <View className="flex-row flex-wrap justify-between">
                {/* Nome */}
                <View className="mb-3 relative w-full sm:w-[48%]">
                  <Text className="text-[13px] font-bold text-[#4b5563] mb-1 tracking-wide uppercase font-sans">Nome Completo</Text>
                  <TextInput
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[16px] text-[#111] font-sans"
                    placeholder="Seu nome"
                    placeholderTextColor="#9ca3af"
                    value={nome}
                    onChangeText={setNome}
                  />
                </View>

                {/* E-mail */}
                <View className="mb-3 relative w-full sm:w-[48%]">
                  <Text className="text-[13px] font-bold text-[#4b5563] mb-1 tracking-wide uppercase font-sans">E-mail</Text>
                  <TextInput
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[16px] text-[#111] font-sans"
                    placeholder="seu@email.com"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                {/* Senha */}
                <View className="mb-3 relative w-full sm:w-[48%]">
                  <Text className="text-[13px] font-bold text-[#4b5563] mb-1 tracking-wide uppercase font-sans">Senha</Text>
                  <View className="relative justify-center">
                    <TextInput
                      className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] pl-4 pr-12 py-3 text-[16px] text-[#111] font-sans"
                      placeholder="Mínimo 6 caracteres"
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

                {/* Confirmar Senha */}
                <View className="mb-3 relative w-full sm:w-[48%]">
                  <Text className="text-[13px] font-bold text-[#4b5563] mb-1 tracking-wide uppercase font-sans">Confirmar Senha</Text>
                  <View className="relative justify-center">
                    <TextInput
                      className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] pl-4 pr-12 py-3 text-[16px] text-[#111] font-sans"
                      placeholder="Repita a senha"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity 
                      className="absolute right-4 z-10 p-1"
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Termos de Uso */}
              <TouchableOpacity 
                className="flex-row items-center mt-2 mb-4"
                onPress={() => setTermosAceitos(!termosAceitos)}
                activeOpacity={0.7}
              >
                <View className={`w-5 h-5 rounded-[6px] border ${termosAceitos ? 'bg-[#1B4332] border-[#1B4332]' : 'bg-white border-[#d1d5db]'} items-center justify-center mr-3`}>
                  {termosAceitos && <Feather name="check" size={14} color="white" />}
                </View>
                <Text className="text-[#666] text-[13px] font-sans flex-1">
                  Li e aceito os <Text className="text-[#1B4332] font-bold">Termos de Uso</Text> e <Text className="text-[#1B4332] font-bold">Política de Privacidade</Text>.
                </Text>
              </TouchableOpacity>

              {errorMsg ? (
                <Text className="text-red-500 text-[14px] font-sans mb-4 text-center bg-red-50 p-2 rounded-lg">{errorMsg}</Text>
              ) : null}

              <TouchableOpacity 
                className="w-full bg-[#1B4332] py-3.5 rounded-full items-center justify-center flex-row"
                style={{ shadowColor: '#1B4332', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 8 }}}
                onPress={handleCadastro}
                disabled={loadingLocal}
              >
                {loadingLocal ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-[15px] font-sans">Criar Conta Gratuita</Text>
                )}
              </TouchableOpacity>
              
              {/* DIVIDER */}
              <View className="flex-row items-center my-4">
                <View className="flex-1 h-[1px] bg-[#e5e7eb]" />
                <Text className="px-4 text-[#9ca3af] text-[12px] font-semibold font-sans">OU ACESSE COM</Text>
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

              {/* FOOTER LINKS */}
              <View className="items-center mt-3">
                <View className="flex-row mb-3">
                  <Text className="text-[#6b7280] text-[14px] font-sans">Já tem uma conta? </Text>
                  <TouchableOpacity onPress={() => router.push('/login')}>
                    <Text className="text-[#1B4332] font-bold text-[14px] font-sans">Faça Login</Text>
                  </TouchableOpacity>
                </View>
                
                <Text className="text-[#666] text-[13px] font-sans">
                  É psicólogo(a)? <Text className="text-[#1B4332] font-bold">Cadastrar-se</Text>
                </Text>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
