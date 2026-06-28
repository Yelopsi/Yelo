import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import YeloScrollView from '../components/YeloScrollView';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';

export default function Privacidade() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PublicHeader alwaysLight />
        
        <YeloScrollView>
          <View className="px-[20px] py-[30px]">
            <Text className="font-title text-[#1B4332] text-[28px] mb-[10px]">Política de Privacidade e Proteção de Dados</Text>
            <View className="bg-[#e8f5e9] self-start px-[12px] py-[6px] rounded-[50px] mb-[30px]">
              <Text className="font-sans text-[#166534] text-[13px] font-bold">Em conformidade com a LGPD (Lei nº 13.709/2018)</Text>
            </View>

            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">
              A <Text className="font-bold">YELO SAÚDE MENTAL</Text> ("Nós", "Controladora"), pessoa jurídica de direito privado, reafirma seu compromisso inegociável com a segurança, privacidade e transparência no tratamento das informações de seus usuários. Esta Política descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais.
            </Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">1. Glossário e Definições Legais</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[10px]">Para o perfeito entendimento desta política, adotamos as definições da LGPD:</Text>
            
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. <Text className="font-bold">Dado Pessoal:</Text> Informação relacionada a pessoa natural identificada ou identificável.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. <Text className="font-bold">Dado Pessoal Sensível:</Text> Dado pessoal sobre origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato ou a organização de caráter religioso, filosófico ou político, <Text className="font-bold">dado referente à saúde</Text> ou à vida sexual, dado genético ou biométrico.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. <Text className="font-bold">Titular:</Text> Pessoa natural a quem se referem os dados pessoais que são objeto de tratamento (Você).</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">4. <Text className="font-bold">Tratamento:</Text> Toda operação realizada com dados pessoais, como coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação.</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">2. Dados Coletados e Finalidade</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">
              A coleta de dados na Plataforma YELO ocorre conforme as bases legais de <Text className="italic">Execução de Contrato</Text>, <Text className="italic">Consentimento</Text> e <Text className="italic">Legítimo Interesse</Text>, para as seguintes finalidades:
            </Text>

            <Text className="font-sans font-bold text-[#333] text-[16px] mb-[5px]">2.1. Dados de Cadastro (Identificação)</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[15px]">
              <Text className="font-bold">Dados:</Text> Nome completo, CPF, e-mail, número de telefone, data de nascimento e endereço.{"\n"}
              <Text className="font-bold">Finalidade:</Text> Identificação do usuário, validação jurídica, formalização do contrato de prestação de serviços, emissão de notas fiscais e comunicação transacional.
            </Text>

            <Text className="font-sans font-bold text-[#333] text-[16px] mb-[5px]">2.2. Dados Sensíveis (Saúde e Perfil Comportamental)</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[15px]">
              <Text className="font-bold">Dados:</Text> Respostas aos questionários de triagem ("match"), incluindo relatos de sentimentos, histórico de tratamentos psicológicos anteriores, preferências de abordagem terapêutica, queixas principais e objetivos com a terapia.{"\n"}
              <Text className="font-bold">Finalidade:</Text> Alimentação do algoritmo proprietário de compatibilidade para sugestão de profissionais (Psicólogos) adequados ao perfil do paciente. <Text className="font-bold">Base Legal:</Text> Consentimento expresso e específico do Titular (Art. 11, I da LGPD).
            </Text>

            <Text className="font-sans font-bold text-[#333] text-[16px] mb-[5px]">2.3. Dados de Navegação e Dispositivo</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">
              <Text className="font-bold">Dados:</Text> Endereço IP, geolocalização, tipo de dispositivo, sistema operacional, navegador, tempo de permanência e cliques.{"\n"}
              <Text className="font-bold">Finalidade:</Text> Segurança da informação (prevenção a fraudes), melhoria da experiência do usuário (UX) e análise de performance da plataforma.
            </Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">3. Compartilhamento de Dados</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[10px]">A YELO preza pelo sigilo das informações. O compartilhamento de dados ocorrerá estritamente nas seguintes hipóteses:</Text>
            
            <View className="ml-[10px] mb-[20px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">1. <Text className="font-bold">Com Profissionais de Saúde:</Text> Ao selecionar um Psicólogo e solicitar agendamento ou contato, o Titular autoriza o envio de seus dados de identificação e perfil básico para que o profissional possa iniciar o atendimento. O sigilo do conteúdo das sessões é responsabilidade exclusiva do Psicólogo, protegido pelo Código de Ética Profissional.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">2. <Text className="font-bold">Com Prestadores de Serviço Tecnológico:</Text> Servidores de hospedagem em nuvem (Cloud Computing), gateways de pagamento e ferramentas de análise, desde que estes parceiros estejam em conformidade com padrões rígidos de segurança.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[8px]">3. <Text className="font-bold">Por Determinação Legal:</Text> Para cumprimento de obrigação legal ou regulatória, ou mediante ordem judicial.</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">4. Transferência Internacional de Dados</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">A YELO utiliza infraestrutura tecnológica de terceiros, cujos servidores podem estar localizados fora do Brasil. A YELO assegura que tais transferências ocorrem para países que proporcionam grau de proteção de dados pessoais adequado.</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">5. Direitos do Titular</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[10px]">Em conformidade com o Artigo 18 da LGPD, o Titular poderá, a qualquer momento e mediante requisição gratuita:</Text>
            <View className="ml-[10px] mb-[10px]">
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">1. Confirmar a existência de tratamento de dados.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">2. Acessar seus dados.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">3. Corrigir dados incompletos, inexatos ou desatualizados.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">4. Solicitar a anonimização, bloqueio ou eliminação de dados.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">5. Revogar o consentimento.</Text>
              <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[4px]">6. Solicitar a portabilidade dos dados.</Text>
            </View>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">Para exercer seus direitos, contate nosso Encarregado de Dados (DPO).</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">6. Segurança da Informação</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">7. Prazo de Armazenamento</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">Os dados pessoais serão mantidos pelo tempo necessário para cumprir as finalidades para as quais foram coletados. Após o término do tratamento, os dados serão eliminados de forma segura.</Text>

            <Text className="font-title text-[#1B4332] text-[20px] mt-[10px] mb-[15px]">8. Contato e Responsável</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-[26px] mb-[20px]">Para dúvidas sobre esta Política, entre em contato através do e-mail: <Text className="font-bold text-[#1B4332]">privacidade@yelopsi.com.br</Text>.</Text>
            
            <View className="bg-[#f8f9fa] border border-[#e9ecef] p-[20px] rounded-[16px]">
              <Text className="font-sans text-[#333] text-[16px] leading-[24px]">
                <Text className="font-bold">Responsável Técnico:</Text>{"\n"}
                Anderson Costa{"\n"}
                Psicólogo - CRP: 06/190861
              </Text>
            </View>
          </View>
          
          <Footer />
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
