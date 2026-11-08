import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function MetricasMatchScreen() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#1B4332']} tintColor="#1B4332" />
        }
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
                Métricas de Match 🎯
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Demandas dos questionários e perfil comparativo paciente vs psicólogo.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dados'))}
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

        {/* Resumo 30 Dias */}
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
            <Text style={{ fontSize: 18 }}>📅</Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Resumo dos Últimos 30 Dias</Text>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13 }}>Total de Matches Realizados</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#10b981', fontSize: 17 }}>1.245</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13 }}>Formulários Preenchidos</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#2563eb', fontSize: 17 }}>340</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13 }}>Taxa Média de Sucesso</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#f59e0b', fontSize: 17 }}>85%</Text>
            </View>
          </View>
        </View>

        {/* Perfil do Paciente */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🧘</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Perfil do Paciente</Text>
            </View>
            <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 10 }}>1.2K RESPONDIDOS</Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, backgroundColor: '#f8fafc' }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13, marginBottom: 8 }}>Faixa Etária</Text>
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#2563eb', fontSize: 16 }}>25 - 34 anos</Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#3b82f6', fontSize: 10 }}>60% da base</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11 }}>18 - 24 anos</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 11 }}>25%</Text>
                </View>
              </View>

              <View style={{ flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, backgroundColor: '#f8fafc' }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13, marginBottom: 8 }}>Gênero</Text>
                <View style={{ backgroundColor: '#ecfdf5', borderRadius: 10, padding: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#10b981', fontSize: 16 }}>Mulher (Cis)</Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#059669', fontSize: 10 }}>72% da base</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11 }}>Homem (Cis)</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 11 }}>22%</Text>
                </View>
              </View>
            </View>

            <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, backgroundColor: '#f8fafc' }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13, marginBottom: 8 }}>Top Queixas Buscadas</Text>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 12 }}>1. Ansiedade</Text><Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>45%</Text></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 12 }}>2. Depressão</Text><Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>30%</Text></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 12 }}>3. Relacionamentos</Text><Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>15%</Text></View>
              </View>
            </View>
          </View>
        </View>

        {/* Perfil do Psicólogo */}
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
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🧑‍⚕️</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Perfil do Psicólogo</Text>
            </View>
            <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 10 }}>450 CADASTRADOS</Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, backgroundColor: '#f8fafc' }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13, marginBottom: 8 }}>Abordagens Mais Comuns</Text>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 12 }}>1. TCC (Cognitiva-Comportamental)</Text><Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>52%</Text></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 12 }}>2. Psicanálise</Text><Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>28%</Text></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 12 }}>3. Humanista / Fenomenologia</Text><Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>12%</Text></View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
