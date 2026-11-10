import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Platform, 
  ActivityIndicator, 
  Linking, 
  Share, 
  Modal, 
  TextInput,
  Alert 
} from 'react-native';
import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const VerifiedBadge = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332" />
    <Path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white" />
  </Svg>
);

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

function renderFormattedBio(html?: string | null) {
  if (!html) return null;

  let text = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?(p|div|ul|ol|span)[^>]*>/gi, '')
    .trim();

  text = text.replace(/\n{3,}/g, '\n\n');

  const regex = /(<strong\b[^>]*>[\s\S]*?<\/strong>|<b\b[^>]*>[\s\S]*?<\/b>|<em\b[^>]*>[\s\S]*?<\/em>|<i\b[^>]*>[\s\S]*?<\/i>|<u\b[^>]*>[\s\S]*?<\/u>)/gi;
  const tokens = text.split(regex);

  return tokens.map((token, idx) => {
    if (!token) return null;
    const isBold = /^<(strong|b)\b/i.test(token);
    const isItalic = /^<(em|i)\b/i.test(token);
    const isUnderline = /^<u\b/i.test(token);
    const raw = token.replace(/<[^>]+>/g, '');
    const cleanText = decodeHtmlEntities(raw);

    return (
      <Text
        key={idx}
        style={{
          fontFamily: isBold ? 'Inter_700Bold' : undefined,
          fontWeight: isBold ? '700' : '400',
          fontStyle: isItalic ? 'italic' : 'normal',
          textDecorationLine: isUnderline ? 'underline' : 'none',
          color: isBold ? '#1B4332' : '#444444',
        }}
      >
        {cleanText}
      </Text>
    );
  });
}

