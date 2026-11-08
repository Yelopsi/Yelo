import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ConfiguracoesScreen() {
  const router = useRouter();
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
        "Ativar o modo manutenção suspenderá o acesso de psicólogos e pacientes imediatamente (exceto administradores). Confirmar?",
        [
          { text: "Cancelar", style: "cancel", onPress: () => setMaintenanceMode(false) },
          { text: "Sim, Ativar Manutenção", style: "destructive", onPress: () => setMaintenanceMode(true) }
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
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
                Configurações Globais ⚙️
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Preços de planos, modo manutenção e canais oficiais da Yelo.
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

        {/* Bloco: Estado da Plataforma */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🚦</Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Estado da Plataforma</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <View style={{ flex: 1, marginRight: 14 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1e293b', fontSize: 14 }}>Modo Manutenção</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 2 }}>
                Bloqueia o acesso público e webapp (exceto administradores).
              </Text>
            </View>
            <Switch
              value={maintenanceMode}
              onValueChange={toggleMaintenance}
              trackColor={{ false: '#e2e8f0', true: '#ef4444' }}
              thumbColor={'#ffffff'}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ flex: 1, marginRight: 14 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1e293b', fontSize: 14 }}>Novos Cadastros</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 2 }}>
                Permitir que novos psicólogos e pacientes se registrem.
              </Text>
            </View>
            <Switch
              value={allowRegistrations}
              onValueChange={setAllowRegistrations}
              trackColor={{ false: '#e2e8f0', true: '#10b981' }}
              thumbColor={'#ffffff'}
            />
          </View>
        </View>

        {/* Bloco: Tabela de Preços */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
            <Text style={{ fontSize: 18 }}>💰</Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Tabela de Planos (Mensal)</Text>
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
              Plano Essencial (R$)
            </Text>
            <TextInput
              value={priceEssencial}
              onChangeText={setPriceEssencial}
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
              Plano Clínico (R$)
            </Text>
            <TextInput
              value={priceClinico}
              onChangeText={setPriceClinico}
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>

          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
              Plano Referência VIP (R$)
            </Text>
            <TextInput
              value={priceReferencia}
              onChangeText={setPriceReferencia}
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>
        </View>

        {/* Bloco: Contato Suporte */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
            <Text style={{ fontSize: 18 }}>📞</Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Canais Oficiais de Suporte</Text>
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
              WhatsApp Oficial de Atendimento
            </Text>
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>

          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
              E-mail de Suporte ao Usuário
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
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
            Salvar Configurações
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
