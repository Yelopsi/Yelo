import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function RecuperarSenhaScreen() {
  const [email, setEmail] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const router = useRouter();

  const handleRecuperar = async () => {
    if (!email) {
      setErrorMsg('Informe seu e-mail.');
      return;
    }
    setErrorMsg('');
    setLoadingLocal(true);
    
    // Bypass: Simula envio do email
    setTimeout(() => {
      setSucesso(true);
      setLoadingLocal(false);
    }, 1000);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]">
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

              <Text className="text-[28px] text-[#1B4332] leading-tight mb-2 font-title text-center">Recuperar Senha</Text>
              
              {sucesso ? (
                <View className="items-center py-6">
                  <View className="w-16 h-16 bg-[#d1fae5] rounded-full items-center justify-center mb-4">
                    <Feather name="check" size={32} color="#15803d" />
                  </View>
                  <Text className="text-[16px] text-[#15803d] text-center font-sans font-bold mb-2">E-mail enviado!</Text>
                  <Text className="text-[15px] text-[#666] text-center font-sans">
                    Se o endereço <Text className="font-bold">{email}</Text> estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
                  </Text>
                </View>
              ) : (
                <>
                  <Text className="text-[15px] text-[#666] mb-8 font-sans text-center">
                    Informe seu e-mail para receber as instruções de redefinição.
                  </Text>

                  {/* FORMULÁRIO */}
                  <View className="mb-6 relative">
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

                  {errorMsg ? (
                    <Text className="text-red-500 text-[14px] font-sans mb-4 text-center bg-red-50 p-2 rounded-lg">{errorMsg}</Text>
                  ) : null}

                  <TouchableOpacity 
                    className="w-full bg-[#1B4332] py-4 rounded-full items-center justify-center flex-row"
                    style={{ shadowColor: '#1B4332', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 8 }}}
                    onPress={handleRecuperar}
                    disabled={loadingLocal}
                  >
                    {loadingLocal ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold text-[16px] font-sans">Enviar Link de Redefinição</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* FOOTER LINKS */}
              <View className="items-center mt-8 pt-6 border-t border-[#f0f0f0]">
                <View className="flex-row">
                  <Text className="text-[#6b7280] text-[15px] font-sans">Lembrou a senha? </Text>
                  <TouchableOpacity onPress={() => router.push('/login')}>
                    <Text className="text-[#1B4332] font-bold text-[15px] font-sans">Faça login</Text>
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
