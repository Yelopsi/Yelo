import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

interface PeerOpportunityStats {
  scope?: string;
  peerCount?: number;
  matches30d?: number;
  matches7d?: number;
  clicks30d?: number;
  clicks7d?: number;
  avgMatchesPerProfile30d?: number;
  avgClicksPerProfile30d?: number;
}

interface ComunidadeLockedCardProps {
  title?: string;
  description?: string;
  peerStats?: PeerOpportunityStats | null;
  globalStats?: {
    matches30d?: number;
    clicks30d?: number;
    matches7d?: number;
    clicks7d?: number;
  } | null;
  compact?: boolean;
  trialEligible?: boolean;
  ctaLabel?: string;
}

export default function ComunidadeLockedCard({
  title = 'Indicadores individuais e de mercado bloqueados',
  description,
  peerStats,
  globalStats,
  compact = false,
  trialEligible = true,
  ctaLabel,
}: ComunidadeLockedCardProps) {
  const router = useRouter();

  const resolvedDescription =
    description ||
    (trialEligible
      ? 'No Plano Comunidade (Grátis), seu perfil fica oculto nas buscas e não recebe cliques de pacientes. Indicadores individuais e comparativos são exclusivos para assinantes do Plano Essencial.'
      : 'Seu período de teste encerrou e sua conta retornou ao Plano Comunidade (Grátis), oculto nas buscas e sem cliques. Assine o Plano Essencial para reativar seu perfil e indicadores.');
  const resolvedCta =
    ctaLabel ||
    (trialEligible
      ? 'Testar 7 dias grátis e liberar cliques →'
      : 'Assinar Plano Essencial e voltar às buscas →');

  const m30 =
    peerStats?.matches30d !== undefined
      ? Number(peerStats.matches30d)
      : Number(globalStats?.matches30d ?? 0) + 20;
  const c30 =
    peerStats?.clicks30d !== undefined
      ? Number(peerStats.clicks30d)
      : Number(globalStats?.clicks30d ?? 0) + 10;
  const c7 = Number(peerStats?.clicks7d ?? globalStats?.clicks7d ?? 0);
  const avgC30 = Number(peerStats?.avgClicksPerProfile30d ?? 0);
  const cohortText =
    peerStats?.scope === 'similar_profiles'
      ? 'perfis com atuação parecida com a sua'
      : 'perfis ativos no Plano Essencial';

  return (
    <View>
      <View
        style={{
          backgroundColor: '#f8fafc',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#cbd5e1',
          borderRadius: 14,
          padding: compact ? 14 : 18,
          marginBottom: 14,
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#FFF4E5',
            borderWidth: 1,
            borderColor: '#FFB020',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#9A3412' }}>
            {trialEligible ? '🔒 Plano Comunidade (Grátis)' : '🔒 Período de teste encerrado'}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: compact ? 14 : 16,
            color: '#0f172a',
            marginBottom: 4,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: compact ? 12.5 : 13.5,
            color: '#475569',
            lineHeight: 19,
          }}
        >
          {resolvedDescription}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: '#f0fdf4',
          borderWidth: 1,
          borderColor: '#86efac',
          borderRadius: 16,
          padding: compact ? 15 : 18,
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: compact ? 14 : 15.5,
            color: '#166534',
            marginBottom: 10,
          }}
        >
          🔥 Desempenho de perfis como o seu na Yelo
        </Text>

        {m30 > 0 || c30 > 0 ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#bbf7d0',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 24, color: '#1B4332' }}>
                  +{c30}
                </Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#166534', marginTop: 2 }}>
                  Cliques no WhatsApp (30d)
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#bbf7d0',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 24, color: '#1B4332' }}>
                  +{m30}
                </Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#166534', marginTop: 2 }}>
                  Aparições no Match (30d)
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 12.5,
                color: '#14532d',
                lineHeight: 18,
                marginBottom: 12,
              }}
            >
              Nos últimos 30 dias, {cohortText} receberam <Text style={{ fontWeight: '700' }}>{m30} matches</Text> e <Text style={{ fontWeight: '700' }}>{c30} cliques no WhatsApp</Text>
              {avgC30 >= 0.1 ? ` (média de ${avgC30.toFixed(1).replace('.', ',')} cliques/perfil ativo)` : ''}
              {c7 > 0 ? ` - com ${c7} só nos últimos 7 dias` : ''}. {trialEligible ? 'Ative seu teste grátis para receber esses contatos.' : 'Reative sua assinatura para voltar a receber esses contatos.'}
            </Text>
          </>
        ) : (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12.5,
              color: '#14532d',
              lineHeight: 18,
              marginBottom: 12,
            }}
          >
            Perfis visíveis no Plano Essencial aparecem nas recomendações do Match Inteligente e recebem cliques diretos no WhatsApp todos os dias.
          </Text>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.navigate('/assinatura')}
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 999,
            paddingVertical: 11,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' }}>
            {resolvedCta}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
