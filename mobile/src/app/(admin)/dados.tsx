import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminDadosHubScreen() {
  const router = useRouter();
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
          Dados e Métricas 📊
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
          Análise de crescimento, funil de conversão e exportação de dados.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {/* Relatórios e Crescimento */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/crm-modulo/analytics-crescimento')}
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
              backgroundColor: '#eff6ff',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="trending-up" size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Relatórios e Crescimento
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Evolução histórica, novos assinantes e metas.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Analytics do Funil */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/crm-modulo/analytics-funil')}
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
            <Feather name="filter" size={20} color="#1B4332" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Analytics do Funil & PLG
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Conversão etapa a etapa, questionários e cliques WhatsApp.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Métricas de Match */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/metricas-match')}
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
              backgroundColor: '#fffbeb',
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Feather name="pie-chart" size={20} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Métricas de Match
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Demandas mais frequentes nos questionários de pacientes.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Downloads */}
        <TouchableOpacity
          onPress={() => router.push('/(admin)/exportar')}
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
            <Feather name="download" size={20} color="#475569" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
              Downloads & Exportação
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
              Exportação segura de listas de psicólogos e pacientes em CSV/XLS.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
