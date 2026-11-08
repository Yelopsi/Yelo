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
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { resolvePhotoUrl } from '../utils/imageUrl';

interface ProfileSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  currentRole?: 'admin' | 'psychologist';
}

export default function ProfileSwitcherModal({
  visible,
  onClose,
  currentRole,
}: ProfileSwitcherModalProps) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
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

  // Identificação 100% precisa do perfil atualmente em exibição
  const inAdminRoute = segments.some((s) => s === '(admin)');
  const inTabsRoute = segments.some((s) => s === '(tabs)');

  const isCurrentlyAdmin =
    currentRole === 'admin'
      ? true
      : currentRole === 'psychologist'
      ? false
      : inAdminRoute
      ? true
      : inTabsRoute
      ? false
      : user?.type === 'admin';

  const isCurrentlyPsi = !isCurrentlyAdmin;

  const handleSelectRole = async (targetRole: 'admin' | 'psychologist') => {
    // Se já estiver na visão selecionada, apenas fecha o modal
    if (
      (targetRole === 'admin' && isCurrentlyAdmin) ||
      (targetRole === 'psychologist' && isCurrentlyPsi)
    ) {
      onClose();
      return;
    }

    try {
      onClose();
      const destRoute = await switchRole(targetRole);
      router.replace(destRoute as any);
    } catch (err: any) {
      Alert.alert('Erro ao alternar modo', err?.message || 'Tente novamente.');
    }
  };

  const handleSelectAccount = async (targetEmail: string) => {
    const currentEmail = (user?.email || '').trim().toLowerCase();
    if (currentEmail && currentEmail === targetEmail.trim().toLowerCase()) {
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

  // Filtra outras contas salvas: nunca duplica a conta ativa atual
  const currentEmail = (user?.email || '').trim().toLowerCase();
  const currentId = user?.id;

  const otherAccounts = savedAccounts.filter((a) => {
    const accEmail = (a.user.email || '').trim().toLowerCase();
    if (!accEmail) return false;
    if (currentEmail && accEmail === currentEmail) return false;
    return true;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{
                backgroundColor: '#ffffff',
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingHorizontal: 22,
                paddingTop: 14,
                paddingBottom: Math.max(insets.bottom, 24) + 16,
                maxHeight: '88%',
                borderTopWidth: 1,
                borderColor: '#e2e8f0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.12,
                shadowRadius: 18,
                elevation: 20,
              }}
            >
              {/* Barra de arraste no topo */}
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 44, height: 5, backgroundColor: '#cbd5e1', borderRadius: 999 }} />
              </View>

              {/* Cabeçalho */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22 }}>
                    Alternar Perfil
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, marginTop: 2 }}>
                    Troque de visão ou conta sem precisar sair
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* 1. CONTA ATUALMENTE LOGADA */}
                {user && (
                  <View style={{ marginBottom: 20 }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        color: '#64748b',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.8,
                        marginBottom: 10,
                      }}
                    >
                      Conta Ativa no Momento
                    </Text>

                    <View
                      style={{
                        padding: 16,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: '#1B4332',
                        backgroundColor: '#f0fdf4',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        shadowColor: '#1B4332',
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                        <View style={{ position: 'relative', width: 44, height: 44, marginRight: 14 }}>
                          {user.fotoUrl ? (
                            <Image
                              source={{ uri: resolvePhotoUrl(user.fotoUrl) }}
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 14,
                                borderWidth: 2,
                                borderColor: '#1B4332',
                              }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 14,
                                backgroundColor: '#1B4332',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isCurrentlyAdmin ? (
                                <Feather name="shield" size={20} color="#FFEE8C" />
                              ) : (
                                <Feather name="user" size={20} color="#FFEE8C" />
                              )}
                            </View>
                          )}
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -3,
                              right: -3,
                              backgroundColor: '#1B4332',
                              borderRadius: 999,
                              width: 18,
                              height: 18,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1.5,
                              borderColor: '#ffffff',
                            }}
                          >
                            {isCurrentlyAdmin ? (
                              <Feather name="shield" size={10} color="#FFEE8C" />
                            ) : (
                              <Text style={{ fontSize: 9 }}>🧠</Text>
                            )}
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>
                            {isCurrentlyAdmin ? 'Painel do Administrador' : (user.nome || 'Painel do Psicólogo')}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Inter_400Regular',
                              color: '#64748b',
                              fontSize: 12,
                              lineHeight: 16,
                              marginTop: 2,
                            }}
                          >
                            {user.email} • {isCurrentlyAdmin ? '🛡️ Admin' : '🧠 Psicólogo'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#1B4332',
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                          gap: 4,
                        }}
                      >
                        <Feather name="check" size={12} color="#FFEE8C" />
                        <Text
                          style={{
                            fontFamily: 'Inter_700Bold',
                            color: '#FFEE8C',
                            fontSize: 10.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          Em uso
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* 2. CONTAS CONECTADAS SEPARADAS (se houver outros e-mails salvos) */}
                {otherAccounts.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        color: '#64748b',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.8,
                        marginBottom: 10,
                      }}
                    >
                      Outras Contas Salvas
                    </Text>

                    {otherAccounts.map((account) => {
                      const accUser = account.user;
                      return (
                        <View
                          key={accUser.email}
                          style={{
                            backgroundColor: '#ffffff',
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            padding: 14,
                            borderRadius: 18,
                            marginBottom: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => handleSelectAccount(accUser.email)}
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}
                            activeOpacity={0.7}
                          >
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: '#f1f5f9',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                              }}
                            >
                              {accUser.fotoUrl ? (
                                <Image
                                  source={{ uri: resolvePhotoUrl(accUser.fotoUrl) }}
                                  style={{ width: 36, height: 36, borderRadius: 18 }}
                                />
                              ) : (
                                <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 14 }}>
                                  {accUser.nome ? accUser.nome.charAt(0).toUpperCase() : 'U'}
                                </Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 14 }}>
                                {accUser.nome || accUser.email}
                              </Text>
                              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11 }}>
                                {accUser.email} • {accUser.type === 'admin' ? '🛡️ Admin' : '🧠 Psicólogo'}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => handleSelectAccount(accUser.email)}
                              style={{
                                backgroundColor: '#1B4332',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 999,
                              }}
                            >
                              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 11 }}>
                                Entrar
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveAccount(accUser.email)}
                              style={{ padding: 6 }}
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
                <View style={{ paddingTop: 8, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
                  {!isAddingAccount ? (
                    <TouchableOpacity
                      onPress={() => setIsAddingAccount(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: '#f8fafc',
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: '#cbd5e1',
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="user-plus" size={16} color="#1B4332" style={{ marginRight: 8 }} />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13 }}>
                        Conectar outro perfil com e-mail e senha
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: 16,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 14 }}>
                          Adicionar Novo Perfil
                        </Text>
                        <TouchableOpacity onPress={() => setIsAddingAccount(false)}>
                          <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                            Cancelar
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {errorMsg ? (
                        <View
                          style={{
                            backgroundColor: '#fef2f2',
                            borderWidth: 1,
                            borderColor: '#fecaca',
                            padding: 10,
                            borderRadius: 12,
                            marginBottom: 12,
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_500Medium', color: '#b91c1c', fontSize: 11, textAlign: 'center' }}>
                            {errorMsg}
                          </Text>
                        </View>
                      ) : null}

                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 11, marginBottom: 4 }}>
                          E-MAIL
                        </Text>
                        <TextInput
                          value={newEmail}
                          onChangeText={setNewEmail}
                          placeholder="seuemail@exemplo.com"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={{
                            backgroundColor: '#ffffff',
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 13,
                            fontFamily: 'Inter_400Regular',
                            color: '#1e293b',
                          }}
                        />
                      </View>

                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 11, marginBottom: 4 }}>
                          SENHA
                        </Text>
                        <View style={{ position: 'relative', justifyContent: 'center' }}>
                          <TextInput
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Sua senha"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry={!showPassword}
                            style={{
                              backgroundColor: '#ffffff',
                              borderWidth: 1,
                              borderColor: '#cbd5e1',
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              paddingRight: 40,
                              fontSize: 13,
                              fontFamily: 'Inter_400Regular',
                              color: '#1e293b',
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={{ position: 'absolute', right: 12, padding: 4 }}
                          >
                            <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={handleConnectSubmit}
                        disabled={connecting}
                        style={{
                          backgroundColor: '#1B4332',
                          paddingVertical: 12,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                        }}
                      >
                        {connecting ? (
                          <ActivityIndicator size="small" color="#FFEE8C" />
                        ) : (
                          <Text style={{ fontFamily: 'Inter_700Bold', color: '#FFEE8C', fontSize: 13 }}>
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
