import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ProfileSwitcherModal from '../../components/ProfileSwitcherModal';

export default function AdminAjustesHubScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Sair do Painel Admin",
      "Tem certeza que deseja encerrar a sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cabeçalho do Hub Yelo */}
      <View
        style={{
          backgroundColor: '#1B4332',
          borderRadius: 20,
          padding: 22,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: '#2D6A4F',
          shadowColor: '#1B4332',
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 999,
          }}
        />
        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 24, marginBottom: 4 }}>
          Ajustes e Sistema ⚙️
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
          Controle operacional, perfil de administrador e logs de auditoria.
        </Text>
      </View>

      {/* GRID DE CARDS EM ORDEM LÓGICA DE GESTÃO E OPERAÇÃO */}
      <View style={{ gap: 12 }}>
        {/* Destaque: Alternador Rápido de Perfil */}
        <TouchableOpacity
          onPress={() => setSwitcherVisible(true)}
          style={{
            backgroundColor: '#f0fdf4',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#86efac',
            shadowColor: '#16a34a',
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#1B4332',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="refresh-cw" size={20} color="#FFEE8C" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#14532d', fontSize: 15 }}>
                Alternar Perfil
              </Text>
              <View style={{ backgroundColor: '#15803d', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 9.5 }}>RÁPIDO ⚡</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#166534', fontSize: 12, lineHeight: 16 }}>
              Mude instantaneamente para o Painel do Psicólogo ou conecte outra conta.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#15803d" />
        </TouchableOpacity>

        {/* 1. Identidade & Acesso: Meu Perfil Admin */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/perfil-admin')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#e8f5e9',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="user" size={20} color="#1B4332" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Meu Perfil Admin
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Altere seu nome, foto e credenciais de acesso.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* 2. Regras de Negócio: Configurações Globais */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/configuracoes')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#f1f5f9',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="settings" size={20} color="#475569" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Configurações Globais
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Preços, planos, termos e canais oficiais da Yelo.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* 3. Evolução de Produto: Central de Ajustes (Notion Flow) */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/backlog-ajustes')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#c8e6c9',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#e8f5e9',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="check-square" size={20} color="#1B4332" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 15 }}>
                Central de Ajustes
              </Text>
              <View style={{ backgroundColor: '#1B4332', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#FFEE8C', fontSize: 9 }}>Notion Flow</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Fila de ajustes prioritários por tela, bugs e melhorias.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* 4. Auditoria de Versões: Histórico de Alterações */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/historico-alteracoes')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#fde68a',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#fef9c3',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="clock" size={20} color="#b45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#92400e', fontSize: 15, marginBottom: 2 }}>
              Histórico de Alterações
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Registro de deploys e evolução da plataforma.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* 5. Saúde & Infra: Monitoramento e Logs */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/logs-sistema')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#fef2f2',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="activity" size={20} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Monitoramento e Logs
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Auditoria do sistema, exceções e histórico operacional.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* 6. Encerramento de Sessão: Card Sair */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#fca5a5',
            marginTop: 8,
          }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: '#fef2f2',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="log-out" size={20} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ef4444', fontSize: 15, marginBottom: 2 }}>
              Sair da Conta
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Encerrar sua sessão de administrador com segurança.
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      <ProfileSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
        currentRole="admin"
      />
    </ScrollView>
  );
}
