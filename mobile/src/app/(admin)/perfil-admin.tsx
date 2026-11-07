import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePhotoUrl } from '../../utils/imageUrl';

export default function PerfilAdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [nome, setNome] = useState(user?.nome || 'Admin Yelo');
  const [email, setEmail] = useState(user?.email || 'admin@yelopsi.com.br');
  const [telefone, setTelefone] = useState((user as any)?.telefone || '(11) 98888-7777');

  const handleSave = () => {
    Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#2D6A4F',
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22 }}>
                Meu Perfil Admin 👤
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Gerencie seus dados e credenciais de administrador.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/ajustes'))}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
            marginBottom: 20,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 10 }}>
            <View style={{ position: 'relative' }}>
              {user?.fotoUrl ? (
                <Image
                  source={{ uri: resolvePhotoUrl(user.fotoUrl) }}
                  style={{ width: 96, height: 96, borderRadius: 999, borderWidth: 3, borderColor: '#1B4332' }}
                />
              ) : (
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 999,
                    backgroundColor: '#1B4332',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: '#c8e6c9',
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 28 }}>
                    {nome.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => Alert.alert('Foto', 'Funcionalidade de upload de foto.')}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: '#1B4332',
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#ffffff',
                }}
              >
                <Feather name="camera" size={14} color="#FFEE8C" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>
              Nome Completo
            </Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>
              E-mail de Acesso
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>
              Telefone
            </Text>
            <TextInput
              value={telefone}
              onChangeText={setTelefone}
              keyboardType="phone-pad"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          style={{
            backgroundColor: '#1B4332',
            paddingVertical: 14,
            borderRadius: 999,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 2,
          }}
          activeOpacity={0.8}
        >
          <Feather name="check" size={16} color="#FFEE8C" />
          <Text style={{ color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 14 }}>
            Atualizar Cadastro
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
