import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';

export default function GeradorBio() {
  const router = useRouter();
  
  const [nome, setNome] = useState('');
  const [atuacao, setAtuacao] = useState('');
  const [publico, setPublico] = useState('');
  const [diferencial, setDiferencial] = useState('');
  const [bioGerada, setBioGerada] = useState('');

  const gerarBio = () => {
    if (!nome || !atuacao || !publico || !diferencial) {
      Alert.alert('Ops!', 'Preencha todos os campos para gerar uma bio de impacto.');
      return;
    }

    const templates = [
      `🧠 ${nome} | ${atuacao}\n✨ Ajudando ${publico} a superar desafios através da terapia.\n💡 Meu foco é: ${diferencial}\n👇 Agende sua sessão:`,
      `🌱 ${atuacao} | ${nome}\nCuidando da saúde mental de ${publico}.\nMeu diferencial é oferecer um espaço seguro focado em ${diferencial}.\nAgende seu horário no link abaixo ⬇️`,
      `Terapia para ${publico} 🛋️\nOi, sou ${nome}, especialista em ${atuacao}.\nAcredito que o processo terapêutico precisa de ${diferencial}.\nVamos conversar? Clique no link:`
    ];

    const randomIndex = Math.floor(Math.random() * templates.length);
    setBioGerada(templates[randomIndex]);
  };

  const copiarBio = async () => {
    if (bioGerada) {
      await Clipboard.setStringAsync(bioGerada);
      Alert.alert('Copiado!', 'Sua nova bio foi copiada para a área de transferência.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center px-[20px] py-[15px] bg-[#1B4332]">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white/70 font-sans font-semibold text-[15px]">&larr; Voltar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="bg-[#1B4332] px-[20px] pt-[20px] pb-[60px] items-center">
            <Text className="font-title text-white text-[30px] text-center mb-[10px]">Gerador de Bio para Psicólogos</Text>
            <Text className="font-sans text-white/80 text-[16px] text-center max-w-[320px]">Deixe seu Instagram mais profissional em segundos. Preencha os campos abaixo:</Text>
          </View>

          <View className="px-[20px] mt-[-40px]">
            {/* Form */}
            <View className="bg-white rounded-[24px] p-[25px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-[#f0f0f0] mb-[20px]">
              
              <View className="mb-[20px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Seu Nome (ex: Psi João da Silva)</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] font-sans text-[15px] text-[#333]"
                  placeholder="Seu nome"
                  placeholderTextColor="#adb5bd"
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
              
              <View className="mb-[20px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Abordagem / Especialidade (ex: TCC)</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] font-sans text-[15px] text-[#333]"
                  placeholder="Sua abordagem"
                  placeholderTextColor="#adb5bd"
                  value={atuacao}
                  onChangeText={setAtuacao}
                />
              </View>

              <View className="mb-[20px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Público Alvo (ex: Mulheres com ansiedade)</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] font-sans text-[15px] text-[#333]"
                  placeholder="Seu público"
                  placeholderTextColor="#adb5bd"
                  value={publico}
                  onChangeText={setPublico}
                />
              </View>

              <View className="mb-[25px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Seu maior diferencial (ex: Acolhimento profundo)</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] font-sans text-[15px] text-[#333]"
                  placeholder="Seu diferencial"
                  placeholderTextColor="#adb5bd"
                  value={diferencial}
                  onChangeText={setDiferencial}
                />
              </View>
              
              <TouchableOpacity 
                onPress={gerarBio}
                className="w-full bg-[#1B4332] py-[16px] rounded-[50px] items-center shadow-[0_4px_10px_rgba(27,67,50,0.3)]"
              >
                <Text className="font-sans font-bold text-white text-[17px]">Gerar Minha Bio Mágica ✨</Text>
              </TouchableOpacity>
            </View>

            {/* Resultado */}
            {bioGerada ? (
              <View className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[24px] p-[25px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] mb-[20px]">
                <Text className="font-title text-[#166534] text-[20px] mb-[15px] text-center">Sua nova Bio está pronta!</Text>
                <View className="bg-white p-[20px] rounded-[16px] border border-[#dcfce7] mb-[20px]">
                  <Text className="font-sans text-[#333] text-[16px] leading-[26px]">{bioGerada}</Text>
                </View>
                <TouchableOpacity 
                  onPress={copiarBio}
                  className="w-full bg-[#FFEE8C] flex-row justify-center items-center py-[16px] rounded-[50px] shadow-[0_4px_10px_rgba(255,238,140,0.4)]"
                >
                  <Feather name="copy" size={20} color="#1B4332" style={{ marginRight: 8 }} />
                  <Text className="font-sans font-bold text-[#1B4332] text-[17px]">Copiar Texto</Text>
                </TouchableOpacity>
              </View>
            ) : null}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
