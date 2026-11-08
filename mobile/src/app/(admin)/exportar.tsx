import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ExportarScreen() {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (tipo: string) => {
    setDownloading(tipo);
    setTimeout(() => {
      setDownloading(null);
      Alert.alert(
        'Exportação Concluída',
        `A lista de ${tipo} foi gerada com sucesso no padrão Yelo.`,
        [
          { text: 'OK' }
        ]
      );
    }, 1500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
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
                Exportar Dados 📥
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Baixe relatórios, listas de contatos e cadastros em XLS e CSV.
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

        <View style={{ gap: 12 }}>
          {/* Card: Pacientes */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
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
                <Feather name="users" size={20} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
                  Base de Pacientes
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
                  Exportar base completa com status de terapia e contatos (XLS).
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleDownload('Pacientes')}
              disabled={downloading !== null}
              style={{
                backgroundColor: downloading === 'Pacientes' ? '#cbd5e1' : '#1B4332',
                borderRadius: 999,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              {downloading === 'Pacientes' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="download" size={15} color="#FFEE8C" />
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
                    Baixar Planilha (XLS)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Card: Psicólogos */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: '#ecfdf5',
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Feather name="user-check" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
                  Base de Psicólogos
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
                  Ativos, trials, inativos e lista de espera (XLS).
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleDownload('Psicólogos')}
              disabled={downloading !== null}
              style={{
                backgroundColor: downloading === 'Psicólogos' ? '#cbd5e1' : '#1B4332',
                borderRadius: 999,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              {downloading === 'Psicólogos' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="download" size={15} color="#FFEE8C" />
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
                    Baixar Planilha (XLS)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Card: Follow-up */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
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
                <Feather name="message-circle" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15, marginBottom: 2 }}>
                  Follow-up de Contato
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 16 }}>
                  Histórico de tentativas de contato e conversão comercial (CSV).
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleDownload('Follow-ups')}
              disabled={downloading !== null}
              style={{
                backgroundColor: downloading === 'Follow-ups' ? '#cbd5e1' : '#1B4332',
                borderRadius: 999,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              {downloading === 'Follow-ups' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="download" size={15} color="#FFEE8C" />
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
                    Baixar Arquivo (CSV)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