export default function PerfilPublicoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [psicologo, setPsicologo] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Modal para captura amigável do nome antes do WhatsApp (CRO de conversão)
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isSubmittingWhatsApp, setIsSubmittingWhatsApp] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        // Busca perfil público real pelo slug
        const response = await api.get(`/api/psychologists/slug/${slug}`);
        const data = response.data;
        setPsicologo(data);
        setReviews(data.reviews || []);

        // Pré-carrega o nome salvo anteriormente, se existir
        const savedName = await SecureStore.getItemAsync('yelo_guest_name');
        if (savedName) setGuestName(savedName);
      } catch (err: any) {
        console.error("Erro ao buscar perfil do psicólogo:", err);
        setErrorMsg(err.response?.data?.error || "Perfil não encontrado ou indisponível.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [slug]);

  const handleShare = async () => {
    if (!psicologo) return;
    try {
      await Share.share({
        message: `Conheça o perfil de ${psicologo.nome} na Yelo: https://www.yelopsi.com.br/${slug}`,
        url: `https://www.yelopsi.com.br/${slug}`
      });
    } catch (e) {
      console.log('Compartilhamento cancelado');
    }
  };

  const handleWhatsAppClick = async () => {
    if (!psicologo) return;

    // Se já tem nome salvo, avança direto
    const savedName = await SecureStore.getItemAsync('yelo_guest_name');
    if (savedName && savedName.trim() !== '') {
      proceedToWhatsApp(savedName.trim());
    } else {
      setNameModalVisible(true);
    }
  };

  const proceedToWhatsApp = async (nameToPass: string) => {
    if (!psicologo) return;
    setIsSubmittingWhatsApp(true);

    try {
      // Salva para uso futuro no SecureStore
      if (nameToPass) {
        await SecureStore.setItemAsync('yelo_guest_name', nameToPass);
      }

      // Chama o endpoint unificado do WhatsApp
      const params = new URLSearchParams();
      params.append('utm_source', 'mobile_app');
      if (nameToPass) {
        params.append('guest_name', nameToPass);
      }

      const res = await api.get(`/api/public/whatsapp/link/${psicologo.id}?${params.toString()}`);
      const data = res.data;

      if (data && data.url) {
        await Linking.openURL(data.url);
      } else {
        throw new Error("URL não retornada pelo servidor");
      }
    } catch (e) {
      console.error("Erro ao gerar link do WhatsApp:", e);
      // Fallback seguro nativo
      const cleanPhone = (psicologo.telefone || '').replace(/\D/g, '');
      if (cleanPhone) {
        const fallbackMsg = `Olá, ${psicologo.nome.split(' ')[0]}! Encontrei seu perfil na Yelo e gostaria de tirar algumas dúvidas.`;
        const fallbackUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(fallbackMsg)}`;
        Linking.openURL(fallbackUrl);
      } else {
        Alert.alert("Erro", "Não foi possível abrir o WhatsApp deste profissional.");
      }
    } finally {
      setIsSubmittingWhatsApp(false);
      setNameModalVisible(false);
    }
  };

  const normalizeList = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const formatPrice = (psi: any) => {
    const isMensal = psi.tipo_cobranca === 'mensal';
    const val = isMensal 
      ? (psi.valor_mensal_numero || psi.valor_sessao_numero) 
      : (psi.valor_sessao_numero || psi.valor_mensal_numero);

    if (!val || val <= 0) return 'A combinar';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const renderTag = (text: string) => (
    <View key={text} className="bg-[#f0fdf4] border border-[#bbf7d0] px-3.5 py-1.5 rounded-[20px] mr-2 mb-2">
      <Text className="font-sans text-[#166534] text-[13px] font-semibold">{text}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="text-[#1B4332] font-title text-[20px] mt-4">Carregando perfil...</Text>
      </View>
    );
  }

  if (errorMsg || !psicologo) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-8">
        <Text className="font-title text-[#1B4332] text-[24px] mb-2 text-center">Perfil indisponível</Text>
        <Text className="font-sans text-[#666] text-[15px] text-center mb-6">
          {errorMsg || "Este perfil não pôde ser encontrado ou foi pausado pelo profissional."}
        </Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-[#1B4332] rounded-full py-3.5 px-8"
        >
          <Text className="text-white font-bold text-[15px]">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nameParts = (psicologo.nome || '').trim().split(' ');
  const firstName = nameParts.slice(0, 2).join(' ');
  const restName = nameParts.slice(2).join(' ');

  const temas = normalizeList(psicologo.temas);
  const publico = normalizeList(psicologo.publico);
  const abordagens = normalizeList(psicologo.abordagens_tecnicas);
  const praticas = normalizeList(psicologo.praticas_afirmativas);

  return (
    <View className="flex-1 bg-[#f9fafb]" style={{ paddingTop: insets.top }}>
      
      {/* HEADER DE NAVEGAÇÃO SUPERIOR */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-[#f0f0f0] z-20">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full bg-[#f8f9fa] items-center justify-center"
        >
          <Feather name="arrow-left" size={20} color="#1B4332" />
        </TouchableOpacity>
        <Text className="font-title text-[#1B4332] text-[18px]">Perfil Profissional</Text>
        <TouchableOpacity 
          onPress={handleShare} 
          className="w-10 h-10 rounded-full bg-[#f8f9fa] items-center justify-center"
        >
          <Ionicons name="share-outline" size={20} color="#1B4332" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* CONTAINER PRINCIPAL */}
        <View className="mx-3 mt-4 bg-white rounded-[22px] p-5 mb-5 border border-[#f0f0f0] shadow-sm">
          
          {/* HERO INFO */}
          <View className="items-center mb-6">
            <View className="w-[130px] h-[130px] rounded-full border-2 border-dashed border-[#1B4332] p-1 mb-4 shadow-sm">
              <Image 
                source={{ uri: psicologo.fotoUrl || 'https://placehold.co/400x500/1B4332/FFF?text=Foto' }} 
                className="w-full h-full rounded-full" 
                resizeMode="cover"
              />
            </View>

            {/* NAME BREAK MOBILE */}
            <View className="items-center mb-1">
              <View className="flex-row items-center">
                <Text className="font-title text-[#1B4332] text-[28px] leading-[32px]">{firstName}</Text>
                <View className="ml-1 -mt-2">
                  <VerifiedBadge />
                </View>
              </View>
              {restName ? (
                <Text className="font-title text-[#555] text-[22px] font-medium leading-[26px] mt-1">{restName}</Text>
              ) : null}
            </View>

            {/* TÍTULO / ABORDAGEM */}
            <Text className="font-sans text-[#666] text-[15px] text-center px-4 mb-3 mt-1.5 leading-5">
              {psicologo.titulo || (abordagens.length > 0 ? abordagens.join(' • ') : 'Psicólogo(a) Clínico(a)')}
            </Text>

            {/* RATING BADGE */}
            <View className="flex-row items-center mb-4">
              <View className="flex-row items-center">
                <Text className="text-[16px] text-[#f59e0b]">★</Text>
                <Text className="text-[16px] text-[#f59e0b]">★</Text>
                <Text className="text-[16px] text-[#f59e0b]">★</Text>
                <Text className="text-[16px] text-[#f59e0b]">★</Text>
                <Text className="text-[16px] text-[#f59e0b]">★</Text>
              </View>
              <Text className="font-sans text-[#666] text-[14px] font-semibold ml-1.5">
                {psicologo.rating || '5.0'} de 5 ({reviews.length || psicologo.reviews_count || 12})
              </Text>
            </View>

            {/* HERO AUTHORITY BLOCK */}
            <View className="flex-row flex-wrap justify-center gap-2 mt-1 mb-5">
              <View className="flex-row items-center gap-1.5 bg-[#f8f9fa] px-3 py-1.5 rounded-[20px] border border-[#eee]">
                <Text className="text-[13px] text-[#16a34a] font-bold">✓</Text>
                <Text className="font-sans font-semibold text-[#444] text-[13px]">CRP: {psicologo.crp}</Text>
              </View>
              <View className="flex-row items-center gap-1.5 bg-[#f8f9fa] px-3 py-1.5 rounded-[20px] border border-[#eee]">
                <Text className="text-[13px] text-[#0284c7]">🔒</Text>
                <Text className="font-sans font-semibold text-[#444] text-[13px]">Sigilo Garantido</Text>
              </View>
              {psicologo.experiencia ? (
                <View className="flex-row items-center gap-1.5 bg-[#f8f9fa] px-3 py-1.5 rounded-[20px] border border-[#eee]">
                  <Text className="text-[13px]">⭐</Text>
                  <Text className="font-sans font-semibold text-[#444] text-[13px]">{psicologo.experiencia} de experiência</Text>
                </View>
              ) : null}
            </View>

            {/* QUICK INFO GRID */}
            <View className="flex-row justify-center items-center gap-6 mt-1 mb-4 w-full border-t border-[#f0f0f0] pt-4">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-[10px] bg-[#e8f5e9] items-center justify-center">
                  <Text className="text-[16px]">📍</Text>
                </View>
                <View>
                  <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide">Local</Text>
                  <Text className="font-sans font-bold text-[#333] text-[14px]">
                    {psicologo.cidade ? `${psicologo.cidade}, ${psicologo.estado || 'BR'}` : (psicologo.estado || 'Brasil')}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-[10px] bg-[#e0f2fe] items-center justify-center">
                  <Text className="text-[16px]">💻</Text>
                </View>
                <View>
                  <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide">Atende</Text>
                  <Text className="font-sans font-bold text-[#333] text-[14px]">
                    {psicologo.modalidade || 'Online e Presencial'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SOBRE MIM */}
          {psicologo.bio ? (
            <View className="mb-8 mt-2">
              <Text className="font-title-regular text-[#1B4332] text-[20px] mb-1">Sobre Mim</Text>
              <Text className="font-sans text-[#777] text-[13px] mb-4 border-b border-[#f0f0f0] pb-2">
                Conheça um pouco mais sobre minha trajetória e abordagem.
              </Text>
              <View className="bg-[#f9fafb] p-4 rounded-[16px] border border-[#f0f0f0]">
                <Text
                  className="font-sans text-[#444] text-[15px] leading-[24px] text-left"
                  numberOfLines={isBioExpanded ? undefined : 6}
                >
                  {renderFormattedBio(psicologo.bio)}
                </Text>
                {psicologo.bio.replace(/<[^>]*>?/gm, '').trim().length > 200 && (
                  <TouchableOpacity onPress={() => setIsBioExpanded(!isBioExpanded)} className="mt-3">
                    <Text className="font-sans font-bold text-[#1B4332] text-[14px] underline">
                      {isBioExpanded ? 'Mostrar menos' : 'Ler mais sobre mim'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}

          {/* FORMAÇÃO ACADÊMICA */}
          {(psicologo.formacao_nivel || psicologo.formacao_desc) ? (
            <View className="mb-8">
              <Text className="font-title-regular text-[#1B4332] text-[20px] mb-1">Formação Acadêmica</Text>
              <Text className="font-sans text-[#777] text-[13px] mb-4 border-b border-[#f0f0f0] pb-2">
                Base teórica e capacitação continuada.
              </Text>
              <View className="flex-row items-start gap-3 bg-[#f9fafb] p-4 rounded-[16px] border border-[#f0f0f0]">
                <View className="w-[42px] h-[42px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mt-0.5">
                  <Text className="text-[22px]">🎓</Text>
                </View>
                <View className="flex-1">
                  {psicologo.formacao_nivel ? (
                    <Text className="font-title-regular text-[#333] text-[16px] mb-1">{psicologo.formacao_nivel}</Text>
                  ) : null}
                  {psicologo.formacao_desc ? (
                    <Text className="font-sans text-[#666] text-[14px] leading-[21px]">{psicologo.formacao_desc}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* ESPECIALIDADES */}
          <View className="mb-6">
            <Text className="font-title-regular text-[#1B4332] text-[20px] mb-1">Especialidades</Text>
            <Text className="font-sans text-[#777] text-[13px] mb-4 border-b border-[#f0f0f0] pb-2">
              Áreas de maior aprofundamento e prática.
            </Text>

            {temas.length > 0 && (
              <View className="mb-3">
                <Text className="font-sans font-bold text-[#888] text-[13px] mb-2 uppercase tracking-wide">Temas de Atuação</Text>
                <View className="flex-row flex-wrap">{temas.map(renderTag)}</View>
              </View>
            )}

            {publico.length > 0 && (
              <View className="mb-3">
                <Text className="font-sans font-bold text-[#888] text-[13px] mb-2 uppercase tracking-wide">Público-Alvo</Text>
                <View className="flex-row flex-wrap">{publico.map(renderTag)}</View>
              </View>
            )}

            {abordagens.length > 0 && (
              <View className="mb-3">
                <Text className="font-sans font-bold text-[#888] text-[13px] mb-2 uppercase tracking-wide">Abordagem Técnica</Text>
                <View className="flex-row flex-wrap">{abordagens.map(renderTag)}</View>
              </View>
            )}

            {praticas.length > 0 && (
              <View className="mb-2">
                <Text className="font-sans font-bold text-[#888] text-[13px] mb-2 uppercase tracking-wide">Práticas Afirmativas</Text>
                <View className="flex-row flex-wrap">{praticas.map(renderTag)}</View>
              </View>
            )}
          </View>
        </View>

        {/* AVALIAÇÕES */}
        <View className="mx-3 bg-white rounded-[22px] p-5 mb-5 border border-[#f0f0f0] shadow-sm">
          <Text className="font-title-regular text-[#1B4332] text-[22px] mb-1">
            Avaliações ({reviews.length})
          </Text>
          <Text className="font-sans text-[#777] text-[13px] mb-4 border-b border-[#f0f0f0] pb-2">
            Experiências reais de pacientes atendidos.
          </Text>

          {reviews.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="font-sans text-[#888] text-[14px] text-center">
                Este profissional mantém avaliações em sigilo ou ainda não possui avaliações públicas.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 -mx-5 px-5">
              {reviews.map((r, i) => (
                <View key={i} className="bg-[#f8f9fa] border border-[#e9ecef] rounded-[16px] p-4 w-[280px] mr-3">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-title-regular text-[#333] text-[14px]">
                      {r.patientName || 'Paciente Verificado'}
                    </Text>
                    <Text className="text-[#f59e0b] text-[13px]">
                      {'★'.repeat(r.rating || 5)}
                    </Text>
                  </View>
                  <Text className="font-sans text-[#555] text-[13px] italic leading-[20px]">
                    "{r.comment || 'Atendimento muito acolhedor e profissional.'}"
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

      </ScrollView>

      {/* MODAL CRO: CAPTURA DO NOME DO PACIENTE ANTES DO WHATSAPP */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white rounded-[24px] p-6 w-full max-w-[420px] shadow-xl">
            <View className="w-12 h-12 rounded-full bg-[#E8F5E9] items-center justify-center mb-4 self-center">
              <FontAwesome name="whatsapp" size={24} color="#1B4332" />
            </View>

            <Text className="font-title text-[#1B4332] text-[22px] text-center mb-2">
              Como podemos te chamar?
            </Text>
            <Text className="font-sans text-[#666] text-[14px] text-center mb-5 leading-5">
              Isso ajuda {firstName} a te receber com mais carinho e agilidade na sua primeira mensagem.
            </Text>

            <TextInput
              value={guestName}
              onChangeText={setGuestName}
              placeholder="Digite seu primeiro nome ou apelido"
              placeholderTextColor="#999"
              autoFocus
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[14px] px-4 py-3 font-sans text-[16px] text-[#333] mb-4"
              returnKeyType="done"
              onSubmitEditing={() => proceedToWhatsApp(guestName.trim())}
            />

            <TouchableOpacity
              onPress={() => proceedToWhatsApp(guestName.trim())}
              disabled={isSubmittingWhatsApp}
              className="bg-[#1B4332] rounded-full py-3.5 items-center justify-center mb-3"
            >
              {isSubmittingWhatsApp ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans font-bold text-white text-[15px]">
                  Continuar para o WhatsApp
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => proceedToWhatsApp('')}
              disabled={isSubmittingWhatsApp}
              className="py-2 items-center justify-center"
            >
              <Text className="font-sans text-[#888] text-[14px] font-medium">
                Prefiro não informar e ir direto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BOTTOM CTA (STICKY) */}
      <View 
        className="absolute bottom-0 left-0 right-0 bg-white/95 px-5 py-4 flex-row items-center justify-between border-t border-[#f0f0f0]" 
        style={{ 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24, 
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 15,
          elevation: 8
        }}
      >
        <View className="flex-col justify-center flex-shrink mr-2">
          <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide mb-0.5">
            Por {psicologo.tipo_cobranca === 'mensal' ? 'Mês' : 'Sessão'}
          </Text>
          <Text className="font-title-regular text-[#1B4332] text-[24px]" numberOfLines={1}>
            {formatPrice(psicologo)}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={handleWhatsAppClick}
          disabled={isSubmittingWhatsApp}
          className="bg-[#1B4332] px-5 py-3.5 rounded-[50px] flex-row items-center justify-center gap-2 shadow-sm flex-shrink-0"
        >
          {isSubmittingWhatsApp ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <FontAwesome name="whatsapp" size={20} color="white" />
              <Text className="font-sans font-bold text-white text-[15px]">Falar pelo WhatsApp</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}
