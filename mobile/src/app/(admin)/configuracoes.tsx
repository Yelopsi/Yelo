import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ConfiguracoesScreen() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegistrations, setAllowRegistrations] = useState(true);

  const [priceEssencial, setPriceEssencial] = useState('99.90');
  const [priceClinico, setPriceClinico] = useState('149.90');
  const [priceReferencia, setPriceReferencia] = useState('249.90');

  const [whatsapp, setWhatsapp] = useState('5511999999999');
  const [email, setEmail] = useState('suporte@yelopsi.com.br');

  const toggleMaintenance = (val: boolean) => {
    if (val) {
      Alert.alert(
        "Atenção: Modo Manutenção",
        "Ativar o modo manutenção derrubará a plataforma para todos os usuários imediatamente (exceto administradores). Tem certeza?",
        [
          { text: "Cancelar", style: "cancel", onPress: () => setMaintenanceMode(false) },
          { text: "Sim, Tirar do Ar", style: "destructive", onPress: () => setMaintenanceMode(true) }
        ]
      );
    } else {
      setMaintenanceMode(false);
    }
  };

  const handleSave = () => {
    Alert.alert("Sucesso", "Configurações salvas com sucesso no servidor.");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Configurações Globais</Text>
          <Text className="font-sans text-[#666] text-[14px]">Preços, Manutenção e Contatos Yelo.</Text>
        </View>

        {/* Bloco: Estado da Plataforma */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row items-center mb-[15px]">
            <Text className="text-[18px] mr-[8px]">🚦</Text>
            <Text className="font-title text-[#333] text-[16px]">Estado da Plataforma</Text>
          </View>
          
          <View className="flex-row justify-between items-center py-[10px] border-b border-[#f1f5f9]">
            <View className="flex-1 mr-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[2px]">Modo Manutenção</Text>
              <Text className="font-sans text-[#64748b] text-[12px]">Bloqueia o acesso de usuários (exceto admins).</Text>
            </View>
            <Switch 
              value={maintenanceMode}
              onValueChange={toggleMaintenance}
              trackColor={{ false: '#e2e8f0', true: '#ef4444' }}
              thumbColor={'#fff'}
            />
          </View>

          <View className="flex-row justify-between items-center py-[10px] mt-[5px]">
            <View className="flex-1 mr-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[2px]">Novos Cadastros</Text>
              <Text className="font-sans text-[#64748b] text-[12px]">Permitir que novos pacientes/psis se registrem.</Text>
            </View>
            <Switch 
              value={allowRegistrations}
              onValueChange={setAllowRegistrations}
              trackColor={{ false: '#e2e8f0', true: '#10b981' }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        {/* Bloco: Tabela de Preços */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row items-center mb-[15px]">
            <Text className="text-[18px] mr-[8px]">💰</Text>
            <Text className="font-title text-[#333] text-[16px]">Tabela de Preços (Mensal)</Text>
          </View>
          
          <View className="mb-[15px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">Plano Essencial (R$)</Text>
            <TextInput 
              value={priceEssencial}
              onChangeText={setPriceEssencial}
              keyboardType="numeric"
              className="border border-[#e2e8f0] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
          <View className="mb-[15px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">Plano Clínico (R$)</Text>
            <TextInput 
              value={priceClinico}
              onChangeText={setPriceClinico}
              keyboardType="numeric"
              className="border border-[#e2e8f0] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
          <View className="mb-[5px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">Plano Referência (VIP) (R$)</Text>
            <TextInput 
              value={priceReferencia}
              onChangeText={setPriceReferencia}
              keyboardType="numeric"
              className="border border-[#e2e8f0] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
        </View>

        {/* Bloco: Contato Suporte */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row items-center mb-[15px]">
            <Text className="text-[18px] mr-[8px]">📞</Text>
            <Text className="font-title text-[#333] text-[16px]">Contato Visível (Usuários)</Text>
          </View>
          
          <View className="mb-[15px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">WhatsApp Oficial</Text>
            <TextInput 
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              className="border border-[#e2e8f0] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
          <View className="mb-[5px]">
            <Text className="font-title text-[#333] text-[12px] mb-[5px]">E-mail de Suporte</Text>
            <TextInput 
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              className="border border-[#e2e8f0] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleSave} className="bg-[#1B4332] py-[15px] rounded-[12px] items-center flex-row justify-center mt-[10px] shadow-[0_4px_15px_rgba(27,67,50,0.2)]">
          <Feather name="save" size={18} color="white" />
          <Text className="text-white font-title text-[16px] ml-[10px]">Salvar Alterações</Text>
        </TouchableOpacity>

        <View className="h-[120px]" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
