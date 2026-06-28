import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import YeloScrollView from '../components/YeloScrollView';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';

const { width } = Dimensions.get('window');

const FaqItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View className="mb-[15px] bg-white rounded-[16px] border border-black/5 overflow-hidden shadow-sm shadow-black/5">
      <TouchableOpacity 
        className="flex-row justify-between items-center p-[20px]" 
        activeOpacity={0.7}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text className="font-title text-[#1B4332] text-[18px] flex-1 mr-[10px]">{question}</Text>
        <Feather name={isOpen ? "minus" : "plus"} size={24} color="#1B4332" />
      </TouchableOpacity>
      {isOpen && (
        <View className="px-[20px] pb-[20px]">
          <Text className="font-sans text-[#555] text-[16px] leading-6">{answer}</Text>
        </View>
      )}
    </View>
  );
};

export default function ProfissionaisScreen() {
  const [isScrolled, setIsScrolled] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isScrolled ? '#ffffff' : '#1B4332' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} />
        <YeloScrollView 
          refreshColor="#1B4332" 
          contentContainerStyle={{ flexGrow: 1, backgroundColor: '#f9fafb' }}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
        
        {/* ================= 1. HERO SECTION ================= */}
        <View className="bg-[#1B4332] pt-[40px] px-[20px] pb-[80px] items-center relative">
          
          <View className="bg-[#112A20] border border-[#FFEE8C]/20 border-l-[6px] border-l-[#FFEE8C] rounded-[16px] p-[16px] mb-[30px] flex-row items-center w-full max-w-[600px] shadow-lg shadow-black/20">
            <View className="w-[45px] h-[45px] bg-[#FFEE8C]/15 rounded-full items-center justify-center mr-[15px]">
              <Text className="text-[20px]">🚀</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[#FFEE8C] font-title text-[16px] mb-[4px]">Plataforma em Fase de Lançamento</Text>
              <Text className="text-white/90 font-sans text-[14px] leading-5">Aproveite condições exclusivas e destaque-se como um dos primeiros profissionais na Yelo.</Text>
            </View>
          </View>

          <Text className="text-white font-title text-[40px] text-center leading-[44px] mb-[20px] max-w-[600px]">
            Viva da Psicologia com autonomia e segurança
          </Text>
          <Text className="text-white/90 font-sans text-[18px] text-center mb-[40px] max-w-[600px] leading-7">
            A Yelo conecta você a pacientes que buscam exatamente a sua abordagem. Simplifique sua gestão, receba pagamentos garantidos e foque no que importa: o atendimento.
          </Text>

          <TouchableOpacity 
            onPress={() => router.push('/psi_questionario')}
            className="bg-[#FFEE8C] rounded-[50px] py-[16px] px-[30px] w-full max-w-[400px] items-center shadow-lg shadow-[#FFEE8C]/20 mb-[20px]"
          >
            <Text className="text-[#1B4332] font-extrabold font-sans text-[16px] uppercase tracking-wide">
              Criar meu perfil profissional
            </Text>
          </TouchableOpacity>
        </View>

        {/* WAVE 1: Hero to Stats */}
        <View className="w-full -mt-[1px] bg-white">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#1B4332' }}>
            <Path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 2. STATS SECTION ================= */}
        <View className="bg-white px-[20px] pb-[40px] w-full z-10 pt-[10px]">
          <View className="w-full max-w-[1000px] self-center bg-white p-[30px] rounded-[24px] border border-black/5 shadow-xl shadow-black/10 flex-col gap-[30px]">
            <View className="items-center">
              <Text className="font-title text-[#1B4332] text-[40px] mb-[5px]">100%</Text>
              <Text className="font-sans text-[#666] text-[16px] text-center font-medium">Sigilo e Privacidade Absoluta</Text>
            </View>
            <View className="items-center">
              <Text className="font-title text-[#1B4332] text-[40px] mb-[5px]">1º</Text>
              <Text className="font-sans text-[#666] text-[16px] text-center font-medium">Seu Bem-Estar em 1º Lugar</Text>
            </View>
            <View className="items-center">
              <Text className="font-title text-[#1B4332] text-[40px] mb-[5px]">100%</Text>
              <Text className="font-sans text-[#666] text-[16px] text-center font-medium">Profissionais Verificados</Text>
            </View>
          </View>
        </View>

        {/* WAVE 2: Stats to Jornada */}
        <View className="w-full -mt-[1px] bg-[#fdfaf6]">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#ffffff' }}>
            <Path fill="#fdfaf6" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,213.3C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 3. JORNADA DO PROFISSIONAL ================= */}
        <View className="bg-[#fdfaf6] px-[20px] pb-[40px] pt-[20px] items-center">
          <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[30px] max-w-[600px] leading-[36px]">
            Do consultório vazio à gestão de alta performance
          </Text>
          <View className="max-w-[800px]">
            <Text className="font-sans text-[#555] text-[17px] leading-7 mb-[20px]">
              Sabemos que a faculdade nos prepara para a clínica, mas não para o mercado. Muitos psicólogos iniciam sua jornada divididos entre o desejo de ajudar e a burocracia de captar pacientes, cobrar sessões e gerir faltas. A Yelo nasce para eliminar esse ruído.
            </Text>
            <Text className="font-sans text-[#555] text-[17px] leading-7">
              Imagine não precisar mais enviar mensagens de cobrança constrangedoras ou passar horas tentando configurar anúncios no Google. Nós cuidamos da infraestrutura digital para que sua única preocupação seja o acolhimento e o manejo clínico.
            </Text>
          </View>
        </View>

        {/* WAVE 3: Jornada to Benefícios */}
        <View className="w-full -mt-[1px] bg-white">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#fdfaf6' }}>
            <Path fill="#ffffff" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,213.3C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 4. BENEFÍCIOS ================= */}
        <View className="bg-white px-[20px] pb-[60px] pt-[20px] items-center">
          <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[15px]">Por que escolher a Yelo?</Text>
          <Text className="font-sans text-[#666] text-[17px] text-center mb-[40px] max-w-[600px] leading-7">
            Não somos apenas um marketplace. Somos um ecossistema pensado para sustentar e alavancar sua carreira clínica.
          </Text>
          
          <View className="flex-col gap-[30px] w-full max-w-[1100px]">
            {/* Card 1 */}
            <View className="bg-white p-[30px] rounded-tl-[24px] rounded-tr-[60px] rounded-bl-[60px] rounded-br-[24px] border border-black/5 shadow-sm shadow-black/5">
              <View className="w-[60px] h-[60px] bg-white shadow-sm shadow-black/10 rounded-full items-center justify-center mb-[20px]">
                <Text className="text-[28px]">🎯</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[22px] mb-[15px]">Match Inteligente</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-6">Nosso algoritmo conecta você a pacientes que realmente se beneficiam da sua abordagem, aumentando a adesão e reduzindo desistências.</Text>
            </View>

            {/* Card 2 */}
            <View className="bg-white p-[30px] rounded-tl-[60px] rounded-tr-[24px] rounded-bl-[24px] rounded-br-[60px] border border-black/5 shadow-sm shadow-black/5">
              <View className="w-[60px] h-[60px] bg-white shadow-sm shadow-black/10 rounded-full items-center justify-center mb-[20px]">
                <Text className="text-[28px]">📊</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[22px] mb-[15px]">Gestão Financeira</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-6">Painel completo de faturamento. Visualize receitas, emita recibos automáticos e receba com segurança, sem cobrar o paciente diretamente.</Text>
            </View>

            {/* Card 3 */}
            <View className="bg-white p-[30px] rounded-tl-[24px] rounded-tr-[60px] rounded-bl-[60px] rounded-br-[24px] border border-black/5 shadow-sm shadow-black/5">
              <View className="w-[60px] h-[60px] bg-white shadow-sm shadow-black/10 rounded-full items-center justify-center mb-[20px]">
                <Text className="text-[28px]">🔄</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[22px] mb-[15px]">Retenção e Fidelização</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-6">Sistema de lembretes automáticos via WhatsApp e reagendamento simplificado para reduzir faltas e manter a continuidade do tratamento.</Text>
            </View>
          </View>
        </View>

        {/* WAVE 4: Benefícios to Diferenciais */}
        <View className="w-full -mt-[1px] bg-[#fdfaf6]">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#ffffff' }}>
            <Path fill="#fdfaf6" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,213.3C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 5. DIFERENCIAIS TÉCNICOS ================= */}
        <View className="bg-[#fdfaf6] pt-[20px] pb-[60px]">
          <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[40px] px-[20px]">Tecnologia de ponta com ética e segurança</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={295}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <View className="bg-white p-[30px] rounded-[16px] w-[280px] mr-[15px] border border-black/5">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[15px]">Segurança de Dados (LGPD)</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-6">Seus dados e os de seus pacientes são protegidos por criptografia de ponta a ponta. Seguimos rigorosamente as normas do CFP e a Lei Geral de Proteção de Dados.</Text>
            </View>
            <View className="bg-white p-[30px] rounded-[16px] w-[280px] mr-[15px] border border-black/5">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[15px]">Visibilidade Nichada</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-6">Seja encontrado por quem busca sua especialidade. Seja ansiedade, depressão, luto ou terapia de casal, nosso algoritmo direciona o público certo.</Text>
            </View>
            <View className="bg-white p-[30px] rounded-[16px] w-[280px] mr-[15px] border border-black/5">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[15px]">Autonomia de Agenda</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-6">Você define seus horários, valores e disponibilidade. A plataforma trabalha para você, não o contrário. Sincronize sua vida pessoal e profissional.</Text>
            </View>
            <View className="bg-white p-[30px] rounded-[16px] w-[280px] mr-[15px] border border-black/5">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[15px]">Relatórios de Desempenho</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-6">Entenda de onde vêm seus pacientes e qual sua taxa de retenção. Dados reais para você tomar decisões sobre sua carreira.</Text>
            </View>
          </ScrollView>
        </View>

        {/* WAVE 5: Diferenciais to Match Science */}
        <View className="w-full -mt-[1px] bg-white">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#fdfaf6' }}>
            <Path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 6. MATCH SCIENCE ================= */}
        <View className="bg-white px-[20px] pt-[20px] pb-[60px] items-center">
          <View className="max-w-[800px]">
            <Text className="font-title text-[#1B4332] text-[32px] leading-[36px] mb-[25px]">
              Chega de ser apenas mais um em catálogos infinitos.
            </Text>
            <Text className="font-sans text-[#555] text-[17px] leading-7 mb-[20px]">
              Em outras plataformas, seu perfil fica perdido numa vitrine interminável. O paciente se sente sobrecarregado com tantas opções, compara apenas preços e frequentemente desiste sem agendar. <Text className="font-bold text-[#333]">Nós invertemos esse jogo.</Text>
            </Text>
            <Text className="font-sans text-[#555] text-[17px] leading-7 mb-[25px]">
              Através do nosso <Text className="font-bold text-[#333]">Questionário de Match Inteligente</Text>, mapeamos a dor exata, as preferências e o perfil clínico de quem busca ajuda. Em vez de uma lista solta de nomes, entregamos recomendações cirúrgicas. Quando seu perfil aparece, o paciente já sente que você é a escolha certa.
            </Text>
            <View className="border-l-[4px] border-[#FFEE8C] pl-[15px] py-[5px]">
              <Text className="font-sans text-[#333] font-medium text-[17px] leading-7">
                <Text className="font-bold">O resultado?</Text> Pacientes pré-qualificados, muito mais engajados e prontos para criar vínculo. Menos abandono após a primeira sessão e uma taxa de conversão imbatível para o seu consultório.
              </Text>
            </View>
          </View>
        </View>

        {/* WAVE 6: Match Science to Depoimentos */}
        <View className="w-full -mt-[1px] bg-[#fdfaf6]">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#ffffff' }}>
            <Path fill="#fdfaf6" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 7. DEPOIMENTOS ================= */}
        <View className="bg-[#fdfaf6] pt-[20px] pb-[60px]">
          <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[40px] px-[20px]">O que dizem nossos parceiros</Text>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={330}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {/* Card 1 */}
            <View className="bg-white rounded-tl-[24px] rounded-tr-[60px] rounded-bl-[60px] rounded-br-[24px] w-[310px] p-[30px] mr-[20px] border border-black/5">
              <Text className="text-[#f59e0b] text-[20px] mb-[10px]">★★★★★</Text>
              <Text className="font-sans text-[#555] text-[16px] italic leading-6 mb-[20px]">
                "A Yelo mudou a forma como eu gerencio minha clínica. Os pacientes que chegam pelo match já vêm super alinhados com a minha abordagem."
              </Text>
              <View className="flex-row items-center">
                <View className="w-[45px] h-[45px] rounded-full bg-[#e8f5e9] mr-[12px] overflow-hidden items-center justify-center border-2 border-[#fdfaf6]">
                  <Text className="text-[#1B4332] font-bold text-[18px]">C</Text>
                </View>
                <View>
                  <Text className="font-bold text-[#1B4332] text-[14px]">Dra. Camila S.</Text>
                  <Text className="font-sans text-[#888] text-[12px]">Psicóloga Clínica</Text>
                </View>
              </View>
            </View>

            {/* Card 2 */}
            <View className="bg-white rounded-tl-[60px] rounded-tr-[24px] rounded-bl-[24px] rounded-br-[60px] w-[310px] p-[30px] mr-[20px] border border-black/5">
              <Text className="text-[#f59e0b] text-[20px] mb-[10px]">★★★★★</Text>
              <Text className="font-sans text-[#555] text-[16px] italic leading-6 mb-[20px]">
                "Finalmente uma plataforma que não me obriga a dar descontos absurdos. Eu defino meu preço e recebo 100%. É dignidade para a profissão!"
              </Text>
              <View className="flex-row items-center">
                <View className="w-[45px] h-[45px] rounded-full bg-[#e8f5e9] mr-[12px] overflow-hidden items-center justify-center border-2 border-[#fdfaf6]">
                  <Text className="text-[#1B4332] font-bold text-[18px]">R</Text>
                </View>
                <View>
                  <Text className="font-bold text-[#1B4332] text-[14px]">Dr. Roberto M.</Text>
                  <Text className="font-sans text-[#888] text-[12px]">Psicanalista</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* WAVE 7: Depoimentos to FAQ */}
        <View className="w-full -mt-[1px] bg-white">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#fdfaf6' }}>
            <Path fill="#ffffff" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,213.3C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 8. FAQ ================= */}
        <View className="bg-white px-[20px] pt-[20px] pb-[60px] items-center">
          <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[40px]">Perguntas Frequentes</Text>
          <View className="w-full max-w-[800px]">
            <FaqItem question="Como recebo pelos meus atendimentos?" answer="O repasse é feito diretamente na sua conta bancária cadastrada, de forma segura e transparente. Você acompanha todo o fluxo financeiro pelo seu painel exclusivo." />
            <FaqItem question="Posso usar a Yelo mesmo já tendo meu consultório físico?" answer="Com certeza. A Yelo funciona como um braço digital de divulgação e gestão, ideal tanto para quem atende exclusivamente online quanto para quem deseja aumentar o fluxo do consultório presencial." />
            <FaqItem question="Existe período de carência ou fidelidade?" answer="Não. Acreditamos na parceria pela qualidade. Você pode alterar seu plano ou cancelar a qualquer momento, sem letras miúdas." />
            <FaqItem question="A plataforma emite recibos para o paciente?" answer="Sim, o sistema automatiza a geração de documentos, facilitando a vida do paciente para reembolsos e a sua organização contábil." />
          </View>
        </View>

        {/* WAVE 8: FAQ to Planos */}
        <View className="w-full -mt-[1px] bg-[#1B4332]">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#ffffff' }}>
            <Path fill="#1B4332" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,213.3C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 9. PLANOS ================= */}
        <View className="bg-[#1B4332] pt-[40px] pb-[80px]">
          <Text className="font-title text-white text-[32px] text-center mb-[15px] px-[20px]">Planos transparentes</Text>
          <Text className="font-sans text-white/90 text-[17px] text-center mb-[50px] px-[20px]">
            Escolha a opção que melhor se adapta ao momento da sua carreira. Sem fidelidade, cancele quando quiser.
          </Text>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={330}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {/* Essencial */}
            <View className="bg-white rounded-[24px] w-[310px] p-[30px] mr-[20px] flex-col">
              <Text className="font-title text-[#333] text-[24px] mb-[10px]">Essencial</Text>
              <Text className="font-title text-[#1B4332] text-[18px] mb-[20px] opacity-80">Disponível na plataforma</Text>
              <View className="flex-col gap-[15px] mb-[30px] flex-grow">
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Perfil verificado</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Match Inteligente</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Página Pública</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Acesso ao Fórum</Text></View>
              </View>
              <TouchableOpacity onPress={() => router.push('/psi_questionario')} className="border-2 border-[#1B4332] rounded-[50px] py-[14px] items-center">
                <Text className="font-sans font-bold text-[#1B4332] text-[16px]">Começar na Yelo</Text>
              </TouchableOpacity>
            </View>

            {/* Clínico (Premium) */}
            <View className="bg-white rounded-[24px] w-[310px] p-[30px] mr-[20px] border-[3px] border-[#FFEE8C] relative flex-col">
              <View className="absolute top-[-16px] self-center bg-[#FFEE8C] px-[20px] py-[6px] rounded-[50px] shadow-sm shadow-[#FFEE8C]/40">
                <Text className="text-[#1B4332] font-bold text-[13px] uppercase">Mais Popular</Text>
              </View>
              <Text className="font-title text-[#333] text-[24px] mb-[10px] mt-[10px]">Clínico</Text>
              <Text className="font-title text-[#1B4332] text-[18px] mb-[20px] opacity-80">Disponível na plataforma</Text>
              <View className="flex-col gap-[15px] mb-[30px] flex-grow">
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Perfil destacado</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Intervisão e Workshops</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Indicadores de Conversão</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">URL Personalizada</Text></View>
              </View>
              <TouchableOpacity onPress={() => router.push('/psi_questionario')} className="bg-[#1B4332] rounded-[50px] py-[14px] items-center shadow-md shadow-[#1B4332]/30">
                <Text className="font-sans font-bold text-white text-[16px]">Começar na Yelo</Text>
              </TouchableOpacity>
            </View>

            {/* Referência */}
            <View className="bg-white rounded-[24px] w-[310px] p-[30px] mr-[20px] flex-col">
              <Text className="font-title text-[#333] text-[24px] mb-[10px]">Referência</Text>
              <Text className="font-title text-[#1B4332] text-[18px] mb-[20px] opacity-80">Disponível na plataforma</Text>
              <View className="flex-col gap-[15px] mb-[30px] flex-grow">
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Máxima visibilidade</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Supervisão Clínica</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Destaque nos Resultados</Text></View>
                <View className="flex-row items-center"><Text className="font-bold text-[#1B4332] text-[16px] mr-[10px]">✓</Text><Text className="font-sans text-[#555]">Análise com IA</Text></View>
              </View>
              <TouchableOpacity onPress={() => router.push('/psi_questionario')} className="border-2 border-[#1B4332] rounded-[50px] py-[14px] items-center">
                <Text className="font-sans font-bold text-[#1B4332] text-[16px]">Começar na Yelo</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* WAVE 9: Planos to CTA */}
        <View className="w-full -mt-[1px] bg-[#fdfaf6]">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#1B4332' }}>
            <Path fill="#fdfaf6" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 10. FINAL CTA ================= */}
        <View className="bg-[#fdfaf6] px-[20px] pb-[60px] pt-[20px] items-center">
          <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[20px] max-w-[600px] leading-[36px]">
            Pronto para transformar sua carreira?
          </Text>
          <Text className="font-sans text-[#666] text-[18px] text-center mb-[40px] max-w-[500px]">
            Junte-se a centenas de psicólogos que estão construindo o futuro da saúde mental no Brasil.
          </Text>
          <TouchableOpacity 
            onPress={() => router.push('/psi_questionario')}
            className="bg-[#FFEE8C] rounded-[50px] py-[18px] px-[40px] w-full max-w-[400px] items-center shadow-lg shadow-[#FFEE8C]/30"
          >
            <Text className="text-[#1B4332] font-extrabold font-sans text-[16px] uppercase tracking-wide">
              Criar perfil profissional
            </Text>
          </TouchableOpacity>
        </View>

        <Footer />
      </YeloScrollView>
      <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
