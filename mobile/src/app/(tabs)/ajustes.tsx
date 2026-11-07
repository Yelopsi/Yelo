import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ProfileSwitcherModal from '../../components/ProfileSwitcherModal';
import {
  checkBiometricsCapability,
  isBiometricsActive,
  saveBiometricAccount,
  removeBiometricAccount,
  promptBiometricAuthentication,
  BiometricCapability,
} from '../../services/biometrics';

export default function AjustesScreen() {
  const { user, token, signOut, canAccessAdmin } = useAuth();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const [biometricCap, setBiometricCap] = useState<BiometricCapability>({
    hasHardware: false,
    isEnrolled: false,
    available: false,
    biometryType: 'generic',
    label: 'Face ID / Biometria',
  });
  const [biometricActive, setBiometricActive] = useState(false);
  const [loadingBiometrics, setLoadingBiometrics] = useState(true);

  useEffect(() => {
    async function loadBiometricsState() {
      try {
        const cap = await checkBiometricsCapability();
        setBiometricCap(cap);
        const active = await isBiometricsActive();
        setBiometricActive(active);
      } catch (err) {
        console.warn('Erro ao carregar dados de biometria:', err);
      } finally {
        setLoadingBiometrics(false);
      }
    }
    loadBiometricsState();
  }, []);

  const handleToggleBiometrics = async (nextVal: boolean) => {
    if (nextVal) {
      if (!biometricCap.hasHardware) {
        Alert.alert(
          'Biometria Indisponível',
          'Este aparelho não possui hardware biométrico compatível.'
        );
        return;
      }
      if (!biometricCap.isEnrolled) {
        Alert.alert(
          'Biometria Não Cadastrada',
          `Para usar o ${biometricCap.label}, configure o reconhecimento facial ou impressão digital nos Ajustes do seu celular primeiro.`
        );
        return;
      }

      // Solicita autenticação imediata para confirmar
      const auth = await promptBiometricAuthentication(
        `Confirme com ${biometricCap.label} para ativar o login rápido`
      );

      if (auth.success) {
        if (token && user) {
          await saveBiometricAccount(token, user);
          setBiometricActive(true);
          Alert.alert(
            'Biometria Ativada',
            `Pronto! Agora você poderá entrar no Yelo usando ${biometricCap.label} com 1 toque.`
          );
        } else {
          Alert.alert('Atenção', 'Faça login novamente para registrar as credenciais.');
        }
      } else if (auth.error && auth.error !== 'Autenticação cancelada.') {
        Alert.alert('Falha na Biometria', auth.error);
      }
    } else {
      Alert.alert(
        `Desativar ${biometricCap.label}`,
        `Tem certeza que deseja desativar o acesso por ${biometricCap.label}? Você precisará digitar seu e-mail e senha no próximo login.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desativar',
            style: 'destructive',
            onPress: async () => {
              await removeBiometricAccount();
              setBiometricActive(false);
              Alert.alert('Desativado', `O login por ${biometricCap.label} foi desativado.`);
            },
          },
        ]
      );
    }
  };

  const navigateTo = (targetTab: string) => {
    try {
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate(targetTab);
      } else {
        router.navigate(`/(tabs)/${targetTab}` as any);
      }
    } catch {
      router.navigate(`/(tabs)/${targetTab}` as any);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Encerrar Sessão",
      "Tem certeza que deseja sair da sua conta?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive", 
          onPress: async () => {
            await signOut();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const handleOpenPublicProfile = () => {
    if (user?.slug) {
      router.push(`/${user.slug}` as any);
    } else {
      navigateTo('meu_perfil');
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <View className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          
          {/* HEADER DA PÁGINA */}
          <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
            <View>
              <Text className="font-title text-[26px] text-white mb-2 leading-tight">
                Ajustes da Conta
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Gerencie as configurações do seu perfil, assinatura e canais de contato.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) EM ORDEM LÓGICA DE UX */}
          <View className="px-6 pb-32">
            
            {/* DESTAQUE: Painel do Administrador & Troca de Perfil */}
            {canAccessAdmin && (
              <TouchableOpacity 
                onPress={() => setSwitcherVisible(true)} 
                className="bg-[#f0fdf4] border-2 border-[#86efac] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(22,163,74,0.06)] mb-5"
                activeOpacity={0.8}
              >
                <View className="w-[55px] h-[55px] rounded-[16px] bg-[#1B4332] items-center justify-center mr-5">
                  <Feather name="shield" size={24} color="#FFEE8C" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="font-title text-[#1B4332] text-[19px]">Painel do Administrador</Text>
                    <View className="bg-[#1B4332] px-2 py-0.5 rounded-full">
                      <Text className="text-[#FFEE8C] text-[10px] font-bold">ACESSO 🛡️</Text>
                    </View>
                  </View>
                  <Text className="font-sans text-[14px] text-[#2d6a4f] leading-snug">
                    Alternar para a gestão global do sistema ou trocar de perfil.
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#1B4332" />
              </TouchableOpacity>
            )}

            {/* 1. PERFIL: Meu Perfil */}
            <TouchableOpacity 
              onPress={() => navigateTo('meu_perfil')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">⚙️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meu Perfil</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Dados pessoais, foto, biografia e abordagens.</Text>
              </View>
            </TouchableOpacity>

            {/* 2. VITRINE PÚBLICA: Meu Perfil Público */}
            <TouchableOpacity 
              onPress={handleOpenPublicProfile} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Feather name="external-link" size={24} color="#1B4332" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meu Perfil Público</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Veja como os pacientes visualizam sua página na internet.</Text>
              </View>
            </TouchableOpacity>

            {/* 3. CONTA & PLANO: Assinatura & Planos */}
            <TouchableOpacity 
              onPress={() => navigateTo('assinatura')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">⭐</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Assinatura & Planos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Gerenciar plano ativo, renovação e benefícios.</Text>
              </View>
            </TouchableOpacity>

            {/* 4. PREFERÊNCIAS: Notificações */}
            <TouchableOpacity 
              onPress={() => navigateTo('notificacoes')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Feather name="bell" size={24} color="#1B4332" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Notificações</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Lembretes de sessões e avisos de pacientes.</Text>
              </View>
            </TouchableOpacity>

            {/* 5. SEGURANÇA: Biometria (Face ID / Touch ID) */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-[22px] flex-row items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                  <Feather name="shield" size={24} color="#1B4332" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center flex-wrap">
                    <Text className="font-title text-[#1B4332] text-[19px] mb-1 mr-2">
                      {biometricCap.label}
                    </Text>
                    {biometricActive && (
                      <View className="bg-[#dcfce7] px-2 py-0.5 rounded-full mb-1">
                        <Text className="text-[#15803d] text-[11px] font-bold">ATIVADO</Text>
                      </View>
                    )}
                  </View>
                  <Text className="font-sans text-[13px] text-[#888] leading-snug">
                    {biometricActive
                      ? `Entrar rapidamente no app com ${biometricCap.label}.`
                      : `Habilite para entrar no Yelo com ${biometricCap.label} sem digitar senha.`}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricActive}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                disabled={loadingBiometrics}
              />
            </View>

            {/* 6. SUPORTE: Fale com a Yelo */}
            <TouchableOpacity 
              onPress={() => navigateTo('fale_com_a_yelo')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🎧</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Fale com a Yelo</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Suporte humanizado direto com nossa equipe.</Text>
              </View>
            </TouchableOpacity>

            {/* 7. NOVIDADES: Melhorias da Plataforma */}
            <TouchableOpacity 
              onPress={() => navigateTo('novidades')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🚀</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between flex-wrap gap-1 mb-1">
                  <Text className="font-title text-[#1B4332] text-[19px]">Melhorias da Plataforma</Text>
                  <View className="bg-[#dcfce7] px-2.5 py-0.5 rounded-full border border-[#bbf7d0]">
                    <Text className="text-[#15803d] text-[11px] font-bold">Novidades ✨</Text>
                  </View>
                </View>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Conheça os novos recursos e atualizações da Yelo.</Text>
              </View>
            </TouchableOpacity>

            {/* 8. ACESSO: Encerrar Sessão */}
            <TouchableOpacity 
              onPress={handleLogout}
              className="bg-white border border-[#ffe4e6] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5 mt-2"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#fff1f2] items-center justify-center mr-5">
                <Text className="text-[24px]">🚪</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#e63946] text-[19px] mb-1">Encerrar Sessão</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Sair da sua conta com segurança.</Text>
              </View>
            </TouchableOpacity>

          </View>
        </YeloScrollView>
      </View>
      <ProfileSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
      />
    </View>
  );
}
