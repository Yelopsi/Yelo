import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Modal,
  Animated,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getBaseUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePhotoUrl } from '../../utils/imageUrl';
import YeloScrollView from '../../components/YeloScrollView';
import YeloToast from '../../components/YeloToast';

// Máscaras de Formatação
const formatCPFOrCNPJ = (text: string) => {
  const digits = text.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
};

const isValidCPF = (cpf: string) => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 1; i <= 9; i++) sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.substring(9, 10), 10)) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.substring(10, 11), 10)) return false;
  return true;
};

const isValidCNPJ = (cnpj: string) => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;
  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;
  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;
  return true;
};

const isValidDocument = (doc: string) => {
  const clean = (doc || '').replace(/\D/g, '');
  if (clean.length === 11) return isValidCPF(clean);
  if (clean.length === 14) return isValidCNPJ(clean);
  return false;
};

const formatPhone = (text: string) => {
  const digits = text.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

const formatCEP = (text: string) => {
  return text
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
};

const formatCRP = (text: string) => {
  return text
    .replace(/[^0-9/]/g, '')
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .slice(0, 9);
};

const formatDate = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

// Constantes de Seleção de Especialidades (Idênticas à versão Web)
const TEMAS_OPCOES = [
  'Ansiedade', 'Estresse', 'Depressão', 'Relacionamentos', 'Carreira',
  'Autoestima', 'Luto', 'Traumas', 'TDAH', 'Autoconhecimento',
  'Trabalho', 'Tristeza', 'Sexualidade',
];

const PUBLICO_OPCOES = ['Crianças', 'Adolescentes', 'Adultos', 'Idosos', 'Casais'];

const PRATICAS_INCLUSIVAS_OPCOES = [
  'LGBTQIAPN+ Friendly 🏳️‍🌈',
  'Faz parte da comunidade LGBTQIAPN+ / Afirmativa',
  'Pessoa não-branca // Prática Antirracista',
  'Perspectiva Feminista',
  'Neurodiversidade (TDAH, Autismo)',
];

const GENEROS_OPCOES = ['Feminino', 'Masculino', 'Não-binário', 'Outro'];

const ABORDAGENS_OPCOES = [
  'Psicanálise',
  'Terapia Cognitivo-Comportamental (TCC)',
  'ACT - Terapia de Aceitação e Compromisso',
  'Análise do Comportamento',
  'Humanista',
  'Gestalt-terapia',
  'Sistêmica',
  'Jungiana',
  'Psicologia Histórico-Cultural',
];

const MODALIDADE_OPCOES = ['Online', 'Presencial'];
const DISPONIBILIDADE_OPCOES = ['Manhã', 'Tarde', 'Noite'];
const FORMACAO_OPCOES = [
  'Graduação',
  'Especialização / Pós-Graduação',
  'Mestrado',
  'Doutorado',
  'Pós-Doutorado',
];
const SESSAO_GRATIS_TEMPOS = ['15 minutos', '20 minutos', '30 minutos'];

export default function MeuPerfilScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizingBio, setIsOptimizingBio] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Modal Alterar Senha
  const [modalSenhaVisible, setModalSenhaVisible] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaNovaSenha, setConfirmaNovaSenha] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Modal Excluir Conta
  const [modalExcluirVisible, setModalExcluirVisible] = useState(false);
  const [senhaExcluir, setSenhaExcluir] = useState('');
  const [motivoExcluir, setMotivoExcluir] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Toast flutuante de feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados dos blocos sanfona e edição
  const [activeBlock, setActiveBlock] = useState<string | null>('personal');
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});

  // Bloco atualmente em edição (se houver)
  const activeEditingKey = useMemo(() => {
    return Object.keys(editMode).find((key) => !!editMode[key]) || null;
  }, [editMode]);

  const { user, updateUser } = useAuth();
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [statusPerfil, setStatusPerfil] = useState<string>('active');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [isExempt, setIsExempt] = useState<boolean>(false);
  const [googleReviewsData, setGoogleReviewsData] = useState<any>(null);
  const [isQualityCardExpanded, setIsQualityCardExpanded] = useState(false);

  // Estado completo do formulário
  const [form, setForm] = useState({
    nome: '',
    crp: '',
    email: '',
    telefone: '',
    cpf: '',
    razao_social: '',
    data_nascimento: '',
    cep: '',
    cidade: '',
    uf: '',
    rua: '',
    numero: '',
    bairro: '',
    complemento: '',
    slug: '',
    bio: '',
    ano_inicio: '',
    tipo_cobranca: 'sessao' as 'sessao' | 'mensal',
    valor_sessao: '',
    valor_mensal: '',
    free_session_active: false,
    free_session_time: '',
    formacao_nivel: '',
    formacao_desc: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    facebook: '',
    x_url: '',
    google_business_url: '',
    google_place_id: '',
    temas_atuacao: [] as string[],
    publico_alvo: [] as string[],
    praticas_inclusivas: [] as string[],
    genero_identidade: '',
    abordagens_tecnicas: '',
    modalidade: [] as string[],
    disponibilidade_periodo: [] as string[],
    profile_paused: false,
  });

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  // Carrega dados completos do perfil
  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/api/psychologists/me');
      const p = res.data;
      if (p) {
        setForm({
          nome: p.nome || '',
          crp: p.crp || '',
          email: p.email || '',
          telefone: p.telefone || '',
          cpf: p.cpf || p.cnpj || p.document_number || '',
          razao_social: p.razao_social || '',
          data_nascimento: p.data_nascimento ? formatDate(p.data_nascimento) : '',
          cep: p.cep || '',
          cidade: p.cidade || '',
          uf: p.estado || '',
          rua: p.rua || '',
          numero: p.numero || '',
          bairro: p.bairro || '',
          complemento: p.complemento || '',
          slug: p.slug || '',
          bio: p.bio || '',
          ano_inicio: p.ano_inicio_experiencia ? String(p.ano_inicio_experiencia) : '',
          tipo_cobranca: p.tipo_cobranca === 'mensal' ? 'mensal' : 'sessao',
          valor_sessao: p.valor_sessao_numero ? String(p.valor_sessao_numero) : '',
          valor_mensal: p.valor_mensal_numero ? String(p.valor_mensal_numero) : '',
          free_session_active: p.free_session_active === true,
          free_session_time: p.free_session_time || '',
          formacao_nivel: p.formacao_nivel || '',
          formacao_desc: p.formacao_desc || '',
          instagram: p.instagram_url ? p.instagram_url.replace('@', '').replace(/https?:\/\/(www\.)?instagram\.com\//, '') : '',
          linkedin: p.linkedin_url ? p.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '') : '',
          tiktok: p.tiktok_url ? p.tiktok_url.replace('@', '').replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, '') : '',
          facebook: p.facebook_url ? p.facebook_url.replace(/https?:\/\/(www\.)?facebook\.com\//, '') : '',
          x_url: p.x_url ? p.x_url.replace('@', '').replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, '') : '',
          google_business_url: p.google_business_url || '',
          google_place_id: p.google_place_id || '',
          temas_atuacao: Array.isArray(p.temas_atuacao) ? p.temas_atuacao : [],
          publico_alvo: Array.isArray(p.publico_alvo) ? p.publico_alvo : [],
          praticas_inclusivas: Array.isArray(p.praticas_inclusivas) ? p.praticas_inclusivas : [],
          genero_identidade: p.genero_identidade || '',
          abordagens_tecnicas: p.abordagens_tecnicas || '',
          modalidade: Array.isArray(p.modalidade) ? p.modalidade : [],
          disponibilidade_periodo: Array.isArray(p.disponibilidade_periodo) ? p.disponibilidade_periodo : [],
          profile_paused: p.profile_paused === true,
        });
        setFotoUrl(p.fotoUrl || null);
        setStatusPerfil(p.status || 'active');
        setPlanExpiresAt(p.planExpiresAt || null);
        setIsExempt(p.is_exempt === true || String(p.is_exempt).toLowerCase() === 'true' || p.is_exempt === 1);
        setGoogleReviewsData(p.google_reviews_data || null);

        // Sincroniza foto e nome com o Header e contexto global
        if (p.fotoUrl && p.fotoUrl !== user?.fotoUrl) {
          updateUser({ fotoUrl: p.fotoUrl, nome: p.nome });
        }
      }
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  // Cálculo da Qualidade do Perfil (0 - 100%)
  const qualityInsight = useMemo(() => {
    const checks = [
      { key: 'fotoUrl', label: 'Foto de Perfil', done: !!fotoUrl && !fotoUrl.includes('placehold.co') },
      { key: 'nome', label: 'Nome de Exibição', done: !!form.nome.trim() },
      { key: 'crp', label: 'Número do CRP', done: !!form.crp.trim() },
      { key: 'telefone', label: 'WhatsApp', done: !!form.telefone.trim() },
      { key: 'cpf', label: 'Documento (CPF/CNPJ)', done: isValidDocument(form.cpf) },
      { key: 'abordagens_tecnicas', label: 'Abordagens e Técnicas', done: !!form.abordagens_tecnicas },
      { key: 'temas_atuacao', label: 'Temas de Atuação', done: form.temas_atuacao.length > 0 },
      { key: 'publico_alvo', label: 'Público-Alvo', done: form.publico_alvo.length > 0 },
      { key: 'modalidade', label: 'Modalidade', done: form.modalidade.length > 0 },
      { key: 'disponibilidade_periodo', label: 'Disponibilidade', done: form.disponibilidade_periodo.length > 0 },
      { key: 'slug', label: 'Link Personalizado', done: !!form.slug.trim() },
      { key: 'bio', label: 'Biografia', done: form.bio.trim().length >= 10 },
      {
        key: 'valor',
        label: 'Valor do Atendimento',
        done: form.tipo_cobranca === 'sessao' ? !!form.valor_sessao : !!form.valor_mensal,
      },
      { key: 'ano_inicio', label: 'Ano de Início', done: !!form.ano_inicio.trim() },
      { key: 'formacao_nivel', label: 'Formação Acadêmica', done: !!form.formacao_nivel },
      { key: 'cep', label: 'Localização (CEP)', done: !!form.cep.trim() },
      { key: 'praticas_inclusivas', label: 'Identidade e Inclusão', done: form.praticas_inclusivas.length > 0 },
      { key: 'genero_identidade', label: 'Gênero', done: !!form.genero_identidade },
      {
        key: 'social',
        label: 'Redes Sociais',
        done: !!(form.instagram || form.linkedin || form.tiktok || form.facebook || form.x_url),
      },
    ];

    const doneCount = checks.filter((c) => c.done).length;
    const score = Math.round((doneCount / checks.length) * 100);

    return { score, checks };
  }, [fotoUrl, form]);

  // Balão de ROI do Modelo de Cobrança
  const roiText = useMemo(() => {
    const rawVal = form.tipo_cobranca === 'sessao' ? form.valor_sessao : form.valor_mensal;
    const cleanStr = rawVal.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const val = parseFloat(cleanStr);
    if (!val || val <= 0) return null;
    const sessions = Math.ceil(99 / val);
    const unidade = form.tipo_cobranca === 'sessao'
      ? (sessions === 1 ? 'sessão' : 'sessões')
      : (sessions === 1 ? 'mensalidade' : 'mensalidades');
    return `Com ${sessions} ${unidade} a Yelo se paga. O restante é seu lucro!`;
  }, [form.tipo_cobranca, form.valor_sessao, form.valor_mensal]);

  const toggleBlock = (block: string) => {
    setActiveBlock(activeBlock === block ? null : block);
  };

  const setEditing = (block: string, isEditing: boolean) => {
    setEditMode((prev) => ({ ...prev, [block]: isEditing }));
    if (isEditing) setActiveBlock(block);
  };

  const handleTextChange = (field: string, text: string, maskFn?: (val: string) => string) => {
    const formatted = maskFn ? maskFn(text) : text;
    setForm((prev) => ({ ...prev, [field]: formatted }));
  };

  // Busca de CEP Automática via ViaCEP
  const handleCepChange = async (text: string) => {
    const formatted = formatCEP(text);
    setForm((prev) => ({ ...prev, cep: formatted }));

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsSearchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) {
          Alert.alert('Aviso', 'CEP não encontrado.');
        } else {
          setForm((prev) => ({
            ...prev,
            cidade: data.localidade || prev.cidade,
            uf: data.uf || prev.uf,
            rua: data.logradouro || prev.rua,
            bairro: data.bairro || prev.bairro,
          }));
          showToast('Endereço preenchido via CEP! 📍');
        }
      } catch {
        // Fallback silencioso
      } finally {
        setIsSearchingCep(false);
      }
    }
  };

  // Upload de Foto de Perfil via ImagePicker
  const handlePickAndUploadPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploadingPhoto(true);

        const formData = new FormData();
        formData.append('profilePhoto', {
          uri: asset.uri,
          name: asset.fileName || 'profile_photo.jpg',
          type: asset.mimeType || 'image/jpeg',
        } as any);

        const res = await api.put('/api/psychologists/me/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data?.fotoUrl) {
          const novaFoto = res.data.fotoUrl;
          setFotoUrl(novaFoto);
          await updateUser({ fotoUrl: novaFoto });
          showToast('Foto de perfil atualizada com sucesso! 📷');
        }
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Não foi possível atualizar a foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Verifica se assinatura está ativa e dentro da validade (mesma regra da Web em psi_meu_perfil.js)
  const isAtivoEValido = useMemo(() => {
    const hoje = new Date();
    const validade = planExpiresAt ? new Date(planExpiresAt) : null;
    return statusPerfil === 'active' && (isExempt || !!(validade && validade > hoje));
  }, [statusPerfil, isExempt, planExpiresAt]);

  const isPublicProfileBlocked = statusPerfil === 'pending' || !isAtivoEValido || form.profile_paused;

  // Copiar link do perfil público
  const handleCopyProfileLink = async () => {
    if (isPublicProfileBlocked) {
      const msg =
        statusPerfil === 'pending'
          ? 'Complete seu perfil (incluindo CPF) para liberar sua URL pública.'
          : 'Seu perfil está inativo ou pausado. Reative sua assinatura para liberar sua página pública.';
      showToast(msg);
      return;
    }
    if (!form.slug) return;
    const url = `https://yelopsi.com.br/${form.slug}`;
    await Clipboard.setStringAsync(url);
    showToast('Link do perfil copiado com sucesso! 🔗');
  };

  // Abrir perfil público (bloqueado se assinatura expirada/inativa ou perfil pausado)
  const handleOpenPublicProfileHero = () => {
    if (isPublicProfileBlocked) {
      const msg =
        statusPerfil === 'pending'
          ? 'Complete seu perfil (incluindo CPF) para liberar sua URL pública.'
          : 'Seu perfil está inativo ou pausado. Reative sua assinatura para liberar sua página pública.';
      showToast(msg);
      return;
    }
    if (form.slug) router.push(`/${form.slug}` as any);
  };

  // Salvar bloco específico
  const handleSaveBlock = async (blockKey: string) => {
    try {
      setIsSaving(true);
      const payload: any = {};

      if (blockKey === 'personal') {
        const cleanDoc = (form.cpf || '').replace(/\D/g, '');
        if (cleanDoc.length > 0 && !isValidDocument(cleanDoc)) {
          Alert.alert('Documento Inválido', 'O CPF ou CNPJ informado é inválido. Por favor, confira os números digitados.');
          setIsSaving(false);
          return;
        }
        payload.nome = form.nome;
        payload.crp = form.crp;
        payload.email = form.email;
        payload.telefone = form.telefone;
        payload.cpf = cleanDoc;
        payload.razao_social = form.razao_social;
        payload.data_nascimento = form.data_nascimento;
      } else if (blockKey === 'location') {
        payload.cep = form.cep;
        payload.cidade = form.cidade;
        payload.estado = form.uf;
        payload.rua = form.rua;
        payload.numero = form.numero;
        payload.bairro = form.bairro;
        payload.complemento = form.complemento;
      } else if (blockKey === 'professional') {
        payload.slug = form.slug;
        payload.bio = form.bio;
        payload.tipo_cobranca = form.tipo_cobranca;
        if (form.ano_inicio) payload.ano_inicio_experiencia = parseInt(form.ano_inicio, 10);
        if (form.valor_sessao) {
          payload.valor_sessao_numero = parseFloat(form.valor_sessao.replace(',', '.'));
        }
        if (form.valor_mensal) {
          payload.valor_mensal_numero = parseFloat(form.valor_mensal.replace(',', '.'));
        }
        payload.free_session_active = form.free_session_active;
        payload.free_session_time = form.free_session_time;
      } else if (blockKey === 'academic') {
        payload.formacao_nivel = form.formacao_nivel;
        payload.formacao_desc = form.formacao_desc;
      } else if (blockKey === 'social') {
        payload.instagram_url = form.instagram;
        payload.linkedin_url = form.linkedin;
        payload.tiktok_url = form.tiktok;
        payload.facebook_url = form.facebook;
        payload.x_url = form.x_url;
      } else if (blockKey === 'specialties') {
        if (form.temas_atuacao.length > 4) {
          Alert.alert('Limite Excedido', 'Selecione no máximo 4 Temas de Atuação.');
          setIsSaving(false);
          return;
        }
        payload.temas_atuacao = form.temas_atuacao;
        payload.publico_alvo = form.publico_alvo;
        payload.praticas_inclusivas = form.praticas_inclusivas;
        payload.genero_identidade = form.genero_identidade;
        payload.abordagens_tecnicas = form.abordagens_tecnicas;
        payload.modalidade = form.modalidade;
        payload.disponibilidade_periodo = form.disponibilidade_periodo;
      } else if (blockKey === 'visibility') {
        payload.profile_paused = form.profile_paused;
      }

      await api.put('/api/psychologists/me', payload);
      if (blockKey === 'personal' && form.nome && form.nome !== user?.nome) {
        updateUser({ nome: form.nome });
      }
      showToast('Alterações salvas com sucesso! ✨');
      setEditing(blockKey, false);
      await fetchProfile();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  // Otimizar Bio com IA
  const handleOptimizeBio = async () => {
    if (!form.bio || form.bio.length < 20) {
      Alert.alert('Aviso', 'Escreva pelo menos um rascunho de 20 caracteres para otimizar com IA.');
      return;
    }
    try {
      setIsOptimizingBio(true);
      const res = await api.post('/api/psychologists/me/optimize-bio', { bio: form.bio });
      if (res.data?.optimizedBio) {
        setForm((prev) => ({ ...prev, bio: res.data.optimizedBio }));
        Alert.alert('Bio Otimizada ✨', 'Sua biografia foi refinada com foco em acolhimento e clareza. Não se esqueça de salvar!');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível otimizar a bio no momento.');
    } finally {
      setIsOptimizingBio(false);
    }
  };

  // Sincronizar Avaliações do Google Meu Negócio
  const handleSyncGoogleReviews = async () => {
    if (!form.google_business_url.trim()) {
      Alert.alert('Aviso', 'Por favor, insira o link do seu perfil no Google Maps ou Google Meu Negócio.');
      return;
    }
    try {
      setIsSyncingGoogle(true);
      const res = await api.post('/api/psychologists/me/sync-google-reviews', {
        google_business_url: form.google_business_url.trim(),
        google_place_id: form.google_place_id.trim() || undefined,
      });
      if (res.data?.success) {
        setGoogleReviewsData(res.data.google_reviews_data);
        Alert.alert('Sincronizado! ⭐', res.data.message || 'Avaliações do Google importadas com sucesso!');
        await fetchProfile();
      }
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível validar o link do Google Meu Negócio.');
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Desconectar Google Meu Negócio
  const handleDisconnectGoogle = async () => {
    Alert.alert('Desconectar Google', 'Deseja remover as avaliações vinculadas do Google do seu perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsSyncingGoogle(true);
            await api.post('/api/psychologists/me/sync-google-reviews', {
              google_business_url: '',
              google_place_id: '',
            });
            setForm((prev) => ({ ...prev, google_business_url: '', google_place_id: '' }));
            setGoogleReviewsData(null);
            showToast('Google Meu Negócio desconectado.');
          } catch {
            Alert.alert('Erro', 'Falha ao desconectar.');
          } finally {
            setIsSyncingGoogle(false);
          }
        },
      },
    ]);
  };

  // Alteração de Senha
  const handleChangePassword = async () => {
    if (!senhaAtual || !novaSenha) {
      Alert.alert('Aviso', 'Preencha a senha atual e a nova senha.');
      return;
    }
    if (novaSenha !== confirmaNovaSenha) {
      Alert.alert('Aviso', 'A nova senha e a confirmação não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      Alert.alert('Aviso', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await api.put('/api/psychologists/me/password', {
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
      });
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      setModalSenhaVisible(false);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaNovaSenha('');
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Falha ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Exclusão de Conta
  const handleDeleteAccount = async () => {
    if (!senhaExcluir) {
      Alert.alert('Aviso', 'Informe sua senha para confirmar a exclusão.');
      return;
    }
    Alert.alert(
      'Confirmação Final',
      'Esta ação é permanente e irrevogável. Todos os seus dados, histórico e perfil público serão excluídos. Tem certeza absoluta?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Sim, Excluir Definitivamente',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              await api.delete('/api/psychologists/me', {
                data: { senha: senhaExcluir, motivo: motivoExcluir },
              });
              Alert.alert('Conta Excluída', 'Sua conta foi removida da plataforma.');
              router.replace('/login');
            } catch (e: any) {
              Alert.alert('Erro', e.response?.data?.error || 'Não foi possível excluir a conta.');
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  // Helpers para Chips (Multiselect & Single-select)
  const toggleArrayItem = (field: 'temas_atuacao' | 'publico_alvo' | 'praticas_inclusivas' | 'modalidade' | 'disponibilidade_periodo', item: string, maxItems?: number) => {
    setForm((prev) => {
      const list = prev[field] || [];
      if (list.includes(item)) {
        return { ...prev, [field]: list.filter((i) => i !== item) };
      }
      if (maxItems && list.length >= maxItems) {
        Alert.alert('Limite Excedido', `Você pode selecionar no máximo ${maxItems} opções neste campo.`);
        return prev;
      }
      return { ...prev, [field]: [...list, item] };
    });
  };

  const renderChip = (
    label: string,
    isSelected: boolean,
    onPress: () => void,
    isEditable: boolean
  ) => (
    <TouchableOpacity
      key={label}
      disabled={!isEditable}
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chipBase,
        isSelected ? styles.chipSelected : styles.chipUnselected,
        !isEditable && styles.chipDisabled,
      ]}
    >
      {isSelected && <Text style={styles.chipCheck}>✓ </Text>}
      <Text
        style={[
          styles.chipText,
          isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderInput = (
    blockKey: string,
    field: string,
    label: string,
    placeholder: string,
    keyboardType: any = 'default',
    isPrefix = false,
    prefix = '',
    maskFn?: (val: string) => string,
    maxLength?: number,
    helperText?: string
  ) => {
    const isEditable = editMode[blockKey];
    const value = (form as any)[field] || '';

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        {helperText ? <Text style={styles.inputHelperText}>{helperText}</Text> : null}
        {isPrefix ? (
          <View
            style={[
              styles.prefixGroupContainer,
              isEditable ? styles.prefixEditable : styles.prefixDisabled,
            ]}
          >
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>{prefix}</Text>
            </View>
            <TextInput
              placeholder={placeholder}
              keyboardType={keyboardType}
              editable={isEditable}
              maxLength={maxLength}
              value={value}
              onChangeText={(t) => handleTextChange(field, t, maskFn)}
              style={[
                styles.prefixInput,
                isEditable ? styles.inputTextEditable : styles.inputTextDisabled,
              ]}
              placeholderTextColor="#94A3B8"
            />
          </View>
        ) : (
          <TextInput
            placeholder={placeholder}
            keyboardType={keyboardType}
            editable={isEditable}
            maxLength={maxLength}
            value={value}
            onChangeText={(t) => handleTextChange(field, t, maskFn)}
            style={[
              styles.inputBase,
              isEditable ? styles.inputEditable : styles.inputDisabled,
            ]}
            placeholderTextColor="#94A3B8"
          />
        )}
      </View>
    );
  };

  const renderBlockHeader = (blockKey: string, title: string, icon = 'chevron-down') => {
    const isEditing = editMode[blockKey];
    const isOpen = activeBlock === blockKey;

    return (
      <View style={styles.blockHeaderContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleBlock(blockKey)}
          style={styles.blockHeaderLeft}
        >
          <Text style={styles.blockHeaderTitle}>{title}</Text>
          <Feather
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#64748B"
          />
        </TouchableOpacity>

        {isEditing ? (
          <View style={styles.blockActionButtons}>
            <TouchableOpacity
              onPress={() => setEditing(blockKey, false)}
              disabled={isSaving}
              style={styles.btnCancelPill}
            >
              <Text style={styles.btnCancelPillText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSaveBlock(blockKey)}
              disabled={isSaving}
              style={styles.btnSavePill}
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.btnSavePillText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setEditing(blockKey, true)}
            style={styles.btnEditPill}
          >
            <Text style={styles.btnEditPillText}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Botão secundário de salvamento na parte inferior do bloco em edição (Estilo Web Mobile)
  const renderBlockFooter = (blockKey: string) => {
    const isEditing = !!editMode[blockKey];
    if (!isEditing) return null;

    return (
      <View style={styles.blockFooterActions}>
        <TouchableOpacity
          onPress={() => setEditing(blockKey, false)}
          disabled={isSaving}
          activeOpacity={0.7}
          style={styles.btnFooterCancel}
        >
          <Text style={styles.btnFooterCancelText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSaveBlock(blockKey)}
          disabled={isSaving}
          activeOpacity={0.85}
          style={styles.btnFooterSave}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="check" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnFooterSaveText}>Salvar alterações</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={styles.loadingScreenText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TOAST FLUTUANTE ESTILO WHATSAPP (DE BAIXO PRA CIMA) */}
      <YeloToast message={toastMessage} onDismiss={() => setToastMessage(null)} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <YeloScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1B4332']}
            />
          }
        >
          {/* NAVEGAÇÃO DE RETORNO */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Line x1="19" y1="12" x2="5" y2="12" stroke="#1B4332" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points="12 19 5 12 12 5" stroke="#1B4332" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>

          {/* BANNER DE AVISO QUANDO PERFIL BLOQUEADO / ASSINATURA EXPIRADA (Paridade com #profile-warning-banner-container da Web) */}
          {!isAtivoEValido && statusPerfil !== 'pending' && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/assinatura' as any)}
              style={{
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FECACA',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 20 }}>🔴</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#991B1B', marginBottom: 2 }}>
                  Perfil Público Bloqueado (Assinatura Inativa)
                </Text>
                <Text style={{ fontSize: 12.5, color: '#B91C1C', lineHeight: 17 }}>
                  Seu perfil está oculto nas buscas e sua URL pública está desativada. Toque aqui para reativar sua assinatura.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {statusPerfil === 'pending' && (
            <View
              style={{
                backgroundColor: '#FFFBEB',
                borderWidth: 1,
                borderColor: '#FDE68A',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#92400E', marginBottom: 2 }}>
                  Cadastro Pendente
                </Text>
                <Text style={{ fontSize: 12.5, color: '#B45309', lineHeight: 17 }}>
                  Complete seus dados obrigatórios (incluindo CPF/CNPJ) para liberar sua URL pública.
                </Text>
              </View>
            </View>
          )}

          {/* 1. HERO PROFILE MODERN */}
          <View style={styles.heroProfileCard}>
            <View style={styles.heroTopRow}>
              {/* Avatar com Badge de Foto */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickAndUploadPhoto}
                disabled={isUploadingPhoto}
                style={styles.avatarWrapper}
              >
                <Image
                  key={fotoUrl || 'empty'}
                  source={{ uri: resolvePhotoUrl(fotoUrl) }}
                  style={styles.avatarImage}
                />
                <View style={styles.avatarCameraBadge}>
                  {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 13 }}>📷</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Informações Resumidas */}
              <View style={styles.heroInfoColumn}>
                <Text style={styles.heroNameText}>{form.nome || 'Psicólogo(a)'}</Text>
                <Text style={styles.heroCrpText}>CRP {form.crp || 'Não informado'}</Text>

                <View
                  style={[
                    styles.heroStatusBadge,
                    !isAtivoEValido
                      ? styles.heroStatusInactive
                      : form.profile_paused || statusPerfil === 'pending'
                      ? styles.heroStatusPaused
                      : styles.heroStatusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.heroStatusBadgeText,
                      !isAtivoEValido
                        ? styles.heroStatusInactiveText
                        : form.profile_paused || statusPerfil === 'pending'
                        ? styles.heroStatusPausedText
                        : styles.heroStatusActiveText,
                    ]}
                  >
                    {!isAtivoEValido
                      ? '🔴 Perfil Inativo'
                      : statusPerfil === 'pending'
                      ? '🟡 Perfil Pendente'
                      : form.profile_paused
                      ? '⏸️ Perfil Pausado'
                      : '🟢 Perfil Ativo'}
                  </Text>
                </View>

                <Text style={styles.heroSlugLink}>
                  🔗 yelopsi.com.br/{form.slug || '...'}
                </Text>
              </View>
            </View>

            {/* Ações Rápidas do Topo */}
            <View style={styles.heroActionsRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleCopyProfileLink}
                style={[styles.btnSecondaryHero, isPublicProfileBlocked && { opacity: 0.5 }]}
              >
                <Text style={styles.btnSecondaryHeroText}>Copiar Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleOpenPublicProfileHero}
                style={[styles.btnPrimaryHero, isPublicProfileBlocked && { opacity: 0.5 }]}
              >
                <Text style={styles.btnPrimaryHeroText}>Ver Perfil Público</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. CARD DE PREENCHIMENTO DO PERFIL (COLAPSÁVEL) */}
          <View style={styles.qualityCard}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsQualityCardExpanded(!isQualityCardExpanded)}
              style={[
                styles.qualityHeader,
                !isQualityCardExpanded && { marginBottom: 0 }
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={styles.qualityTitle}>Preenchimento do Perfil</Text>
                <Feather
                  name={isQualityCardExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#64748B"
                />
              </View>
              <View style={styles.qualityScoreBadge}>
                <Text style={styles.qualityScoreText}>{qualityInsight.score}/100</Text>
              </View>
            </TouchableOpacity>

            {/* Barra de Progresso Compacta */}
            <View style={[styles.progressBarBg, !isQualityCardExpanded && { marginBottom: 0, marginTop: 10 }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${qualityInsight.score}%` },
                ]}
              />
            </View>

            {/* Checklist em Grid (quando expandido) */}
            {isQualityCardExpanded && (
              <View style={[styles.checklistGrid, { marginTop: 14 }]}>
                {qualityInsight.checks.map((item) => (
                  <View key={item.key} style={styles.checklistItem}>
                    <Text style={styles.checkIcon}>{item.done ? '✅' : '⏳'}</Text>
                    <Text
                      style={[
                        styles.checkLabel,
                        item.done ? styles.checkLabelDone : styles.checkLabelPending,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 3. SANFONAS DE CONFIGURAÇÃO */}
          <View style={styles.blocksContainer}>
            {/* BLOCO 1: DADOS PESSOAIS */}
            <View style={styles.blockCard}>
              {renderBlockHeader('personal', 'Dados Pessoais')}
              {activeBlock === 'personal' && (
                <View style={styles.blockBody}>
                  {renderInput('personal', 'nome', 'Nome de Exibição *', 'Seu nome como aparecerá no perfil', 'default', false, '', undefined, undefined, 'Como os pacientes verão seu nome no perfil.')}
                  {renderInput('personal', 'crp', 'Número do CRP *', '00/00000', 'default', false, '', formatCRP, 9, 'Apenas números e a região.')}
                  {renderInput('personal', 'email', 'E-mail de Acesso *', 'seu@email.com', 'email-address', false, '', undefined, undefined, 'Seu login na plataforma (não público).')}
                  {renderInput('personal', 'telefone', 'WhatsApp Profissional *', '(00) 00000-0000', 'phone-pad', false, '', formatPhone, 15, 'Onde você receberá as mensagens dos pacientes.')}
                  {renderInput('personal', 'cpf', 'CPF // CNPJ *', '000.000.000-00', 'numeric', false, '', formatCPFOrCNPJ, 18, 'Seu documento de identificação (sigiloso).')}

                  {form.cpf.replace(/\D/g, '').length > 11 && (
                    renderInput('personal', 'razao_social', 'Razão Social', 'Nome da empresa', 'default', false, '', undefined, undefined, 'Nome da sua empresa (para contas PJ).')
                  )}

                  {renderInput('personal', 'data_nascimento', 'Data de Nascimento', 'DD/MM/AAAA', 'numeric', false, '', formatDate, 10, 'Usada para exibir a sua idade no perfil público (Opcional).')}

                  {renderBlockFooter('personal')}
                </View>
              )}
            </View>

            {/* BLOCO 2: ESPECIALIDADES E ATUAÇÃO */}
            <View style={styles.blockCard}>
              {renderBlockHeader('specialties', 'Especialidades e Atuação')}
              {activeBlock === 'specialties' && (
                <View style={styles.blockBody}>
                  {/* Subgrupo 1: Temas de Atuação */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Temas de Atuação (Máx 4) *</Text>
                    <Text style={styles.inputHelperText}>Selecione até 4 temas principais onde você tem maior foco.</Text>
                    <View style={styles.chipsRow}>
                      {TEMAS_OPCOES.map((tema) =>
                        renderChip(
                          tema,
                          form.temas_atuacao.includes(tema),
                          () => toggleArrayItem('temas_atuacao', tema, 4),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {/* Subgrupo 2: Público-Alvo */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Público-Alvo Principal *</Text>
                    <Text style={styles.inputHelperText}>Selecione os públicos atendidos por você.</Text>
                    <View style={styles.chipsRow}>
                      {PUBLICO_OPCOES.map((pub) =>
                        renderChip(
                          pub,
                          form.publico_alvo.includes(pub),
                          () => toggleArrayItem('publico_alvo', pub),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {/* Subgrupo 3: Identidade e Inclusão */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Identidade e Inclusão *</Text>
                    <Text style={styles.inputHelperText}>Práticas inclusivas e afirmativas.</Text>
                    <View style={styles.chipsRow}>
                      {PRATICAS_INCLUSIVAS_OPCOES.map((prat) =>
                        renderChip(
                          prat,
                          form.praticas_inclusivas.includes(prat),
                          () => toggleArrayItem('praticas_inclusivas', prat),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {/* Subgrupo 4: Identidade de Gênero */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Identidade de Gênero *</Text>
                    <View style={styles.chipsRow}>
                      {GENEROS_OPCOES.map((gen) =>
                        renderChip(
                          gen,
                          form.genero_identidade === gen,
                          () => setForm((p) => ({ ...p, genero_identidade: gen })),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {/* Subgrupo 5: Abordagens e Técnicas */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Abordagens e Técnicas *</Text>
                    <View style={styles.chipsRow}>
                      {ABORDAGENS_OPCOES.map((ab) =>
                        renderChip(
                          ab,
                          form.abordagens_tecnicas === ab,
                          () => setForm((p) => ({ ...p, abordagens_tecnicas: ab })),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {/* Subgrupo 6: Modalidade */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Modalidade de Atendimento *</Text>
                    <View style={styles.chipsRow}>
                      {MODALIDADE_OPCOES.map((mod) =>
                        renderChip(
                          mod,
                          form.modalidade.includes(mod),
                          () => toggleArrayItem('modalidade', mod),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {/* Subgrupo 7: Disponibilidade */}
                  <View style={styles.specialtySection}>
                    <Text style={styles.specialtySectionTitle}>Turnos Disponíveis *</Text>
                    <View style={styles.chipsRow}>
                      {DISPONIBILIDADE_OPCOES.map((disp) =>
                        renderChip(
                          disp,
                          form.disponibilidade_periodo.includes(disp),
                          () => toggleArrayItem('disponibilidade_periodo', disp),
                          editMode['specialties']
                        )
                      )}
                    </View>
                  </View>

                  {renderBlockFooter('specialties')}
                </View>
              )}
            </View>

            {/* BLOCO 3: DETALHES PROFISSIONAIS */}
            <View style={styles.blockCard}>
              {renderBlockHeader('professional', 'Detalhes Profissionais')}
              {activeBlock === 'professional' && (
                <View style={styles.blockBody}>
                  {/* Link Personalizado */}
                  {renderInput('professional', 'slug', '🔗 Link do seu Perfil (Personalizável) *', 'seu-nome', 'default', true, 'yelopsi.com.br/', undefined, undefined, 'Você poderá enviar esse link aos seus pacientes.')}

                  {/* Biografia com IA */}
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={styles.inputLabel}>Biografia / Sobre Mim *</Text>
                      {editMode['professional'] && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={handleOptimizeBio}
                          disabled={isOptimizingBio}
                          style={styles.bioAiBtn}
                        >
                          {isOptimizingBio ? (
                            <ActivityIndicator size="small" color="#166534" />
                          ) : (
                            <Text style={styles.bioAiBtnText}>✨ Otimizar com IA</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.inputHelperText}>Apresente-se aos pacientes de forma acolhedora.</Text>

                    <TextInput
                      multiline
                      numberOfLines={6}
                      editable={editMode['professional']}
                      value={form.bio}
                      onChangeText={(t) => handleTextChange('bio', t)}
                      placeholder="Conte sobre sua trajetória, escuta e como apoia seus pacientes..."
                      style={[
                        styles.textareaBase,
                        editMode['professional'] ? styles.inputEditable : styles.inputDisabled,
                      ]}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Ano de Início */}
                  {renderInput('professional', 'ano_inicio', 'Ano de Início na Clínica', 'Ex: 2018', 'numeric', false, '', undefined, 4, 'Calcula seu tempo de experiência clínica.')}

                  {/* Modelo de Cobrança: Segmented Switch */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Modelo de Cobrança *</Text>
                    <Text style={styles.inputHelperText}>Como você prefere divulgar seu preço.</Text>

                    <View style={styles.segmentedControl}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={!editMode['professional']}
                        onPress={() => setForm((p) => ({ ...p, tipo_cobranca: 'sessao' }))}
                        style={[
                          styles.segmentBtn,
                          form.tipo_cobranca === 'sessao' && styles.segmentBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentBtnText,
                            form.tipo_cobranca === 'sessao' && styles.segmentBtnTextActive,
                          ]}
                        >
                          Valor por Sessão
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={!editMode['professional']}
                        onPress={() => setForm((p) => ({ ...p, tipo_cobranca: 'mensal' }))}
                        style={[
                          styles.segmentBtn,
                          form.tipo_cobranca === 'mensal' && styles.segmentBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentBtnText,
                            form.tipo_cobranca === 'mensal' && styles.segmentBtnTextActive,
                          ]}
                        >
                          Valor Mensal Fixo
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Valor Dinâmico */}
                  <View style={styles.inputGroup}>
                    {form.tipo_cobranca === 'sessao' ? (
                      renderInput('professional', 'valor_sessao', 'Valor da Sessão (R$)', '150', 'numeric', true, 'R$', undefined, undefined, 'Deixe vazio para "A combinar".')
                    ) : (
                      renderInput('professional', 'valor_mensal', 'Valor Mensal Fixo (R$)', '500', 'numeric', true, 'R$', undefined, undefined, 'Deixe vazio para "A combinar".')
                    )}

                    {/* Balão Dinâmico de ROI */}
                    {roiText && (
                      <View style={styles.roiBubble}>
                        <Text style={styles.roiBubbleText}>{roiText}</Text>
                      </View>
                    )}
                  </View>

                  {/* Sessão Grátis */}
                  <View style={styles.freeSessionBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: '#1B4332', marginRight: 10 }}>
                        Oferecer Primeira Sessão / Triagem Grátis
                      </Text>
                      <Switch
                        style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
                        disabled={!editMode['professional']}
                        value={form.free_session_active}
                        onValueChange={(val) => setForm((p) => ({ ...p, free_session_active: val }))}
                        trackColor={{ false: '#E2E8F0', true: '#52B788' }}
                        thumbColor={form.free_session_active ? '#1B4332' : '#F4F4F5'}
                      />
                    </View>
                    <Text style={styles.inputHelperText}>
                      Aumente suas chances de fechar pacientes oferecendo um momento inicial gratuito.
                    </Text>

                    {form.free_session_active && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.inputLabel}>Tempo da Sessão Grátis</Text>
                        <View style={styles.chipsRow}>
                          {SESSAO_GRATIS_TEMPOS.map((time) =>
                            renderChip(
                              time,
                              form.free_session_time === time,
                              () => setForm((p) => ({ ...p, free_session_time: time })),
                              editMode['professional']
                            )
                          )}
                        </View>
                      </View>
                    )}
                  </View>

                  {renderBlockFooter('professional')}
                </View>
              )}
            </View>

            {/* BLOCO 4: FORMAÇÃO ACADÊMICA */}
            <View style={styles.blockCard}>
              {renderBlockHeader('academic', 'Formação Acadêmica')}
              {activeBlock === 'academic' && (
                <View style={styles.blockBody}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nível de Formação Principal</Text>
                    <Text style={styles.inputHelperText}>Selecione sua titulação máxima.</Text>
                    <View style={styles.chipsRow}>
                      {FORMACAO_OPCOES.map((nivel) =>
                        renderChip(
                          nivel,
                          form.formacao_nivel === nivel,
                          () => setForm((p) => ({ ...p, formacao_nivel: nivel })),
                          editMode['academic']
                        )
                      )}
                    </View>
                  </View>

                  {renderInput('academic', 'formacao_desc', 'Detalhes da Formação', 'Ex: Graduação em Psicologia pela USP. Especialização em TCC pela PUC...', 'default', false, '', undefined, undefined, 'Instituições e outros detalhes acadêmicos.')}

                  {renderBlockFooter('academic')}
                </View>
              )}
            </View>

            {/* BLOCO 5: LOCALIZAÇÃO & NOTA FISCAL */}
            <View style={styles.blockCard}>
              {renderBlockHeader('location', 'Localização & Nota Fiscal')}
              {activeBlock === 'location' && (
                <View style={styles.blockBody}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CEP *</Text>
                    <Text style={styles.inputHelperText}>Para buscas locais dos pacientes.</Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        placeholder="00000-000"
                        keyboardType="numeric"
                        maxLength={9}
                        editable={editMode['location']}
                        value={form.cep}
                        onChangeText={handleCepChange}
                        style={[
                          styles.inputBase,
                          editMode['location'] ? styles.inputEditable : styles.inputDisabled,
                        ]}
                        placeholderTextColor="#94A3B8"
                      />
                      {isSearchingCep && (
                        <View style={{ position: 'absolute', right: 12, top: 14 }}>
                          <ActivityIndicator size="small" color="#1B4332" />
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 2 }}>
                      {renderInput('location', 'cidade', 'Cidade *', 'São Paulo', 'default', false, '', undefined, undefined, 'Preenchimento automático via CEP.')}
                    </View>
                    <View style={{ flex: 1 }}>
                      {renderInput('location', 'uf', 'UF *', 'SP', 'default', false, '', undefined, 2, 'Estado.')}
                    </View>
                  </View>

                  {/* Sub-bloco Nota Fiscal */}
                  <View style={styles.nfSubBox}>
                    <Text style={styles.nfTitle}>📄 Dados para Emissão de Nota Fiscal</Text>
                    <Text style={styles.nfDesc}>
                      Estes dados são exigidos pela Prefeitura para a emissão da Nota Fiscal (NFS-e) da assinatura Yelo. Eles são confidenciais e não ficam públicos.
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 2 }}>
                        {renderInput('location', 'rua', 'Logradouro (Rua/Av) *', 'Ex: Av. Paulista')}
                      </View>
                      <View style={{ flex: 1 }}>
                        {renderInput('location', 'numero', 'Número *', 'Ex: 1000')}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        {renderInput('location', 'bairro', 'Bairro *', 'Ex: Bela Vista')}
                      </View>
                      <View style={{ flex: 1 }}>
                        {renderInput('location', 'complemento', 'Complemento', 'Ex: Sala 42')}
                      </View>
                    </View>
                  </View>

                  {renderBlockFooter('location')}
                </View>
              )}
            </View>

            {/* BLOCO 6: REDES SOCIAIS */}
            <View style={styles.blockCard}>
              {renderBlockHeader('social', 'Redes Sociais')}
              {activeBlock === 'social' && (
                <View style={styles.blockBody}>
                  {renderInput('social', 'instagram', 'Instagram', 'usuario', 'default', true, '@', undefined, undefined, 'Seu arroba (@) ou perfil.')}
                  {renderInput('social', 'linkedin', 'LinkedIn', 'usuario', 'default', true, 'in/', undefined, undefined, 'Link do seu perfil.')}
                  {renderInput('social', 'tiktok', 'TikTok', 'usuario', 'default', true, '@', undefined, undefined, 'Seu arroba (@) ou perfil.')}
                  {renderInput('social', 'facebook', 'Facebook', 'usuario', 'default', true, '/', undefined, undefined, 'Página ou perfil.')}
                  {renderInput('social', 'x_url', 'X (Twitter)', 'usuario', 'default', true, '@', undefined, undefined, 'Seu arroba (@) ou perfil.')}

                  {renderBlockFooter('social')}
                </View>
              )}
            </View>

            {/* BLOCO 7: GOOGLE MEU NEGÓCIO & AVALIAÇÕES */}
            <View style={styles.blockCard}>
              {renderBlockHeader('google-reviews', 'Google Meu Negócio & Avaliações')}
              {activeBlock === 'google-reviews' && (
                <View style={styles.blockBody}>
                  <Text style={styles.googleIntroText}>
                    Conecte o seu perfil do <Text style={{ fontWeight: '700' }}>Google Meu Negócio</Text> para exibir avaliações e estrelas de pacientes verificados diretamente no seu perfil público na Yelo!
                  </Text>

                  {/* Guia Didático */}
                  <View style={styles.googleGuideBox}>
                    <Text style={styles.googleGuideTitle}>💡 Qual link colar aqui?</Text>
                    <Text style={styles.googleGuideDesc}>
                      <Text style={{ fontWeight: '700' }}>Opção 1:</Text> No painel da sua empresa no Google, clique em "Pedir avaliações" e copie o link curto (<Text style={{ fontFamily: 'monospace' }}>g.page/r/.../review</Text>).{'\n\n'}
                      <Text style={{ fontWeight: '700' }}>Opção 2:</Text> No Google Maps, busque seu consultório, clique em "Compartilhar" e copie o link (<Text style={{ fontFamily: 'monospace' }}>maps.app.goo.gl/...</Text>).
                    </Text>
                  </View>

                  {renderInput('google-reviews', 'google_business_url', 'Link do Google Meu Negócio ou Maps', 'https://g.page/r/... ou maps.app.goo.gl/...', 'url', true, '📍')}
                  {renderInput('google-reviews', 'google_place_id', 'Place ID (Opcional)', 'ChIJ...', 'default', true, 'ID')}

                  {/* Botões de Ação do Google */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleSyncGoogleReviews}
                      disabled={isSyncingGoogle}
                      style={styles.btnSyncGoogle}
                    >
                      {isSyncingGoogle ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.btnSyncGoogleText}>Sincronizar Avaliações ⭐</Text>
                      )}
                    </TouchableOpacity>

                    {googleReviewsData && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleDisconnectGoogle}
                        style={styles.btnDisconnectGoogle}
                      >
                        <Text style={styles.btnDisconnectGoogleText}>Desconectar</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Preview das Avaliações */}
                  {googleReviewsData && (
                    <View style={styles.googlePreviewCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 24, fontWeight: '700', color: '#1E293B' }}>
                          {googleReviewsData.rating || '5.0'}
                        </Text>
                        <Text style={{ color: '#F59E0B', fontSize: 16 }}>★★★★★</Text>
                        <Text style={{ color: '#64748B', fontSize: 13 }}>
                          ({googleReviewsData.user_ratings_total || 0} avaliações)
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#166534', marginTop: 4, fontWeight: '600' }}>
                        ✓ Avaliações verificadas e ativas no perfil público
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* BLOCO 8: VISIBILIDADE DO PERFIL */}
            <View style={styles.blockCard}>
              {renderBlockHeader('visibility', 'Visibilidade do Perfil')}
              {activeBlock === 'visibility' && (
                <View style={styles.blockBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>
                      Pausar meu perfil temporariamente
                    </Text>
                    <Switch
                      disabled={!editMode['visibility']}
                      value={form.profile_paused}
                      onValueChange={(val) => setForm((p) => ({ ...p, profile_paused: val }))}
                      trackColor={{ false: '#E2E8F0', true: '#F59E0B' }}
                      thumbColor={form.profile_paused ? '#D97706' : '#F4F4F5'}
                    />
                  </View>
                  <Text style={styles.inputHelperText}>
                    Ao ativar essa opção, você não aparecerá em novas buscas de pacientes e seu perfil público ficará inacessível. Utilize caso sua agenda esteja cheia ou esteja de férias.
                  </Text>

                  {renderBlockFooter('visibility')}
                </View>
              )}
            </View>

            {/* BLOCO 9: ALTERAR SENHA */}
            <View style={styles.blockCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setModalSenhaVisible(true)}
                style={styles.collapsibleActionHeader}
              >
                <Text style={styles.blockHeaderTitle}>Alterar Senha</Text>
                <Feather name="lock" size={18} color="#1B4332" />
              </TouchableOpacity>
            </View>

            {/* BLOCO 10: EXCLUIR CONTA */}
            <View style={[styles.blockCard, { borderColor: '#FECACA' }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setModalExcluirVisible(true)}
                style={styles.collapsibleActionHeader}
              >
                <Text style={[styles.blockHeaderTitle, { color: '#DC2626' }]}>Excluir Minha Conta</Text>
                <Feather name="trash-2" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        </YeloScrollView>
      </KeyboardAvoidingView>

      {/* MODAL ALTERAR SENHA */}
      <Modal
        visible={modalSenhaVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalSenhaVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setModalSenhaVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Alterar Senha</Text>
            <Text style={styles.modalSubtitle}>Digite sua senha atual e escolha uma nova senha.</Text>

            <TextInput
              placeholder="Senha Atual"
              secureTextEntry
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              style={styles.inputModal}
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              placeholder="Nova Senha (mínimo 6 dígitos)"
              secureTextEntry
              value={novaSenha}
              onChangeText={setNovaSenha}
              style={styles.inputModal}
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              placeholder="Confirmar Nova Senha"
              secureTextEntry
              value={confirmaNovaSenha}
              onChangeText={setConfirmaNovaSenha}
              style={styles.inputModal}
              placeholderTextColor="#94A3B8"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setModalSenhaVisible(false)}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                style={styles.modalBtnPrimary}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Salvar Senha</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL EXCLUIR CONTA */}
      <Modal
        visible={modalExcluirVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalExcluirVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setModalExcluirVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.modalTitle, { color: '#DC2626' }]}>Excluir Minha Conta</Text>
            <Text style={styles.modalSubtitle}>
              Esta ação é permanente e removerá todos os seus dados e perfil da plataforma.
            </Text>

            <TextInput
              placeholder="Digite sua senha para confirmar"
              secureTextEntry
              value={senhaExcluir}
              onChangeText={setSenhaExcluir}
              style={styles.inputModal}
              placeholderTextColor="#94A3B8"
            />

            <TextInput
              placeholder="Motivo da saída (opcional)"
              value={motivoExcluir}
              onChangeText={setMotivoExcluir}
              style={styles.inputModal}
              placeholderTextColor="#94A3B8"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setModalExcluirVisible(false)}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                style={[styles.modalBtnPrimary, { backgroundColor: '#DC2626' }]}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Confirmar Exclusão</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Botão Sticky de Salvamento Flutuante no Rodapé (Estilo Web Mobile #sticky-actions / .sticky-footer-actions) */}
      {activeEditingKey && (
        <View style={styles.stickyFooterActions}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleSaveBlock(activeEditingKey)}
            disabled={isSaving}
            style={styles.btnStickySave}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnStickySaveText}>Salvar alterações</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 130, // Evita sobreposição com a bottom nav bar
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingScreenText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Botão Voltar Topo
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B4332',
  },

  // 1. Hero Profile Modern
  heroProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    width: 86,
    height: 86,
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: '#1B4332',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B4332',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  heroInfoColumn: {
    flex: 1,
  },
  heroNameText: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 19,
    fontWeight: '800',
    color: '#1B4332',
    lineHeight: 24,
    marginBottom: 2,
  },
  heroCrpText: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 6,
  },
  heroStatusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 6,
  },
  heroStatusActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  heroStatusActiveText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  heroStatusPaused: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  heroStatusPausedText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  heroStatusInactive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  heroStatusInactiveText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '700',
  },
  heroStatusBadgeText: {
    textTransform: 'uppercase',
  },
  heroSlugLink: {
    fontSize: 12,
    color: '#475569',
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondaryHero: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryHeroText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  btnPrimaryHero: {
    flex: 1.2,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B4332',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  btnPrimaryHeroText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 2. Card de Qualidade do Perfil
  qualityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
    marginBottom: 20,
  },
  qualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  qualityTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1B4332',
  },
  qualityScoreBadge: {
    backgroundColor: '#1B4332',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  qualityScoreText: {
    color: '#FFEE8C',
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1B4332',
    borderRadius: 4,
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checklistItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkIcon: {
    fontSize: 12,
  },
  checkLabel: {
    fontSize: 12,
    flex: 1,
  },
  checkLabelDone: {
    color: '#166534',
    fontWeight: '600',
  },
  checkLabelPending: {
    color: '#94A3B8',
    fontWeight: '400',
  },

  // 3. Sanfona de Blocos
  blocksContainer: {
    gap: 14,
  },
  blockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  blockHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  blockHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockHeaderTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1B4332',
  },
  blockActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnCancelPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  btnCancelPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  btnSavePill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 50,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSavePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnEditPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnEditPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  collapsibleActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  blockBody: {
    padding: 18,
  },

  // Inputs
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  inputHelperText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  inputBase: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  inputEditable: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1B4332',
    color: '#1E293B',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    color: '#64748B',
  },
  textareaBase: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  prefixGroupContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  prefixEditable: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1B4332',
  },
  prefixDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  prefixBox: {
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefixText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  prefixInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  inputTextEditable: {
    color: '#1E293B',
  },
  inputTextDisabled: {
    color: '#64748B',
  },

  // Botão IA para biografia
  bioAiBtn: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 50,
  },
  bioAiBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },

  // Segmented Switch para Cobrança
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#1B4332',
    fontWeight: '700',
  },
  roiBubble: {
    backgroundColor: '#D8F3DC',
    borderWidth: 1,
    borderColor: '#B7E4C7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  roiBubbleText: {
    color: '#1B4332',
    fontSize: 12,
    fontWeight: '700',
  },

  // Sessão Grátis Box
  freeSessionBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },

  // Sub-bloco Nota Fiscal
  nfSubBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  nfTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  nfDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },

  // Google Meu Negócio
  googleIntroText: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  googleGuideBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  googleGuideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  googleGuideDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  btnSyncGoogle: {
    flex: 1,
    backgroundColor: '#1B4332',
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSyncGoogleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisconnectGoogle: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisconnectGoogleText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
  },
  googlePreviewCard: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },

  // Especialidades & Chips
  specialtySection: {
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specialtySectionTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 15,
    fontWeight: '800',
    color: '#1B4332',
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  chipUnselected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipDisabled: {
    opacity: 0.85,
  },
  chipCheck: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  chipText: {
    fontSize: 12.5,
  },
  chipTextSelected: {
    color: '#166534',
    fontWeight: '700',
  },
  chipTextUnselected: {
    color: '#475569',
    fontWeight: '500',
  },

  // Modais (Bottom Sheet)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 20,
    fontWeight: '800',
    color: '#1B4332',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  inputModal: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    color: '#1E293B',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalBtnPrimary: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 50,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Ações de Rodapé do Bloco (Dentro do Card)
  blockFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  btnFooterCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFooterCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  btnFooterSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 50,
    backgroundColor: '#1B4332',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnFooterSaveText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },

  // Botão Sticky Global Flutuante no Rodapé (Estilo Web Mobile #sticky-actions / .sticky-footer-actions)
  stickyFooterActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 104 : 96,
    right: 20,
    zIndex: 9999,
  },
  btnStickySave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B4332',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  btnStickySaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
