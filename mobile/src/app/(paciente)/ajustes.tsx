import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  TextInput, 
  ActivityIndicator, 
  Linking 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import YeloScrollView from '../../components/YeloScrollView';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function AjustesHubScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nome, setNome] = useState(user?.nome || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Sair",
      "Tem certeza que deseja encerrar sua sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive", 
          onPress: async () => {
            await signOut();
            router.replace('/');
          }
        }
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!nome.trim()) {
      Alert.alert("Aviso", "O nome não pode ficar em branco.");
      return;
    }

    try {
      setIsSaving(true);
      await api.put('/api/patients/me', { nome: nome.trim() });
      Alert.alert("Sucesso", "Seus dados foram atualizados.");
      setEditModalVisible(false);
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Falha ao atualizar dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSupportWhatsApp = () => {
    const msg = encodeURIComponent("Olá! Sou usuário da Yelo e gostaria de tirar uma dúvida ou pedir suporte.");
    Linking.openURL(`https://wa.me/5511999999999?text=${msg}`).catch(() => {
      Alert.alert("Suporte", "Você também pode nos enviar um e-mail em suporte@yelopsi.com.br");
    });
  };

  return (
    <YeloScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
      
      <View className="mb-[25px]">
        <Text className="font-title text-[#1B4332] text-[28px] mb-[4px]">Ajustes</Text>
        <Text className="font-sans text-[#666] text-[15px]">Gerencie sua conta e suas preferências pessoais.</Text>
      </View>

      {/* Card Perfil do Usuário */}
      <View className="bg-white rounded-[20px] p-5 mb-5 border border-[#f0f0f0] shadow-sm flex-row items-center">
        <View className="w-14 h-14 rounded-full bg-[#1B4332] items-center justify-center mr-4">
          <Text className="font-title text-[#FFEE8C] text-[22px]">
            {user?.nome ? user.nome.charAt(0).toUpperCase() : 'P'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-title text-[#333] text-[18px] mb-0.5">{user?.nome || 'Paciente Yelo'}</Text>
          <Text className="font-sans text-[#777] text-[13px]">{user?.email || 'Conta protegida'}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setEditModalVisible(true)}
          className="w-10 h-10 rounded-full bg-[#f8f9fa] items-center justify-center border border-[#eee]"
        >
          <Feather name="edit-2" size={16} color="#1B4332" />
        </TouchableOpacity>
      </View>

      <View className="gap-[15px]">
        {/* Card Minha Conta */}
        <TouchableOpacity 
          onPress={() => setEditModalVisible(true)}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-sm"
        >
          <View className="w-[50px] h-[50px] bg-[#f3f4f6] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="user" size={22} color="#4b5563" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[17px] mb-[2px]">Meus Dados</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Nome de exibição e dados cadastrais</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Suporte */}
        <TouchableOpacity 
          onPress={handleSupportWhatsApp}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-sm"
        >
          <View className="w-[50px] h-[50px] bg-[#e8f5e9] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="help-circle" size={22} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[17px] mb-[2px]">Fale com a Yelo</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Dúvidas, suporte ou falar com nossa equipe</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Termos e Privacidade */}
        <TouchableOpacity 
          onPress={() => Linking.openURL('https://www.yelopsi.com.br/termos-de-uso')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-sm"
        >
          <View className="w-[50px] h-[50px] bg-[#e0f2fe] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="shield" size={22} color="#0284c7" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[17px] mb-[2px]">Termos & Privacidade</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Conheça nossa política de proteção e sigilo</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Sair */}
        <TouchableOpacity 
          onPress={handleLogout}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#fca5a5] shadow-sm mt-[10px]"
        >
          <View className="w-[50px] h-[50px] bg-[#fef2f2] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="log-out" size={22} color="#e63946" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#e63946] text-[17px] mb-[2px]">Encerrar Sessão</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Sair da conta neste dispositivo</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal de Edição de Dados */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white rounded-[24px] p-6 w-full max-w-[420px] shadow-xl">
            <Text className="font-title text-[#1B4332] text-[22px] mb-2">Editar Meus Dados</Text>
            <Text className="font-sans text-[#666] text-[14px] mb-5">
              Atualize as informações do seu perfil na Yelo.
            </Text>

            <Text className="font-sans font-bold text-[#444] text-[13px] mb-1.5">Nome Completo</Text>
            <TextInput 
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome"
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[14px] px-4 py-3 font-sans text-[15px] text-[#333] mb-5"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                className="flex-1 border border-[#ccc] rounded-full py-3 items-center justify-center"
              >
                <Text className="font-sans font-bold text-[#666] text-[14px]">Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 bg-[#1B4332] rounded-full py-3 items-center justify-center"
              >
                {isSaving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[14px]">Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </YeloScrollView>
  );
}
