import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function MetricasMatchScreen() {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[20px] flex-row justify-between items-start">
          <View className="flex-1 mr-[10px]">
            <Text className="font-title text-[#1e1b4b] text-[24px]">Métricas de Match</Text>
            <Text className="font-sans text-[#666] text-[14px]">Perfil de buscas dos pacientes e psicólogos.</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} className="bg-[#f3f4f6] p-[10px] rounded-[10px] border border-[#e2e8f0]">
            {isRefreshing ? <ActivityIndicator size="small" color="#4b5563" /> : <Feather name="refresh-cw" size={18} color="#4b5563" />}
          </TouchableOpacity>
        </View>

        {/* Resumo 30 Dias */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row items-center mb-[15px]">
            <Text className="text-[18px] mr-[8px]">📅</Text>
            <Text className="font-title text-[#333] text-[16px]">Resumo dos Últimos 30 Dias</Text>
          </View>
          
          <View className="gap-[15px]">
            <View className="flex-row justify-between items-center bg-[#f8f9fa] p-[12px] rounded-[10px]">
              <Text className="font-sans text-[#64748b] text-[13px]">Total de Matches Realizados</Text>
              <Text className="font-title text-[#10b981] text-[16px]">1,245</Text>
            </View>
            <View className="flex-row justify-between items-center bg-[#f8f9fa] p-[12px] rounded-[10px]">
              <Text className="font-sans text-[#64748b] text-[13px]">Novos Formulários Preenchidos</Text>
              <Text className="font-title text-[#3b82f6] text-[16px]">340</Text>
            </View>
            <View className="flex-row justify-between items-center bg-[#f8f9fa] p-[12px] rounded-[10px]">
              <Text className="font-sans text-[#64748b] text-[13px]">Taxa Média de Sucesso</Text>
              <Text className="font-title text-[#f59e0b] text-[16px]">85%</Text>
            </View>
          </View>
        </View>

        {/* Perfil do Paciente */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row justify-between items-center mb-[15px]">
            <View className="flex-row items-center">
              <Text className="text-[18px] mr-[8px]">🧘</Text>
              <Text className="font-title text-[#333] text-[16px]">Perfil do Paciente</Text>
            </View>
            <Text className="font-sans text-[#94a3b8] text-[11px] font-bold bg-[#f1f5f9] px-[6px] py-[2px] rounded">1.2K RESPONDIDOS</Text>
          </View>

          <View className="gap-[15px]">
            <View className="flex-row gap-[10px]">
              <View className="flex-1 border border-[#e2e8f0] rounded-[10px] p-[15px]">
                <Text className="font-title text-[#333] text-[14px] mb-[10px]">Faixa Etária</Text>
                <View className="bg-[#eff6ff] rounded-[8px] p-[10px] items-center mb-[10px]">
                  <Text className="font-title text-[#1d4ed8] text-[18px]">25 - 34 anos</Text>
                  <Text className="font-sans text-[#3b82f6] text-[10px]">60% da base</Text>
                </View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[11px]">18 - 24 anos</Text><Text className="font-bold text-[#333] text-[11px]">25%</Text></View>
              </View>
              <View className="flex-1 border border-[#e2e8f0] rounded-[10px] p-[15px]">
                <Text className="font-title text-[#333] text-[14px] mb-[10px]">Gênero</Text>
                <View className="bg-[#fdf4ff] rounded-[8px] p-[10px] items-center mb-[10px]">
                  <Text className="font-title text-[#a21caf] text-[18px]">Mulher (Cis)</Text>
                  <Text className="font-sans text-[#c026d3] text-[10px]">72% da base</Text>
                </View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[11px]">Homem (Cis)</Text><Text className="font-bold text-[#333] text-[11px]">22%</Text></View>
              </View>
            </View>

            <View className="border border-[#e2e8f0] rounded-[10px] p-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[10px]">Top Queixas / Temas Buscados</Text>
              <View className="gap-[5px]">
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">1. Ansiedade</Text><Text className="font-bold text-[#333] text-[13px]">45%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">2. Depressão</Text><Text className="font-bold text-[#333] text-[13px]">30%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">3. Relacionamentos afetivos</Text><Text className="font-bold text-[#333] text-[13px]">15%</Text></View>
              </View>
            </View>
            
            <View className="border border-[#e2e8f0] rounded-[10px] p-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[10px]">Motivação para Terapia</Text>
              <View className="gap-[5px]">
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">1. Autoconhecimento</Text><Text className="font-bold text-[#333] text-[13px]">42%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">2. Crise momentânea</Text><Text className="font-bold text-[#333] text-[13px]">38%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">3. Indicação médica</Text><Text className="font-bold text-[#333] text-[13px]">20%</Text></View>
              </View>
            </View>

            <View className="flex-row gap-[10px]">
              <View className="flex-1 border border-[#e2e8f0] rounded-[10px] p-[15px]">
                <Text className="font-title text-[#333] text-[13px] mb-[8px]">Terapia Anterior</Text>
                <View className="flex-row justify-between mb-[4px]"><Text className="font-sans text-[#666] text-[11px]">Já fez antes</Text><Text className="font-bold text-[#333] text-[11px]">65%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[11px]">Primeira vez</Text><Text className="font-bold text-[#333] text-[11px]">35%</Text></View>
              </View>
              <View className="flex-1 border border-[#e2e8f0] rounded-[10px] p-[15px]">
                <Text className="font-title text-[#333] text-[13px] mb-[8px]">Modalidade</Text>
                <View className="flex-row justify-between mb-[4px]"><Text className="font-sans text-[#666] text-[11px]">Online</Text><Text className="font-bold text-[#333] text-[11px]">88%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[11px]">Presencial</Text><Text className="font-bold text-[#333] text-[11px]">12%</Text></View>
              </View>
            </View>

            <View className="border border-[#e2e8f0] rounded-[10px] p-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[10px]">Faixa de Investimento (Valor)</Text>
              <View className="flex-row justify-between mb-[4px]"><Text className="font-sans text-[#666] text-[13px]">R$ 100 - R$ 150</Text><Text className="font-bold text-[#333] text-[13px]">50%</Text></View>
              <View className="flex-row justify-between mb-[4px]"><Text className="font-sans text-[#666] text-[13px]">R$ 150 - R$ 200</Text><Text className="font-bold text-[#333] text-[13px]">30%</Text></View>
              <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">Acima de R$ 200</Text><Text className="font-bold text-[#333] text-[13px]">20%</Text></View>
            </View>
          </View>
        </View>

        {/* Perfil do Psicólogo */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row justify-between items-center mb-[15px]">
            <View className="flex-row items-center">
              <Text className="text-[18px] mr-[8px]">🧑‍⚕️</Text>
              <Text className="font-title text-[#333] text-[16px]">Perfil do Psicólogo</Text>
            </View>
            <Text className="font-sans text-[#94a3b8] text-[11px] font-bold bg-[#f1f5f9] px-[6px] py-[2px] rounded">450 CADASTRADOS</Text>
          </View>

          <View className="gap-[15px]">
            <View className="border border-[#e2e8f0] rounded-[10px] p-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[10px]">Abordagens Mais Comuns</Text>
              <View className="gap-[5px]">
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">1. TCC (Cognitiva)</Text><Text className="font-bold text-[#333] text-[13px]">52%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">2. Psicanálise</Text><Text className="font-bold text-[#333] text-[13px]">28%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">3. Humanista / Fenomenologia</Text><Text className="font-bold text-[#333] text-[13px]">12%</Text></View>
              </View>
            </View>
            
            <View className="border border-[#e2e8f0] rounded-[10px] p-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[10px]">Temas de Atuação Principal</Text>
              <View className="gap-[5px]">
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">Transtornos de Ansiedade</Text><Text className="font-bold text-[#333] text-[13px]">65%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">Relacionamentos</Text><Text className="font-bold text-[#333] text-[13px]">45%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">Desenvolvimento Pessoal</Text><Text className="font-bold text-[#333] text-[13px]">40%</Text></View>
              </View>
            </View>

            <View className="flex-row gap-[10px]">
              <View className="flex-1 border border-[#e2e8f0] rounded-[10px] p-[15px]">
                <Text className="font-title text-[#333] text-[13px] mb-[8px]">Modalidade Ofertada</Text>
                <View className="flex-row justify-between mb-[4px]"><Text className="font-sans text-[#666] text-[11px]">Apenas Online</Text><Text className="font-bold text-[#333] text-[11px]">75%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[11px]">Híbrido</Text><Text className="font-bold text-[#333] text-[11px]">25%</Text></View>
              </View>
              <View className="flex-1 border border-[#e2e8f0] rounded-[10px] p-[15px]">
                <Text className="font-title text-[#333] text-[13px] mb-[8px]">Gênero</Text>
                <View className="flex-row justify-between mb-[4px]"><Text className="font-sans text-[#666] text-[11px]">Mulheres</Text><Text className="font-bold text-[#333] text-[11px]">82%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[11px]">Homens</Text><Text className="font-bold text-[#333] text-[11px]">18%</Text></View>
              </View>
            </View>

            <View className="border border-[#e2e8f0] rounded-[10px] p-[15px]">
              <Text className="font-title text-[#333] text-[14px] mb-[10px]">Práticas e Vivências</Text>
              <View className="gap-[5px]">
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">Experiência com LGBTQIA+</Text><Text className="font-bold text-[#333] text-[13px]">35%</Text></View>
                <View className="flex-row justify-between"><Text className="font-sans text-[#666] text-[13px]">Luto e Perdas</Text><Text className="font-bold text-[#333] text-[13px]">25%</Text></View>
              </View>
            </View>

          </View>
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
