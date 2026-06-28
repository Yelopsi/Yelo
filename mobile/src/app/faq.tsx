import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, LayoutAnimation, UIManager, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';

// Habilita animações fluidas de Layout no Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width } = Dimensions.get('window');

// ==========================================
// DADOS EXTRAÍDOS DO EJS
// ==========================================
const faqPacientes = [
  { q: "O que é a Yelo?", a: "A Yelo é uma plataforma de conexão qualificada entre pacientes e psicólogos. Através de um questionário simples, conectamos você a profissionais que se alinham com suas necessidades, valores e preferências." },
  { q: "Quanto custa usar a Yelo para encontrar um profissional?", a: "Para pacientes, o uso da plataforma é 100% gratuito. Nossa missão é democratizar o acesso à psicoterapia, e isso começa por facilitar a sua busca sem nenhum custo." },
  { q: "Preciso me cadastrar para usar a plataforma?", a: "Não para encontrar um profissional. Você pode preencher o questionário e receber suas recomendações de forma anônima. O cadastro só é necessário se você quiser salvar perfis ou deixar uma avaliação." },
  { q: "A Yelo oferece atendimento de emergência?", a: "Não. A Yelo é uma plataforma para conectar você a profissionais para sessões agendadas. Se você estiver em uma crise, por favor, ligue para o CVV (Centro de Valorização da Vida) no número 188 ou procure o hospital mais próximo." },
  { q: "Por que preciso preencher um questionário?", a: "O questionário ajuda a reduzir a chance de conexões incompatíveis. Ele foi desenhado para entender suas preferências e o que você busca na terapia, aumentando a chance de você encontrar alguém com quem realmente se conecte." },
  { q: "Minhas respostas no questionário são confidenciais?", a: "Sim, totalmente. Suas respostas são usadas apenas pelo sistema de recomendação da plataforma para o 'match' e não são compartilhadas com os psicólogos. O que você compartilha na terapia é uma conversa privada entre você e o profissional." },
  { q: "Quantos profissionais vou receber como recomendação?", a: "Para evitar a 'paralisia da escolha', nossa plataforma apresenta no máximo 3 profissionais que mais se alinham com suas respostas. Acreditamos na qualidade acima da quantidade." },
  { q: "E se eu não encontrar nenhum profissional compatível?", a: "Se não encontrarmos um 'match' ideal, nossa plataforma te mostrará perfis 'próximos', explicando as semelhanças e diferenças. Você também terá a opção de ser notificado(a) assim que um profissional com seu perfil exato se cadastrar." },
  { q: "Posso escolher um profissional diretamente, sem o questionário?", a: "O questionário é obrigatório porque melhora significativamente a qualidade das recomendações. Ele nos ajuda a entender o seu momento e as suas necessidades, garantindo indicações muito mais assertivas para a sua jornada." },
  { q: "O que acontece depois que eu recebo os resultados?", a: "Você verá os perfis recomendados e, ao clicar, terá acesso a todas as informações do psicólogo. Se sentir que é uma boa conexão, haverá um botão para iniciar o contato diretamente pelo WhatsApp do profissional." },
  { q: "As sessões de terapia são feitas na plataforma Yelo?", a: "Não. A Yelo é a ponte que conecta você ao profissional. O agendamento, o pagamento e as sessões são combinados diretamente entre você e o psicólogo, com total autonomia." },
  { q: "Como posso avaliar um profissional?", a: "Após iniciar o contato, você pode deixar uma avaliação diretamente na página pública do profissional. Para garantir autenticidade e segurança, a validação é feita através da sua conta Google." }
];

