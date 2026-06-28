import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function PerfilAdminScreen() {
  const [nome, setNome] = useState('Admin Yelo');
  const [email, setEmail] = useState('admin@yelopsi.com.br');
  const [telefone, setTelefone] = useState('(11) 98888-7777');

  const handleSave = () => {
    Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Meu Perfil Admin</Text>
          <Text className="font-sans text-[#666] text-[14px]">Gerencie suas credenciais de acesso.</Text>
        </View>

        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          
          <View className="items-center mb-[25px] mt-[10px]">
            <View className="relative">
              <Image 
                source={{ uri: "https://placehold.co/150x150?text=AD" }}
                className="w-[100px] h-[100px] rounded-full border-4 border-[#f3e8ff]"
              />
              <TouchableOpacity className="absolute bottom-0 right-0 bg-[#8b5cf6] w-[32px] h-[32px] rounded-full items-center justify-center border-2 border-white">
                <Feather name="camera" size={14} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-[15px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">Nome Completo</Text>
            <TextInput 
              value={nome}
              onChangeText={setNome}
              className="border border-[#e2e8f0] rounded-[8px] p-[12px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
          
          <View className="mb-[15px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">E-mail de Acesso</Text>
            <TextInput 
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              className="border border-[#e2e8f0] rounded-[8px] p-[12px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
          
          <View className="mb-[10px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">Telefone</Text>
            <TextInput 
              value={telefone}
              onChangeText={setTelefone}
              keyboardType="phone-pad"
              className="border border-[#e2e8f0] rounded-[8px] p-[12px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleSave} className="bg-[#1B4332] py-[15px] rounded-[12px] items-center flex-row justify-center mt-[10px] shadow-[0_4px_15px_rgba(27,67,50,0.2)]">
          <Feather name="save" size={18} color="white" />
          <Text className="text-white font-title text-[16px] ml-[10px]">Atualizar Cadastro</Text>
        </TouchableOpacity>

        <View className="h-[120px]" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
