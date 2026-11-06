import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface CrmCardProps {
  title: string;
  description: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  onPress: () => void;
}

function CrmCard({
  title,
  description,
  badge,
  badgeBg = '#f1f5f9',
  badgeColor = '#64748b',
  icon,
  iconColor,
  iconBg,
  borderColor,
  onPress,
}: CrmCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        borderTopWidth: 4,
        borderTopColor: borderColor,
      }}
      className="bg-white rounded-[18px] p-4 border border-[#e2e8f0] shadow-sm mb-3"
    >
      <View className="flex-row justify-between items-center mb-3">
        <View 
          style={{ backgroundColor: iconBg }} 
          className="w-[42px] h-[42px] rounded-[12px] items-center justify-center"
        >
          <Feather name={icon} size={20} color={iconColor} />
        </View>
        <View className="flex-row items-center gap-1.5">
          {badge && (
            <View 
              style={{ backgroundColor: badgeBg }}
              className="px-2.5 py-1 rounded-full"
            >
              <Text 
                style={{ color: badgeColor }} 
                className="font-sans font-bold text-[10px] uppercase tracking-wider"
              >
                {badge}
              </Text>
            </View>
          )}
          <Feather name="chevron-right" size={18} color="#cbd5e1" />
        </View>
      </View>
      <Text className="font-title text-[#1e293b] text-[16px] font-bold mb-1">
        {title}
      </Text>
      <Text className="font-sans text-[#64748b] text-[13px] leading-[18px]">
        {description}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminCRMHubScreen() {
  const router = useRouter();

  return (
    <ScrollView 
      className="flex-1 bg-[#f8f9fa] px-4 pt-4" 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      {/* 1. CABEÇALHO DO HUB — Gradiente Verde Floresta idêntico à Web */}
      <LinearGradient
        colors={['#1B4332', '#0f2b20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          padding: 24,
          marginBottom: 24,
          shadowColor: '#1B4332',
          shadowOpacity: 0.12,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <View className="absolute -top-[30px] -right-[30px] w-[140px] h-[140px] bg-white/5 rounded-full pointer-events-none" />
        <Text className="font-title text-white text-[28px] font-bold mb-1">
          CRM Yelo
        </Text>
        <Text className="font-sans text-white/80 text-[14px] leading-5">
          Central de Vendas, Relacionamento, Dados e Retenção.
        </Text>
      </LinearGradient>

      {/* 2. SEÇÃO: GESTÃO DE ENTIDADES */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3 px-1">
          <Feather name="users" size={18} color="#1B4332" />
          <Text className="font-title text-[#1B4332] text-[18px] font-bold">
            Gestão de Entidades
          </Text>
        </View>

        {/* Psicólogos */}
        <CrmCard
          title="Sucesso do Psicólogo"
          description="Onboarding, performance de perfil e distribuição de leads."
          badge="Oferta"
          icon="activity"
          iconColor="#8b5cf6"
          iconBg="#f5f3ff"
          borderColor="#8b5cf6"
          onPress={() => router.push('/(admin)/(crm)/psicologos')}
        />

        {/* Leads */}
        <CrmCard
          title="Pipeline de Leads"
          description="Gestão de prospecção, estágios do funil e contatos frios."
          badge="Captação"
          icon="target"
          iconColor="#3b82f6"
          iconBg="#eff6ff"
          borderColor="#3b82f6"
          onPress={() => router.push('/(admin)/(crm)/leads')}
        />

        {/* Inbound */}
        <CrmCard
          title="Leads Inbound (Espera)"
          description="Profissionais que iniciaram o cadastro mas não finalizaram."
          badge="Inbound"
          icon="file-text"
          iconColor="#f59e0b"
          iconBg="#fffbeb"
          borderColor="#f59e0b"
          onPress={() => router.push('/(admin)/(crm)/espera')}
        />

        {/* Pacientes */}
        <CrmCard
          title="Visão 360° Pacientes"
          description="Timeline, engajamento, abandono e histórico de match."
          badge="Retenção"
          icon="heart"
          iconColor="#10b981"
          iconBg="#ecfdf5"
          borderColor="#10b981"
          onPress={() => router.push('/(admin)/(crm)/pacientes')}
        />
      </View>

      {/* 3. SEÇÃO: INTELIGÊNCIA FINANCEIRA E ANALYTICS */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3 px-1">
          <Feather name="trending-up" size={18} color="#1B4332" />
          <Text className="font-title text-[#1B4332] text-[18px] font-bold">
            Inteligência Financeira e Analytics
          </Text>
        </View>

        {/* Growth */}
        <CrmCard
          title="Growth 📈"
          description="Visão completa de aquisição, conversão, retenção e demanda do Yelo."
          icon="trending-up"
          iconColor="#10b981"
          iconBg="#111827"
          borderColor="#111827"
          onPress={() => router.push('/(admin)/(crm)/analytics-crescimento')}
        />

        {/* Painel do CMO */}
        <CrmCard
          title="Painel do CMO 🧠"
          description="Motor de Decisão Executiva de Ads cruzado com CAC e Churn."
          badge="Inteligência AI"
          icon="cpu"
          iconColor="#1e40af"
          iconBg="#dbeafe"
          borderColor="#1e3a8a"
          onPress={() => router.push('/(admin)/(crm)/cmo-metrics')}
        />

        {/* Analytics Funil */}
        <CrmCard
          title="Analytics de Funil"
          description="Métricas em tempo real, conversão end-to-end e origens UTM."
          icon="filter"
          iconColor="#f59e0b"
          iconBg="#fffbeb"
          borderColor="#f59e0b"
          onPress={() => router.push('/(admin)/(crm)/analytics-funil')}
        />

        {/* Receita e Assinaturas */}
        <CrmCard
          title="Receita e Assinaturas"
          description="MRR, taxa de Churn, Life Time Value (LTV) e faturas Asaas."
          icon="dollar-sign"
          iconColor="#14b8a6"
          iconBg="#ccfbf1"
          borderColor="#14b8a6"
          onPress={() => router.push('/(admin)/(crm)/receita')}
        />

        {/* Distribuição & Ads */}
        <CrmCard
          title="Distribuição & Ads"
          description="Análise de visibilidade de profissionais e sugestões de Ads."
          icon="pie-chart"
          iconColor="#d93025"
          iconBg="#fce8e6"
          borderColor="#d93025"
          onPress={() => router.push('/(admin)/(crm)/distribuicao')}
        />

        {/* Copilot WhatsApp AI */}
        <CrmCard
          title="Copilot WhatsApp 💬"
          description="Cole conversas do WhatsApp e receba respostas personalizadas com o dossiê real do psicólogo."
          badge="Inteligência AI"
          badgeBg="#dcfce7"
          badgeColor="#16a34a"
          icon="message-circle"
          iconColor="#16a34a"
          iconBg="#dcfce7"
          borderColor="#25d366"
          onPress={() => router.push('/(admin)/(crm)/copilot-wpp')}
        />
      </View>

      {/* 4. SEÇÃO: QUALIDADE E EXPERIÊNCIA DO CLIENTE */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3 px-1">
          <Feather name="thumbs-up" size={18} color="#1B4332" />
          <Text className="font-title text-[#1B4332] text-[18px] font-bold">
            Qualidade e Experiência do Cliente
          </Text>
        </View>

        {/* Avaliações (NPS) */}
        <CrmCard
          title="Avaliações (NPS)"
          description="Monitoramento de satisfação e depoimentos da plataforma."
          icon="star"
          iconColor="#f59e0b"
          iconBg="#fffbeb"
          borderColor="#f59e0b"
          onPress={() => router.push('/(admin)/(crm)/avaliacoes')}
        />

        {/* Motivos de Cancelamento */}
        <CrmCard
          title="Motivos de Cancelamento"
          description="Análise de atrito e feedback deixado na exclusão da conta (Churn)."
          icon="user-x"
          iconColor="#ef4444"
          iconBg="#fef2f2"
          borderColor="#ef4444"
          onPress={() => router.push('/(admin)/(crm)/cancelamentos')}
        />
      </View>

      {/* 5. SEÇÃO: COMUNICAÇÃO OMNICHANNEL */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3 px-1">
          <Feather name="message-square" size={18} color="#1B4332" />
          <Text className="font-title text-[#1B4332] text-[18px] font-bold">
            Comunicação Omnichannel
          </Text>
        </View>

        {/* Caixa de Entrada */}
        <CrmCard
          title="Caixa de Entrada (Chat)"
          description="Atendimento em tempo real a psicólogos e suporte."
          icon="inbox"
          iconColor="#3b82f6"
          iconBg="#eff6ff"
          borderColor="#3b82f6"
          onPress={() => router.push('/(admin)/(crm)/caixa-entrada')}
        />

        {/* Mural de Avisos */}
        <CrmCard
          title="Mural de Avisos"
          description="Notificações globais (Push) para os painéis dos profissionais."
          icon="bell"
          iconColor="#8b5cf6"
          iconBg="#f5f3ff"
          borderColor="#8b5cf6"
          onPress={() => router.push('/(admin)/(crm)/avisos')}
        />

        {/* Follow-up WhatsApp */}
        <CrmCard
          title="Follow-up WhatsApp"
          description="Retomada de contato (Retenção) com pacientes perdidos."
          icon="phone-call"
          iconColor="#10b981"
          iconBg="#ecfdf5"
          borderColor="#10b981"
          onPress={() => router.push('/(admin)/(crm)/followup')}
        />
      </View>
    </ScrollView>
  );
}