const faqProfissionais = [
  { q: "Quem pode se cadastrar na Yelo?", a: "A Yelo é exclusiva para psicólogas e psicólogos com CRP ativo no Brasil. A verificação de credenciais é uma etapa obrigatória do nosso processo de cadastro." },
  { q: "Como funciona o processo de cadastro?", a: "Primeiro, você realiza um pré-cadastro. Nosso sistema analisa a demanda atual para o seu perfil profissional. Havendo compatibilidade, você é convidado(a) a concluir o cadastro na plataforma. Caso contrário, seu perfil entra na lista de espera até a abertura de novas vagas compatíveis." },
  { q: "Por que existe uma lista de espera?", a: "A lista de espera evita a saturação de profissionais na plataforma, garantindo que os psicólogos ativos recebam um volume equilibrado de contatos qualificados." },
  { q: "Quais são os planos e o que cada um oferece?", a: "Oferecemos três planos em condição especial de lançamento: Essencial (R$ 99/mês) com até 5 contatos iniciados; Clínico (R$ 159/mês) com até 15 contatos iniciados e acesso a workshops; e Referência (R$ 259/mês) com até 30 contatos iniciados e acesso total a todos os recursos." },
  { q: "O que conta como um contato iniciado?", a: "Um contato é contabilizado apenas quando o paciente clica para iniciar conversa no seu WhatsApp. Limitamos o número de contatos por plano para garantir uma distribuição equilibrada entre os profissionais da plataforma. Ao atingir o limite do plano, o perfil deixa de aparecer temporariamente nos resultados até a renovação da assinatura ou upgrade do plano." },
  { q: "Tenho acesso às respostas do questionário do paciente?", a: "Não. Por razões de privacidade e ética (LGPD), as respostas do questionário são confidenciais e usadas apenas pelo sistema de recomendação da plataforma. O primeiro contato é o momento para você iniciar sua própria avaliação (anamnese)." },
  { q: "A Yelo interfere nos meus honorários, pagamentos ou forma de atender?", a: "Não. Você tem total autonomia sobre seu valor, agenda, abordagem e condução das sessões. Receba 100% do valor da consulta diretamente do paciente, sem pagar taxas ou comissões para a plataforma. Você é livre para cobrar por sessão avulsa, pacotes mensais e escolher a forma de pagamento (PIX, cartão, etc). Utilize nosso painel exclusivo apenas para organizar seus recebimentos e ter previsibilidade financeira." },
  { q: "A Yelo é uma plataforma nova?", a: "Sim! A Yelo é uma plataforma recém-lançada. Justamente por estarmos em fase de lançamento, você notará uma crescente movimentação em nossas redes, e estamos oferecendo condições especiais para os primeiros profissionais. Estamos ampliando gradualmente os investimentos em aquisição de pacientes. Nosso foco atual é crescer de forma sustentável, mantendo a qualidade das conexões e da experiência dos profissionais na plataforma." },
  { q: "O que é a Comunidade Yelo?", a: "É um espaço exclusivo para os profissionais da nossa rede, com canais de discussão, workshops, grupos de supervisão e intervisão para apoiar seu desenvolvimento profissional contínuo." }
];

const BGS = ['#F8F3ED', '#E6F4F1', '#FFF8E1']; // Creme, Verde Suave, Amarelo Suave

