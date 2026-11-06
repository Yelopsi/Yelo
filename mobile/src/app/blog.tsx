import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import api from '../services/api';

const { width } = Dimensions.get('window');

const DEFAULT_BLOG_IMAGE = 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80';

export default function BlogScreen() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [readingPost, setReadingPost] = useState<any | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/public/posts');
      if (Array.isArray(res.data)) {
        setPosts(res.data);
      }
    } catch (e) {
      console.warn('Erro ao carregar posts do blog:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Formatador de data
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recente';
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      return new Date(dateString).toLocaleDateString('pt-BR', options);
    } catch {
      return 'Recente';
    }
  };

  const handleLike = (postId: string | number) => {
    setLikedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  // Remove tags HTML do preview de texto
  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  };

  const destaque = posts.length > 0 ? posts[0] : null;
  const outrosPosts = posts.length > 1 ? posts.slice(1) : [];

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

            {loading ? (
              <View className="py-20 items-center justify-center">
                <ActivityIndicator size="large" color="#1B4332" />
                <Text className="font-sans text-[#666] mt-4">Carregando artigos...</Text>
              </View>
            ) : posts.length === 0 ? (
              <View className="py-16 px-6 items-center bg-[#f9fafb] rounded-[20px] border border-[#eee]">
                <Feather name="book-open" size={40} color="#1B4332" style={{ marginBottom: 12, opacity: 0.6 }} />
                <Text className="font-title text-[20px] text-[#1B4332] mb-2 text-center">Nenhum artigo publicado ainda</Text>
                <Text className="font-sans text-[14px] text-[#666] text-center mb-6">
                  Nossos profissionais estão escrevendo novos conteúdos para a plataforma. Volte em breve!
                </Text>
                <TouchableOpacity 
                  onPress={() => router.push('/questionario')}
                  className="bg-[#1B4332] px-6 py-3 rounded-full"
                >
                  <Text className="text-white font-sans font-bold text-[14px]">Encontrar Psicólogo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* POST DESTAQUE */}
                {destaque && (
                  <TouchableOpacity 
                    activeOpacity={0.9}
                    onPress={() => setReadingPost(destaque)}
                    className="bg-white rounded-[16px] overflow-hidden mb-12 shadow-[0_8px_25px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)]"
                  >
                    <View className="h-[230px] w-full bg-[#e5e7eb]">
                      <Image 
                        source={{ uri: destaque.imagem_url || DEFAULT_BLOG_IMAGE }} 
                        className="w-full h-full"
                        resizeMode="cover" 
                      />
                    </View>
                    <View className="p-6">
                      <View className="bg-[#FFEE8C] self-start px-[16px] py-[6px] rounded-[50px] mb-[15px]">
                        <Text className="font-sans font-extrabold text-[#1B4332] text-[12px] uppercase tracking-wider">Mais Recente</Text>
                      </View>
                      <Text className="font-title text-[26px] text-[#1B4332] leading-tight mb-3" numberOfLines={2}>
                        {destaque.titulo}
                      </Text>
                      <Text className="font-sans text-[15px] text-[#666] leading-relaxed mb-6" numberOfLines={3}>
                        {stripHtml(destaque.conteudo)}
                      </Text>
                      
                      <View className="flex-row items-center justify-between border-t border-[#eee] pt-4 mt-auto">
                        <TouchableOpacity 
                          onPress={() => destaque.autor?.slug && router.push(`/${destaque.autor.slug}`)}
                          className="flex-row items-center"
                        >
                          {destaque.autor?.fotoUrl ? (
                            <Image 
                              source={{ uri: destaque.autor.fotoUrl }} 
                              className="w-8 h-8 rounded-full mr-3 bg-[#e5e7eb]"
                            />
                          ) : (
                            <View className="w-8 h-8 rounded-full mr-3 bg-[#1B4332]/10 items-center justify-center">
                              <Text className="text-[#1B4332] font-bold text-[12px]">{destaque.autor?.nome?.[0] || 'P'}</Text>
                            </View>
                          )}
                          <Text className="font-sans font-semibold text-[14px] text-[#333]">
                            Psi. {destaque.autor?.nome?.split(' ')[0] || 'Especialista'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={() => handleLike(destaque.id)}
                          className="flex-row items-center gap-1.5 p-2 -mr-2 -my-2"
                        >
                          <Feather 
                            name="heart" 
                            size={18} 
                            color={likedPosts[destaque.id] ? "#e63946" : "#555"} 
                          />
                          <Text className="font-sans font-bold text-[14px] text-[#333]">
                            {(destaque.curtidas || 0) + (likedPosts[destaque.id] ? 1 : 0)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* LISTA DE OUTROS POSTS */}
                {outrosPosts.length > 0 && (
                  <View className="gap-8 mb-10">
                    {outrosPosts.map((post) => (
                      <TouchableOpacity 
                        key={post.id}
                        activeOpacity={0.9}
                        onPress={() => setReadingPost(post)}
                        className="bg-white rounded-[12px] overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.04)]"
                      >
                        <View className="h-[190px] w-full bg-[#e5e7eb]">
                          <Image 
                            source={{ uri: post.imagem_url || DEFAULT_BLOG_IMAGE }} 
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
                            {stripHtml(post.conteudo)}
                          </Text>
                          
                          <View className="flex-row items-center justify-between border-t border-[#eee] pt-4 mt-auto">
                            <TouchableOpacity 
                              onPress={() => post.autor?.slug && router.push(`/${post.autor.slug}`)}
                              className="flex-row items-center"
                            >
                              {post.autor?.fotoUrl ? (
                                <Image 
                                  source={{ uri: post.autor.fotoUrl }} 
                                  className="w-7 h-7 rounded-full mr-2 bg-[#e5e7eb]"
                                />
                              ) : (
                                <View className="w-7 h-7 rounded-full mr-2 bg-[#1B4332]/10 items-center justify-center">
                                  <Text className="text-[#1B4332] font-bold text-[11px]">{post.autor?.nome?.[0] || 'P'}</Text>
                                </View>
                              )}
                              <Text className="font-sans font-semibold text-[13px] text-[#555]">
                                Psi. {post.autor?.nome?.split(' ')[0] || 'Especialista'}
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              onPress={() => handleLike(post.id)}
                              className="flex-row items-center gap-1.5 p-2 -mr-2 -my-2"
                            >
                              <Feather 
                                name="heart" 
                                size={18} 
                                color={likedPosts[post.id] ? "#e63946" : "#555"} 
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
                )}
              </>
            )}

          </View>
          
          <Footer />
        </YeloScrollView>
        <PublicBottomNav />

        {/* MODAL DE LEITURA COMPLETA DO ARTIGO */}
        <Modal
          visible={!!readingPost}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setReadingPost(null)}
        >
          {readingPost && (
            <SafeAreaView className="flex-1 bg-white">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-[#eee]">
                <TouchableOpacity 
                  onPress={() => setReadingPost(null)}
                  className="px-3 py-1.5 bg-[#f3f4f6] rounded-full"
                >
                  <Text className="font-sans font-bold text-[#333] text-[13px]">Fechar</Text>
                </TouchableOpacity>
                <Text className="font-sans font-semibold text-[#888] text-[12px]">Artigo</Text>
                <TouchableOpacity 
                  onPress={() => handleLike(readingPost.id)}
                  className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-[#fef2f2]"
                >
                  <Feather 
                    name="heart" 
                    size={16} 
                    color={likedPosts[readingPost.id] ? "#e63946" : "#dc2626"} 
                  />
                  <Text className="font-sans font-bold text-[12px] text-[#dc2626]">
                    {(readingPost.curtidas || 0) + (likedPosts[readingPost.id] ? 1 : 0)}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
                {readingPost.imagem_url ? (
                  <View className="h-[220px] w-full rounded-[16px] overflow-hidden mb-6 bg-[#e5e7eb]">
                    <Image 
                      source={{ uri: readingPost.imagem_url }} 
                      className="w-full h-full"
                      resizeMode="cover" 
                    />
                  </View>
                ) : null}

                <Text className="font-title text-[28px] text-[#1B4332] leading-tight mb-4">
                  {readingPost.titulo}
                </Text>

                {readingPost.autor && (
                  <TouchableOpacity 
                    onPress={() => {
                      const slug = readingPost.autor.slug;
                      setReadingPost(null);
                      if (slug) router.push(`/${slug}`);
                    }}
                    className="flex-row items-center p-3 bg-[#f0fdf4] rounded-[14px] border border-[#bbf7d0] mb-6"
                  >
                    {readingPost.autor.fotoUrl ? (
                      <Image 
                        source={{ uri: readingPost.autor.fotoUrl }} 
                        className="w-10 h-10 rounded-full mr-3 bg-white"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-full mr-3 bg-[#1B4332] items-center justify-center">
                        <Text className="text-white font-bold">{readingPost.autor.nome?.[0]}</Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="font-sans font-bold text-[14px] text-[#1B4332]">
                        Psi. {readingPost.autor.nome}
                      </Text>
                      <Text className="font-sans text-[12px] text-[#166534]">
                        Toque para ver o perfil completo
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#166534" />
                  </TouchableOpacity>
                )}

                <Text className="font-sans text-[16px] text-[#374151] leading-7 pb-16">
                  {stripHtml(readingPost.conteudo)}
                </Text>
              </ScrollView>
            </SafeAreaView>
          )}
        </Modal>

      </SafeAreaView>
    </View>
  );
}
