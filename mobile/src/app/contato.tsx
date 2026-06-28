import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';

const { width } = Dimensions.get('window');

export default function ContatoScreen() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Form State
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState('Dúvida Geral');
  const [mensagem, setMensagem] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  
  // Dropdown UI state
  const [showAssuntoPicker, setShowAssuntoPicker] = useState(false);
  const assuntos = ['Dúvida Geral', 'Sou Paciente', 'Sou Profissional', 'Imprensa // Parcerias'];

  const handleSubmit = () => {
    if (!nome || !email || !mensagem) {
      setStatus({ type: 'error', msg: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    
    setLoading(true);
    setStatus({ type: '', msg: '' });
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setStatus({ type: 'success', msg: 'Mensagem enviada com sucesso! Responderemos em breve.' });
      setNome('');
      setEmail('');
      setMensagem('');
    }, 1500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} alwaysLight={true} />
        
        <YeloScrollView 
          refreshColor="#1B4332" 
          contentContainerStyle={{ flexGrow: 1, backgroundColor: '#ffffff' }}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
          {/* CONTAINER PRINCIPAL */}
          <View className="px-[20px] pt-[40px] pb-[80px]">
            
            {/* TÍTULO DA SEÇÃO */}
            <View className="items-center mb-[40px]">
              <Text className="font-title text-[#1B4332] text-[40px] font-bold text-center mb-2">Fale Conosco</Text>
              <Text className="font-sans text-[#555] text-[16px] text-center leading-[24px] max-w-[320px]">
                Tem alguma dúvida, sugestão ou feedback? Adoraríamos ouvir você.
              </Text>
            </View>

            {/* INFO CONTATO BOX (ESQUERDA NO WEB, TOPO NO MOBILE) */}
            <View className="mb-[40px]">
              <Text className="font-title text-[#1B4332] text-[24px] mb-3">Canais de Atendimento</Text>
              <Text className="font-sans text-[#555] text-[15px] mb-6 leading-[24px]">
                Estamos aqui para ajudar. Para dúvidas gerais, parcerias ou suporte técnico, utilize um dos canais abaixo.
              </Text>
              
              <View className="gap-[16px]">
                
                {/* Canal 1 */}
                <View className="bg-[#F8F3ED] border border-[rgba(0,0,0,0.03)] shadow-[0_10px_30px_rgba(0,0,0,0.05)] rounded-tl-[24px] rounded-tr-[60px] rounded-br-[24px] rounded-bl-[60px] p-[24px] items-center text-center">
                  <View className="w-[60px] h-[60px] bg-white rounded-full items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.05)] mb-[15px]">
                    <Feather name="mail" size={24} color="#1B4332" />
                  </View>
                  <Text className="font-sans font-bold text-[#1B4332] text-[16px] mb-1">E-mail</Text>
                  <Text className="font-sans text-[#555] text-[14px]">oi@yelopsi.com.br</Text>
                </View>

                {/* Canal 2 */}
                <View className="bg-[#E6F4F1] border border-[rgba(0,0,0,0.03)] shadow-[0_10px_30px_rgba(0,0,0,0.05)] rounded-tl-[60px] rounded-tr-[24px] rounded-br-[60px] rounded-bl-[24px] p-[24px] items-center text-center">
                  <View className="w-[60px] h-[60px] bg-white rounded-full items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.05)] mb-[15px]">
                    <Feather name="clock" size={24} color="#1B4332" />
                  </View>
                  <Text className="font-sans font-bold text-[#1B4332] text-[16px] mb-1">Horário de Atendimento</Text>
                  <Text className="font-sans text-[#555] text-[14px] text-center">Segunda a Sexta, das 9h às 18h.</Text>
                </View>

                {/* Canal 3 */}
                <View className="bg-[#FFF8E1] border border-[rgba(0,0,0,0.03)] shadow-[0_10px_30px_rgba(0,0,0,0.05)] rounded-tl-[24px] rounded-tr-[60px] rounded-br-[24px] rounded-bl-[60px] p-[24px] items-center text-center">
                  <View className="w-[60px] h-[60px] bg-white rounded-full items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.05)] mb-[15px]">
                    <Feather name="map-pin" size={24} color="#1B4332" />
                  </View>
                  <Text className="font-sans font-bold text-[#1B4332] text-[16px] mb-1">Localização</Text>
                  <Text className="font-sans text-[#555] text-[14px] text-center">Atendemos 100% online em todo o Brasil.</Text>
                </View>

              </View>
            </View>

            {/* FORMULÁRIO (DIREITA NO WEB, ABAIXO NO MOBILE) */}
            <View className="bg-white border border-[rgba(0,0,0,0.03)] shadow-[0_15px_40px_rgba(0,0,0,0.08)] rounded-tl-[60px] rounded-tr-[24px] rounded-br-[60px] rounded-bl-[24px] p-[30px]">
              <Text className="font-title text-[#1B4332] text-[24px] mb-[25px]">Envie uma mensagem</Text>
              
              <View className="mb-[20px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Seu Nome</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] font-sans text-[15px] text-[#333]"
                  placeholder="Como gostaria de ser chamado?"
                  placeholderTextColor="#adb5bd"
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
              
              <View className="mb-[20px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Seu E-mail</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] font-sans text-[15px] text-[#333]"
                  placeholder="exemplo@email.com"
                  placeholderTextColor="#adb5bd"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              
              {/* Fake Select / Assunto */}
              <View className="mb-[20px] z-10 relative">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Assunto</Text>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => setShowAssuntoPicker(!showAssuntoPicker)}
                  className="bg-white border border-[#ced4da] rounded-[50px] px-[20px] py-[14px] flex-row justify-between items-center"
                >
                  <Text className="font-sans text-[15px] text-[#333]">{assunto}</Text>
                  <Feather name={showAssuntoPicker ? "chevron-up" : "chevron-down"} size={20} color="#555" />
                </TouchableOpacity>
                
                {showAssuntoPicker && (
                  <View className="absolute top-[80px] left-0 right-0 bg-white border border-[#ced4da] rounded-[24px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] py-[10px] z-50">
                    {assuntos.map((item, idx) => (
                      <TouchableOpacity 
                        key={idx}
                        className="py-[12px] px-[20px]"
                        onPress={() => {
                          setAssunto(item);
                          setShowAssuntoPicker(false);
                        }}
                      >
                        <Text className={`font-sans text-[15px] ${assunto === item ? 'text-[#1B4332] font-bold' : 'text-[#555]'}`}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              
              <View className="mb-[25px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Sua Mensagem</Text>
                <TextInput
                  className="bg-white border border-[#ced4da] rounded-[24px] px-[20px] py-[16px] font-sans text-[15px] text-[#333] h-[120px]"
                  placeholder="Escreva sua mensagem aqui..."
                  placeholderTextColor="#adb5bd"
                  multiline
                  textAlignVertical="top"
                  value={mensagem}
                  onChangeText={setMensagem}
                />
              </View>

              {/* Status Message */}
              {status.msg ? (
                <Text className={`font-sans font-bold text-[14px] mb-[15px] text-center ${status.type === 'error' ? 'text-[#e22]' : 'text-[#198754]'}`}>
                  {status.msg}
                </Text>
              ) : <View style={{ minHeight: 20, marginBottom: 15 }} />}

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={loading}
                className="bg-[#FFEE8C] rounded-[50px] py-[15px] items-center justify-center shadow-[0_4px_15px_rgba(255,238,140,0.4)]"
              >
                {loading ? (
                  <ActivityIndicator color="#1B4332" />
                ) : (
                  <Text className="font-black text-[#1B4332] text-[16px]">Enviar Mensagem</Text>
                )}
              </TouchableOpacity>
              
            </View>
            
          </View>
          
          <Footer />
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