// ==========================================
// COMPONENTES
// ==========================================
function FAQItem({ item, index }: { item: any, index: number }) {
  const [expanded, setExpanded] = useState(false);
  
  const toggle = () => {
    // Aplica transição suave (como se fosse grid-template-rows: 0fr -> 1fr no CSS)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const bgColor = BGS[index % 3];
  
  // Replicando o "border-radius orgânico" e alternado do CSS
  const isEven = index % 2 === 0;
  const borderRadiusStyle = isEven 
    ? { borderTopLeftRadius: 24, borderTopRightRadius: 60, borderBottomRightRadius: 24, borderBottomLeftRadius: 60 }
    : { borderTopLeftRadius: 60, borderTopRightRadius: 24, borderBottomRightRadius: 60, borderBottomLeftRadius: 24 };

  return (
    <View style={[{ backgroundColor: bgColor, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' }, borderRadiusStyle]}>
      <TouchableOpacity 
        activeOpacity={0.6} 
        onPress={toggle} 
        className="flex-row items-center justify-between py-[20px] px-[30px]"
      >
        <Text className="font-title text-[#1B4332] text-[16px] font-semibold flex-1 pr-4 leading-snug">{item.q}</Text>
        <Text className="font-title text-[#1B4332] text-[24px]" style={{ transform: [{ rotate: expanded ? '45deg' : '0deg' }] }}>
          +
        </Text>
      </TouchableOpacity>
      
      {expanded && (
        <View className="px-[30px] pb-[30px]">
          <Text className="font-sans text-[#555] text-[15px] leading-relaxed">
            {item.a}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function FAQScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  // Busca Local otimizada
  const filteredPacientes = useMemo(() => {
    if (!search) return faqPacientes;
    const s = search.toLowerCase();
    return faqPacientes.filter(f => f.q.toLowerCase().includes(s) || f.a.toLowerCase().includes(s));
  }, [search]);

  const filteredProfissionais = useMemo(() => {
    if (!search) return faqProfissionais;
    const s = search.toLowerCase();
    return faqProfissionais.filter(f => f.q.toLowerCase().includes(s) || f.a.toLowerCase().includes(s));
  }, [search]);

  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isScrolled ? '#ffffff' : '#1B4332' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} />
        
        <YeloScrollView 
          style={{ flex: 1, backgroundColor: '#1B4332' }} 
          showsVerticalScrollIndicator={false} 
          refreshColor="#ffffff"
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
          <View className="bg-white">
            
            {/* HERO SECTION CONTAINER */}
            <View className="bg-[#1B4332] pt-[40px] relative z-10">
              
              {/* INNER CONTENT */}
              <View className="px-5 pb-[120px] items-center">

              <Text className="font-title text-[36px] text-white text-center mb-4 leading-tight font-black">
                Perguntas Frequentes
              </Text>
              <Text className="font-sans text-[16px] text-white/90 text-center mb-10 px-2 leading-relaxed">
                Encontre aqui as respostas para as suas principais dúvidas sobre a Yelo.
              </Text>

              {/* BARRA DE BUSCA (.faq-busca-container) */}
              <View className="w-full max-w-[800px] flex-row items-center bg-white rounded-[30px] shadow-[0_4px_15px_rgba(0,0,0,0.2)] px-[25px] py-[18px]">
                <Feather name="search" size={20} color="#999" className="mr-3" />
                <TextInput
                  className="flex-1 font-sans text-[16px] text-[#333]"
                  placeholder="Digite uma palavra-chave (ex: preço, cadastro)..."
                  placeholderTextColor="#999"
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Feather name="x-circle" size={20} color="#ccc" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ONDA DE DIVISÃO (.faq-wave-bottom) - Copiada da Index */}
            <View className="w-full -mb-1">
                <Svg viewBox="0 0 1440 320" width="100%" height={width * (320 / 1440)} preserveAspectRatio="none">
                  <Path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
                </Svg>
              </View>
            </View>

            {/* CONTEUDO */}
            <View className="px-5 pt-[40px] pb-[100px] max-w-[900px] mx-auto w-full relative">
              
              {/* CATEGORIA: PACIENTES */}
              {(filteredPacientes.length > 0 || search === '') && (
                <View className="mb-10">
                  <Text className="font-title text-[24px] text-[#1B4332] text-center mb-6 border-b border-[#eee] pb-4">
                    Para Pacientes
                  </Text>
                  {filteredPacientes.map((item, i) => (
                    <FAQItem key={`paciente-${i}`} item={item} index={i} />
                  ))}
                  {filteredPacientes.length === 0 && search !== '' && (
                    <Text className="font-sans text-center text-[#777] italic py-4">Nenhuma dúvida encontrada nesta categoria.</Text>
                  )}
                </View>
              )}

              {/* CATEGORIA: PROFISSIONAIS */}
              {(filteredProfissionais.length > 0 || search === '') && (
                <View className="mb-10">
                  <Text className="font-title text-[24px] text-[#1B4332] text-center mb-6 border-b border-[#eee] pb-4 mt-6">
                    Para Profissionais
                  </Text>
                  {filteredProfissionais.map((item, i) => (
                    <FAQItem key={`prof-${i}`} item={item} index={i} />
                  ))}
                  {filteredProfissionais.length === 0 && search !== '' && (
                    <Text className="font-sans text-center text-[#777] italic py-4">Nenhuma dúvida encontrada nesta categoria.</Text>
                  )}
                </View>
              )}

              {/* CARD CTA: Ainda com dúvidas? */}
              <View className="bg-[#e9ecef] p-[40px] rounded-[16px] items-center mt-[40px]" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 2 }}>
                <Text className="font-title text-[24px] text-[#1B4332] mb-2 text-center">Ainda com dúvidas?</Text>
                <Text className="font-sans text-[#555] mb-[25px] text-center leading-relaxed">Nossa equipe está pronta para te ajudar. Entre em contato conosco.</Text>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  className="bg-[#1B4332] py-[15px] px-[30px] rounded-[50px] shadow-sm"
                >
                  <Text className="font-black text-white text-[16px]">Fale Conosco</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* RODAPÉ GLOBAL */}
            <Footer />

          </View>
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
