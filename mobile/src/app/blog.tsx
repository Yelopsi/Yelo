import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Share, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';

const { width } = Dimensions.get('window');

// Mock Data
const MOCK_POSTS = [
  {
    id: "1",
    titulo: "O Poder da Vulnerabilidade e a Saúde Mental",
    conteudo: "Em um mundo que valoriza a força e a perfeição o tempo todo, ser vulnerável pode parecer uma fraqueza. No entanto, é exatamente na vulnerabilidade que encontramos nossa maior força e capacidade de cura. Quando nos permitimos ser imperfeitos, abrimos espaço para conexões profundas e genuínas com outras pessoas, ajudando a aliviar o fardo emocional de tentar dar conta de tudo sozinho...",
    imagem_url: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600",
    createdAt: "2024-05-15T10:00:00Z",
    curtidas: 42,
    autor: {
      nome: "Mariana Costa",
      fotoUrl: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150",
      slug: "mariana-costa"
    }
  },
  {
    id: "2",
    titulo: "Como lidar com a ansiedade no ambiente de trabalho",
    conteudo: "A ansiedade profissional é cada vez mais comum e muitas vezes se confunde com dedicação excessiva. Aprender a impor limites e separar a vida pessoal da profissional é um passo crítico para a manutenção da sua saúde a longo prazo. Pequenas pausas estratégicas e a prática da atenção plena podem transformar o seu dia a dia...",
    imagem_url: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600",
    createdAt: "2024-05-10T14:30:00Z",
    curtidas: 28,
    autor: {
      nome: "Carlos Silva",
      fotoUrl: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150",
      slug: "carlos-silva"
    }
  },
  {
    id: "3",
    titulo: "O que é Burnout e como identificar os primeiros sinais",
    conteudo: "O esgotamento mental e físico não acontece da noite para o dia. Ele vai minando sua energia silenciosamente através de fadiga constante, falta de motivação e alterações bruscas de humor. Identificar esses sinais de forma precoce é essencial para evitar o afastamento. Neste artigo, exploramos o caminho para a recuperação...",
    imagem_url: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600",
    createdAt: "2024-05-01T09:15:00Z",
    curtidas: 56,
    autor: {
      nome: "Juliana Mendes",
      fotoUrl: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150",
      slug: "juliana-mendes"
    }
  }
];

export default function BlogScreen() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  
  // Formatador de data
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  const handleLike = (postId: string) => {
    setLikedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const destaque = MOCK_POSTS[0];
  const outrosPosts = MOCK_POSTS.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} alwaysLight={true} />
        
        <YeloScrollView 
          refreshColor="#1B4332" 
          style={{ flex: 1, backgroundColor: '#ffffff' }}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
          <View className="pt-[60px] pb-[80px] px-5">
            {/* HERO SECTION */}
            <View className="items-center mb-10 text-center">
              <Text className="font-title text-[36px] text-[#1B4332] mb-3 text-center">Blog Yelo</Text>
              <Text className="font-sans text-[16px] text-[#555] text-center leading-[26px]">
                Reflexões e ferramentas para sua jornada de autoconhecimento e bem-estar.
              </Text>
            </View>

            {/* POST DESTAQUE */}
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => router.push(`/blog/post/${destaque.id}`)}
              className="bg-white rounded-[16px] overflow-hidden mb-12 shadow-[0_8px_25px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.02)]"
            >
              <View className="h-[250px] w-full">
                <Image 
                  source={{ uri: destaque.imagem_url }} 
                  className="w-full h-full"
                  resizeMode="cover" 
                />
              </View>
              <View className="p-6">
                <View className="bg-[#FFEE8C] self-start px-[16px] py-[6px] rounded-[50px] mb-[15px]">
                  <Text className="font-sans font-extrabold text-[#1B4332] text-[12px] uppercase tracking-wider">Mais Recente</Text>
                </View>
                <Text className="font-title text-[28px] text-[#1B4332] leading-tight mb-3" numberOfLines={2}>
                  {destaque.titulo}
                </Text>
                <Text className="font-sans text-[16px] text-[#666] leading-relaxed mb-6" numberOfLines={3}>
                  {destaque.conteudo}
                </Text>
                
                <View className="flex-row items-center border-t border-[#eee] pt-4 mt-auto">
                  <Image 
                    source={{ uri: destaque.autor.fotoUrl }} 
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <Text className="font-sans font-semibold text-[14px] text-[#333]">
                    Psi. {destaque.autor.nome.split(' ')[0]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* LISTA DE POSTS */}
            <View className="gap-8 mb-10">
              {outrosPosts.map((post) => (
                <TouchableOpacity 
                  key={post.id}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/blog/post/${post.id}`)}
                  className="bg-white rounded-[12px] overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.01)]"
                >
                  <View className="h-[200px] w-full">
                    <Image 
                      source={{ uri: post.imagem_url }} 
                      className="w-full h-full"
                      resizeMode="cover" 
                    />
                  </View>
                  <View className="p-6">
                    <Text className="font-sans text-[13px] text-[#888] mb-2 uppercase tracking-wide">
                      {formatDate(post.createdAt)}
                    </Text>
                    <Text className="font-title text-[22px] text-[#1B4332] leading-tight mb-3" numberOfLines={2}>
                      {post.titulo}
                    </Text>
                    <Text className="font-sans text-[15px] text-[#666] leading-relaxed mb-6" numberOfLines={3}>
                      {post.conteudo}
                    </Text>
                    
                    <View className="flex-row items-center justify-between border-t border-[#eee] pt-4 mt-auto">
                      <View className="flex-row items-center">
                        <Image 
                          source={{ uri: post.autor.fotoUrl }} 
                          className="w-7 h-7 rounded-full mr-2"
                        />
                        <Text className="font-sans font-semibold text-[13px] text-[#555]">
                          Psi. {post.autor.nome.split(' ')[0]}
                        </Text>
                      </View>
                      
                      <TouchableOpacity 
                        onPress={() => handleLike(post.id)}
                        className="flex-row items-center gap-1.5 p-2 -mr-2 -my-2"
                      >
                        <Feather 
                          name="heart" 
                          size={18} 
                          color={likedPosts[post.id] ? "#e63946" : "#555"} 
                          style={likedPosts[post.id] ? { fill: '#e63946' } : {}}
                        />
                        <Text className="font-sans font-bold text-[14px] text-[#333]">
                          {(post.curtidas || 0) + (likedPosts[post.id] ? 1 : 0)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Carregar Mais Button */}
            <View className="items-center mb-8">
              <TouchableOpacity className="border-2 border-[#1B4332] px-[24px] py-[10px] rounded-[50px]">
                <Text className="font-sans font-semibold text-[#1B4332] text-[15px]">Carregar mais artigos</Text>
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
