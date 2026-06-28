import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import YeloScrollView from '../components/YeloScrollView';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import { Feather } from '@expo/vector-icons';

export default function MapaSite() {
  const router = useRouter();

  const handlePress = (route: any) => {
    router.push(route);
  };

  const secoes = [
    {
      titulo: 'Páginas Institucionais',
      links: [
        { label: 'Início', route: '/' },
        { label: 'Match com Psicólogo', route: '/questionario' },
        { label: 'Pergunte a um Especialista', route: '/comunidade' },
        { label: 'Blog e Artigos', route: '/blog' },
        { label: 'Para Psicólogos (Plataforma)', route: '/sobre_psis' },
        { label: 'Sobre a Yelo', route: '/sobre' },
        { label: 'Dúvidas Frequentes (FAQ)', route: '/faq' },
        { label: 'Contato', route: '/contato' }
      ]
    },
    {
      titulo: 'Nossos Profissionais',
      desc: 'Conheça nossa rede de especialistas parceiros.',
      links: [
        { label: 'Buscar Profissionais', route: '/busca' }
      ]
    },
    {
      titulo: 'Termos e Políticas',
      links: [
        { label: 'Política de Privacidade', route: '/privacidade' },
        { label: 'Termos de Uso', route: '/termos' }
      ]
    }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PublicHeader alwaysLight />
        
        <YeloScrollView>
          <View className="px-[20px] py-[30px] items-center">
            <Text className="font-title text-[#1B4332] text-[32px] mb-[30px] text-center">Mapa do Site</Text>

            <View className="w-full max-w-[600px]">
              {secoes.map((secao, idx) => (
                <View key={idx} className="mb-[40px]">
                  <View className="border-b-2 border-[#e8f5e9] pb-[10px] mb-[15px]">
                    <Text className="font-title text-[#2D6A4F] text-[22px]">{secao.titulo}</Text>
                  </View>
                  
                  {secao.desc && (
                    <Text className="font-sans text-[#666] text-[15px] mb-[15px]">{secao.desc}</Text>
                  )}

                  <View className="flex-row flex-wrap gap-[10px]">
                    {secao.links.map((link, lidx) => (
                      <TouchableOpacity 
                        key={lidx} 
                        onPress={() => handlePress(link.route)}
                        className="bg-[#fdfaf6] border border-[#f0eee9] rounded-[8px] py-[10px] px-[15px] w-full max-w-[48%] flex-row justify-between items-center"
                      >
                        <Text className="font-sans text-[#555] text-[15px]" numberOfLines={1}>{link.label}</Text>
                        <Feather name="chevron-right" size={16} color="#bbb" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
          
          <Footer />
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
