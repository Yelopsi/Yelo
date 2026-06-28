import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ExportarScreen() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (tipo: string) => {
    setDownloading(tipo);
    setTimeout(() => {
      setDownloading(null);
      Alert.alert(
        "Download Concluído", 
        `A lista de ${tipo} foi gerada. O que deseja fazer?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Compartilhar", onPress: () => console.log('Abrir menu de share') }
        ]
      );
    }, 2000);
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[25px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Exportar Dados</Text>
          <Text className="font-sans text-[#666] text-[14px]">Baixe listas e relatórios completos em formato planilha.</Text>
        </View>

        <View className="gap-[15px]">
          {/* Card: Pacientes */}
          <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
            <View className="flex-row items-center mb-[10px]">
              <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-[15px]">
                <Feather name="users" size={20} color="#0284c7" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[16px] mb-[2px]">Lista de Pacientes</Text>
                <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Exportar base completa (XLS).</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => handleDownload('Pacientes')}
              disabled={downloading !== null}
              className={`mt-[10px] py-[12px] rounded-[10px] items-center flex-row justify-center ${downloading === 'Pacientes' ? 'bg-[#cbd5e1]' : 'bg-[#0284c7]'}`}
            >
              {downloading === 'Pacientes' ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Feather name="download" size={16} color="white" />
                  <Text className="text-white font-title text-[14px] ml-[8px]">Baixar Arquivo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Card: Psicólogos */}
          <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
            <View className="flex-row items-center mb-[10px]">
              <View className="w-[45px] h-[45px] bg-[#f0fdf4] rounded-[12px] items-center justify-center mr-[15px]">
                <Feather name="user-check" size={20} color="#16a34a" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[16px] mb-[2px]">Lista de Psicólogos</Text>
                <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Inativos, Ativos e Lista de Espera (XLS).</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => handleDownload('Psicólogos')}
              disabled={downloading !== null}
              className={`mt-[10px] py-[12px] rounded-[10px] items-center flex-row justify-center ${downloading === 'Psicólogos' ? 'bg-[#cbd5e1]' : 'bg-[#16a34a]'}`}
            >
              {downloading === 'Psicólogos' ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Feather name="download" size={16} color="white" />
                  <Text className="text-white font-title text-[14px] ml-[8px]">Baixar Arquivo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Card: Follow-up */}
          <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
            <View className="flex-row items-center mb-[10px]">
              <View className="w-[45px] h-[45px] bg-[#fef3c7] rounded-[12px] items-center justify-center mr-[15px]">
                <Feather name="message-circle" size={20} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[16px] mb-[2px]">Follow-up de Contato</Text>
                <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Tentativas de contato em CSV.</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => handleDownload('Follow-ups')}
              disabled={downloading !== null}
              className={`mt-[10px] py-[12px] rounded-[10px] items-center flex-row justify-center ${downloading === 'Follow-ups' ? 'bg-[#cbd5e1]' : 'bg-[#d97706]'}`}
            >
              {downloading === 'Follow-ups' ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Feather name="download" size={16} color="white" />
                  <Text className="text-white font-title text-[14px] ml-[8px]">Baixar Arquivo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
