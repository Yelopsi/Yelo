import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import YeloScrollView from '../components/YeloScrollView';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';

export default function Termos() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PublicHeader alwaysLight />
        
        <YeloScrollView>
          <View className="px-[20px] py-[30px]">
            <Text className="font-title text-[#1B4332] text-[28px] mb-[10px]">Termos e Condições Gerais de Uso</Text>
            <View className="bg-[#f3f4f6] self-start px-[12px] py-[6px] rounded-[50px] mb-[30px]">
              <Text className="font-sans text-[#4b5563] text-[13px] font-bold">Última atualização: 16 de Dezembro de 2025</Text>
            </View>

            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">
              O presente instrumento particular de <Text className="font-bold">TERMOS E CONDIÇÕES GERAIS DE USO</Text> ("Termos") regula os direitos e obrigações relacionados ao uso da Plataforma Digital <Text className="font-bold">YELO</Text> ("Plataforma"), desenvolvida e provida pela <Text className="font-bold">YELO SAÚDE MENTAL</Text>, doravante denominada simplesmente "YELO".
            </Text>

            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px] uppercase font-bold">
              AO ACESSAR, NAVEGAR OU UTILIZAR QUALQUER FUNCIONALIDADE DA PLATAFORMA, O USUÁRIO DECLARA TER LIDO, COMPREENDIDO E ACEITO, SEM RESERVAS, TODAS AS DISPOSIÇÕES AQUI CONTIDAS. CASO NÃO CONCORDE COM QUALQUER DISPOSIÇÃO, O USUÁRIO DEVERÁ ABSTER-SE DE UTILIZAR A PLATAFORMA.
            </Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">1. Definições Iniciais</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[10px]">Para fins de interpretação destes Termos, aplicam-se as seguintes definições:</Text>
            
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. <Text className="font-bold">Usuário/Paciente:</Text> Pessoa física que acessa a Plataforma com o intuito de buscar serviços de psicologia.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. <Text className="font-bold">Profissional/Psicólogo:</Text> Profissional de psicologia devidamente registrado no Conselho Regional de Psicologia (CRP), que utiliza a Plataforma para ofertar seus serviços.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. <Text className="font-bold">Plataforma:</Text> O ambiente digital Yelo, acessível via web ou dispositivos móveis, destinado à intermediação e "match" terapêutico.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">4. <Text className="font-bold">Serviços:</Text> A tecnologia de conexão, agendamento, busca e processamento de informações provida pela YELO.</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">2. Objeto e Natureza da Plataforma</Text>
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. A YELO consiste em uma plataforma tecnológica de <Text className="font-bold">intermediação</Text> que utiliza algoritmos de compatibilidade ("match") para aproximar Pacientes e Profissionais.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. A YELO <Text className="font-bold">NÃO É UMA CLÍNICA DE PSICOLOGIA</Text>, nem prestadora de serviços de saúde. A responsabilidade técnica, ética e legal pelo atendimento psicológico recai <Text className="font-bold">exclusivamente</Text> sobre o Profissional contratado.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. Não há vínculo empregatício, societário ou de subordinação entre a YELO e os Profissionais cadastrados. Os Psicólogos atuam com total autonomia técnica e científica.</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">3. Limitações e Atendimentos de Emergência</Text>
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. A Plataforma destina-se a atendimentos terapêuticos eletivos e <Text className="font-bold text-[#b91c1c]">NÃO DEVE SER UTILIZADA PARA CASOS DE EMERGÊNCIA</Text>, risco de vida, ideação suicida ou surtos psicóticos.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. Em caso de crise ou emergência, o Usuário deve dirigir-se imediatamente ao hospital mais próximo ou contatar os serviços públicos de emergência (SAMU 192, Bombeiros 193) ou o CVV (188).</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">4. Cadastro e Elegibilidade</Text>
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. O acesso às funcionalidades completas da Plataforma exige a realização de um cadastro prévio. O Usuário garante que todas as informações fornecidas são verdadeiras, exatas, atuais e completas.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. O Usuário é o único responsável pela guarda e sigilo de suas credenciais de acesso (login e senha). A YELO não se responsabiliza por acessos não autorizados resultantes de negligência do Usuário.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. Para os Profissionais, o cadastro está condicionado à validação de regularidade junto ao Conselho Regional de Psicologia (CRP) e à verificação documental (e-Psi).</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">5. Obrigações e Responsabilidades</Text>
            <Text className="font-sans font-bold text-[#333] text-[16px] mb-[5px]">5.1. Do Usuário</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[5px]">O Usuário obriga-se a:</Text>
            <View className="ml-[10px] mb-[15px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">1. Utilizar a Plataforma em estrita conformidade com a legislação brasileira vigente.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">2. Honrar os compromissos de agendamento e pagamento assumidos perante o Profissional.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">3. Tratar os Profissionais com respeito e urbanidade.</Text>
            </View>

            <Text className="font-sans font-bold text-[#333] text-[16px] mb-[5px]">5.2. Do Profissional</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[5px]">O Profissional obriga-se a:</Text>
            <View className="ml-[10px] mb-[15px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">1. Manter seu registro no CRP ativo e regular.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">2. Cumprir rigorosamente o Código de Ética Profissional do Psicólogo.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">3. Garantir o sigilo profissional das sessões realizadas, utilizando meios seguros de comunicação.</Text>
            </View>

            <Text className="font-sans font-bold text-[#333] text-[16px] mb-[5px]">5.3. Da Yelo</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">A YELO compromete-se a empregar seus melhores esforços para manter a Plataforma disponível e segura, mas não garante que o serviço será ininterrupto ou livre de erros técnicos, oscilações de internet ou falhas de terceiros.</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">6. Pagamentos e Política de Cancelamento</Text>
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. Os valores das sessões são definidos livremente pelos Profissionais, sem interferência da YELO na precificação dos honorários.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. A YELO poderá atuar como facilitadora de pagamentos. Nesses casos, a Plataforma reterá as taxas de serviço e repassará o valor devido ao Profissional.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. A política de cancelamento, reagendamento e reembolso ("no-show") é definida individualmente por cada Profissional em seu perfil, devendo o Usuário estar ciente antes da contratação.</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">7. Propriedade Intelectual</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">Todos os direitos de propriedade intelectual sobre a Plataforma, incluindo, mas não se limitando a: software, algoritmos de "match", design, marcas, logotipos, textos e imagens, são de titularidade exclusiva da YELO. É vedada qualquer reprodução, engenharia reversa ou exploração comercial não autorizada.</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">8. Proteção de Dados (LGPD)</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">O tratamento de dados pessoais realizado pela YELO segue rigorosamente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), conforme detalhado em nossa <Text className="font-bold">Política de Privacidade</Text>.</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">9. Disposições Finais e Foro</Text>
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. A YELO reserva-se o direito de alterar estes Termos a qualquer momento, mediante publicação da nova versão na Plataforma.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. A tolerância quanto ao descumprimento de qualquer obrigação não significará renúncia ao direito de exigir o cumprimento da obrigação.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. Fica eleito o Foro da Comarca de São Paulo/SP para dirimir quaisquer litígios oriundos destes Termos, renunciando as partes a qualquer outro, por mais privilegiado que seja.</Text>
            </View>
          </View>
          
          <Footer />
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
