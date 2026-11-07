import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { resolvePhotoUrl } from '../utils/imageUrl';

interface ProfileSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    savedAccounts,
    canAccessAdmin,
    canAccessPsychologist,
    switchRole,
    switchAccount,
    connectAccount,
    removeSavedAccount,
  } = useAuth();

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Identifica a visão atual baseando-se na rota ou no user.type
  const isCurrentlyAdmin = pathname ? pathname.startsWith('/(admin)') : user?.type === 'admin';
  const isCurrentlyPsi = !isCurrentlyAdmin;

  const handleSelectRole = async (targetRole: 'admin' | 'psychologist') => {
    try {
      onClose();
      const destRoute = await switchRole(targetRole);
      router.replace(destRoute as any);
    } catch (err: any) {
      Alert.alert('Erro ao alternar modo', err?.message || 'Tente novamente.');
    }
  };

  const handleSelectAccount = async (targetEmail: string) => {
    if (user?.email.toLowerCase() === targetEmail.toLowerCase()) {
      onClose();
      return;
    }

    try {
      onClose();
      const destRoute = await switchAccount(targetEmail);
      router.replace(destRoute as any);
    } catch (err: any) {
      Alert.alert('Erro ao alternar conta', err?.message || 'Tente novamente.');
    }
  };

  const handleConnectSubmit = async () => {
    if (!newEmail.trim() || !newPassword) {
      setErrorMsg('Preencha o e-mail e a senha da conta.');
      return;
    }

    setErrorMsg('');
    setConnecting(true);

    try {
      const res = await connectAccount(newEmail, newPassword);
      if (res.success) {
        setIsAddingAccount(false);
        setNewEmail('');
        setNewPassword('');
        onClose();
        if (res.route) {
          router.replace(res.route as any);
        }
      } else {
        setErrorMsg(res.error || 'Credenciais inválidas.');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Falha ao conectar conta.');
    } finally {
      setConnecting(false);
    }
  };

  const handleRemoveAccount = (targetEmail: string) => {
    Alert.alert(
      'Remover Conta Conectada',
      `Deseja remover ${targetEmail} das contas salvas neste aparelho?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await removeSavedAccount(targetEmail);
          },
        },
      ]
    );
  };

  const otherAccounts = savedAccounts.filter(
    (a) => a.user.email.toLowerCase() !== user?.email?.toLowerCase()
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              className="bg-white rounded-t-[32px] p-6 max-h-[85%] border-t border-[#e2e8f0] shadow-2xl"
            >
              {/* Barra de arraste no topo */}
              <View className="items-center mb-4">
                <View className="w-12 h-1.5 bg-[#cbd5e1] rounded-full" />
              </View>

              {/* Cabeçalho */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1">
                  <Text className="font-title text-[#1B4332] text-[22px] font-bold">
                    Alternar Perfil
                  </Text>
                  <Text className="font-sans text-[#64748b] text-[13px] mt-0.5">
                    Troque de visão ou conta sem precisar sair
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-9 h-9 rounded-full bg-[#f1f5f9] items-center justify-center"
                >
                  <Feather name="x" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
                {/* 1. SEÇÃO DE MODOS (Admin vs Psicólogo) PARA USUÁRIOS COM AMBOS OS PAPÉIS */}
                {(canAccessAdmin || canAccessPsychologist) && (
                  <View className="mb-5">
                    <Text className="font-sans font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-2.5">
                      Modos de Acesso Disponíveis
                    </Text>

                    {/* Card: Modo Administrador */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleSelectRole('admin')}
                      className={`p-4 rounded-[20px] mb-2.5 border flex-row items-center justify-between ${
                        isCurrentlyAdmin
                          ? 'bg-[#e8f5e9] border-[#1B4332]'
                          : 'bg-white border-[#e2e8f0]'
                      }`}
                    >
                      <View className="flex-row items-center flex-1 mr-3">
                        <View className="w-11 h-11 rounded-[14px] bg-[#1B4332] items-center justify-center mr-3.5 shadow-sm">
                          <Feather name="shield" size={20} color="#FFEE8C" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="font-title font-bold text-[#1B4332] text-[16px]">
                              Painel do Administrador
                            </Text>
                          </View>
                          <Text className="font-sans text-[#64748b] text-[12px] leading-4 mt-0.5">
                            CRM, finanças, moderação e métricas globais da Yelo.
                          </Text>
                        </View>
                      </View>

                      {isCurrentlyAdmin ? (
                        <View className="bg-[#1B4332] px-2.5 py-1 rounded-full">
                          <Text className="font-sans font-bold text-[#FFEE8C] text-[10px] uppercase">
                            Em uso
                          </Text>
                        </View>
                      ) : (
                        <View className="bg-[#f1f5f9] px-2.5 py-1 rounded-full flex-row items-center gap-1">
                          <Text className="font-sans font-semibold text-[#1B4332] text-[11px]">
                            Acessar →
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Card: Modo Psicólogo */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleSelectRole('psychologist')}
                      className={`p-4 rounded-[20px] border flex-row items-center justify-between ${
                        isCurrentlyPsi
                          ? 'bg-[#e8f5e9] border-[#1B4332]'
                          : 'bg-white border-[#e2e8f0]'
                      }`}
                    >
                      <View className="flex-row items-center flex-1 mr-3">
                        <View className="w-11 h-11 rounded-[14px] bg-[#e8f5e9] border border-[#c8e6c9] items-center justify-center mr-3.5">
                          {user?.fotoUrl ? (
                            <Image
                              source={{ uri: resolvePhotoUrl(user.fotoUrl) }}
                              style={{ width: 40, height: 40, borderRadius: 12 }}
                            />
                          ) : (
                            <Feather name="user" size={20} color="#1B4332" />
                          )}
                        </View>
                        <View className="flex-1">
                          <Text className="font-title font-bold text-[#1B4332] text-[16px]">
                            Painel do Psicólogo
                          </Text>
                          <Text className="font-sans text-[#64748b] text-[12px] leading-4 mt-0.5">
                            Sua clínica, pacientes, agenda, evolução e artigos.
                          </Text>
                        </View>
                      </View>

                      {isCurrentlyPsi ? (
                        <View className="bg-[#1B4332] px-2.5 py-1 rounded-full">
                          <Text className="font-sans font-bold text-[#FFEE8C] text-[10px] uppercase">
                            Em uso
                          </Text>
                        </View>
                      ) : (
                        <View className="bg-[#f1f5f9] px-2.5 py-1 rounded-full flex-row items-center gap-1">
                          <Text className="font-sans font-semibold text-[#1B4332] text-[11px]">
                            Acessar →
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. CONTAS CONECTADAS SEPARADAS (se houver outros e-mails salvos) */}
                {otherAccounts.length > 0 && (
                  <View className="mb-5">
                    <Text className="font-sans font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-2.5">
                      Outras Contas Salvas
                    </Text>

                    {otherAccounts.map((account) => {
                      const accUser = account.user;
                      return (
                        <View
                          key={accUser.email}
                          className="bg-white border border-[#e2e8f0] p-3.5 rounded-[18px] mb-2 flex-row items-center justify-between"
                        >
                          <TouchableOpacity
                            onPress={() => handleSelectAccount(accUser.email)}
                            className="flex-row items-center flex-1 mr-2"
                            activeOpacity={0.7}
                          >
                            <View className="w-10 h-10 rounded-full bg-[#f1f5f9] items-center justify-center mr-3 border border-[#e2e8f0]">
                              {accUser.fotoUrl ? (
                                <Image
                                  source={{ uri: resolvePhotoUrl(accUser.fotoUrl) }}
                                  style={{ width: 36, height: 36, borderRadius: 18 }}
                                />
                              ) : (
                                <Text className="font-sans font-bold text-[#1B4332] text-[14px]">
                                  {accUser.nome ? accUser.nome.charAt(0).toUpperCase() : 'U'}
                                </Text>
                              )}
                            </View>
                            <View className="flex-1">
                              <Text className="font-sans font-bold text-[#1e293b] text-[14px]">
                                {accUser.nome || accUser.email}
                              </Text>
                              <Text className="font-sans text-[#64748b] text-[11px]">
                                {accUser.email} • {accUser.type === 'admin' ? '🛡️ Admin' : '🧠 Psicólogo'}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              onPress={() => handleSelectAccount(accUser.email)}
                              className="bg-[#1B4332] px-3 py-1.5 rounded-full"
                            >
                              <Text className="font-sans font-bold text-white text-[11px]">
                                Entrar
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveAccount(accUser.email)}
                              className="p-1.5"
                            >
                              <Feather name="trash-2" size={15} color="#94a3b8" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 3. CONECTAR OUTRA CONTA (LOGIN SECUNDÁRIO) */}
                <View className="pt-2 border-t border-[#f1f5f9]">
                  {!isAddingAccount ? (
                    <TouchableOpacity
                      onPress={() => setIsAddingAccount(true)}
                      className="flex-row items-center justify-center p-3.5 rounded-[16px] bg-[#f8fafc] border border-dashed border-[#cbd5e1]"
                    >
                      <Feather name="user-plus" size={16} color="#1B4332" style={{ marginRight: 8 }} />
                      <Text className="font-sans font-bold text-[#1B4332] text-[13px]">
                        Conectar outro perfil com e-mail e senha
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="bg-[#f8fafc] p-4 rounded-[20px] border border-[#e2e8f0]">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="font-sans font-bold text-[#1B4332] text-[14px]">
                          Adicionar Novo Perfil
                        </Text>
                        <TouchableOpacity onPress={() => setIsAddingAccount(false)}>
                          <Text className="font-sans text-[#64748b] text-[12px]">Cancelar</Text>
                        </TouchableOpacity>
                      </View>

                      {errorMsg ? (
                        <View className="bg-[#fef2f2] border border-[#fecaca] p-2.5 rounded-[12px] mb-3">
                          <Text className="font-sans text-[#b91c1c] text-[11px] text-center">
                            {errorMsg}
                          </Text>
                        </View>
                      ) : null}

                      <View className="mb-2.5">
                        <Text className="font-sans text-[#475569] text-[11px] font-semibold mb-1">
                          E-MAIL
                        </Text>
                        <TextInput
                          value={newEmail}
                          onChangeText={setNewEmail}
                          placeholder="seuemail@exemplo.com"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="none"
                          keyboardType="email-address"
                          className="bg-white border border-[#cbd5e1] rounded-[12px] px-3 py-2 text-[13px] font-sans text-[#1e293b]"
                        />
                      </View>

                      <View className="mb-4">
                        <Text className="font-sans text-[#475569] text-[11px] font-semibold mb-1">
                          SENHA
                        </Text>
                        <View className="relative justify-center">
                          <TextInput
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Sua senha"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry={!showPassword}
                            className="bg-white border border-[#cbd5e1] rounded-[12px] px-3 py-2 pr-10 text-[13px] font-sans text-[#1e293b]"
                          />
                          <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            className="absolute right-3 p-1"
                          >
                            <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={handleConnectSubmit}
                        disabled={connecting}
                        className="bg-[#1B4332] py-3 rounded-full items-center justify-center flex-row shadow-sm"
                      >
                        {connecting ? (
                          <ActivityIndicator size="small" color="#FFEE8C" />
                        ) : (
                          <Text className="font-sans font-bold text-[#FFEE8C] text-[13px]">
                            Conectar e Alternar
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
