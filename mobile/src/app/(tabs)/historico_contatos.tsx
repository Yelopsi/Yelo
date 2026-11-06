import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Animated,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Line, Polyline } from 'react-native-svg';
import api from '../../services/api';
import YeloScrollView from '../../components/YeloScrollView';
import YeloToast from '../../components/YeloToast';

interface ContactLog {
  id: string | number;
  guestName?: string | null;
  feedbackGiven?: boolean;
  contactReceived?: boolean;
  dealClosed?: string | null;
  createdAt: string;
}

const ITEMS_PER_PAGE = 10;

export default function HistoricoContatosScreen() {
  const router = useRouter();

  // Estados principais
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // KPIs
  const [kpiCliques, setKpiCliques] = useState(0);
  const [kpiRecebidos, setKpiRecebidos] = useState(0);
  const [kpiFechados, setKpiFechados] = useState(0);
  const [kpiConversao, setKpiConversao] = useState('0%');

  // Modal de Atualização de Status
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ContactLog | null>(null);
  const [showReasonStep, setShowReasonStep] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Toast flutuante de feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  // Recalcula KPIs a partir dos logs
  const calculateKPIs = (data: ContactLog[]) => {
    const totalCliques = data.length;
    let mensagensRecebidas = 0;
    let negociosFechados = 0;

    data.forEach((log) => {
      if (log.contactReceived === true) mensagensRecebidas++;
      if (log.dealClosed === 'yes' || log.dealClosed === 'started') {
        negociosFechados++;
      }
    });

    setKpiCliques(totalCliques);
    setKpiRecebidos(mensagensRecebidas);
    setKpiFechados(negociosFechados);

    const taxa = mensagensRecebidas > 0 ? Math.round((negociosFechados / mensagensRecebidas) * 100) : 0;
    setKpiConversao(`${taxa}%`);
  };

  // Busca dados da API
  const fetchContactHistory = useCallback(async () => {
    try {
      const response = await api.get('/api/psychologists/me/contact-history');
      if (Array.isArray(response.data)) {
        setLogs(response.data);
        calculateKPIs(response.data);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de contatos:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchContactHistory();
  }, [fetchContactHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContactHistory();
  }, [fetchContactHistory]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = logs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Formatação de data/hora
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const hora = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano}, ${hora}:${min}`;
    } catch {
      return dateStr;
    }
  };

  // Exibição de Tooltip explicativo dos KPIs
  const showKpiTooltip = (title: string, desc: string) => {
    Alert.alert(title, desc);
  };

  // Abre Modal de Status para o item clicado
  const handleOpenStatusModal = (log: ContactLog) => {
    setSelectedLog(log);
    setShowReasonStep(false);
    setModalVisible(true);
  };

  // Envia atualização de status para o backend
  const handleUpdateStatus = async (contact_received: boolean, deal_closed: string) => {
    if (!selectedLog) return;
    setIsUpdatingStatus(true);
    try {
      const res = await api.post('/api/psychologists/me/whatsapp-feedback', {
        clickLogId: selectedLog.id,
        contact_received,
        deal_closed,
      });

      if (res.status === 200 || res.data?.message) {
        setModalVisible(false);
        showToast('Status atualizado com sucesso! ✨');
        await fetchContactHistory();
      } else {
        Alert.alert('Erro', 'Não foi possível atualizar o status. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro ao atualizar status do WhatsApp:', err);
      Alert.alert('Erro', err.response?.data?.error || 'Erro de conexão.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Determina propriedades visuais do badge para cada log
  const getBadgeProps = (log: ContactLog) => {
    let badgeStyle = styles.badgePendente;
    let textStyle = styles.badgeTextPendente;
    let badgeText = 'Pendente de Feedback';
    let isClickable = false;

    if (log.feedbackGiven) {
      if (log.dealClosed === 'yes' || log.dealClosed === 'started') {
        badgeStyle = styles.badgeFechado;
        textStyle = styles.badgeTextFechado;
        badgeText = '✅ Fechou Negócio';
        isClickable = false; // Proteção: fechamentos são consolidados
      } else if (log.dealClosed === 'talking') {
        badgeStyle = styles.badgePendente;
        textStyle = styles.badgeTextPendente;
        badgeText = '⏳ Em negociação';
        isClickable = true;
      } else if (
        log.dealClosed === 'not_started' ||
        log.dealClosed === 'ghosted' ||
        log.dealClosed === 'no' ||
        (log.dealClosed && log.dealClosed.startsWith('not_started_'))
      ) {
        badgeStyle = styles.badgeNaoFechado;
        textStyle = styles.badgeTextNaoFechado;
        badgeText = '❌ Não Fechou';
        isClickable = true;
      } else if (
        !log.contactReceived ||
        log.dealClosed === 'no_contact' ||
        log.dealClosed === 'wpp_issue' ||
        log.dealClosed === 'unknown'
      ) {
        badgeStyle = styles.badgeFantasma;
        textStyle = styles.badgeTextFantasma;
        badgeText = '👻 Paciente Fantasma';
        isClickable = true;
      } else {
        badgeStyle = styles.badgePendente;
        textStyle = styles.badgeTextPendente;
        badgeText = 'Feedback Registrado';
        isClickable = false;
      }
    }

    return { badgeStyle, textStyle, badgeText, isClickable };
  };

  return (
    <View style={styles.container}>
      {/* TOAST FLUTUANTE ESTILO WHATSAPP (DE BAIXO PRA CIMA) */}
      <YeloToast message={toastMessage} onDismiss={() => setToastMessage(null)} />

      <YeloScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
        }
      >
        {/* NAVEGAÇÃO DE RETORNO (back-btn) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Line x1="19" y1="12" x2="5" y2="12" stroke="#1B4332" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline points="12 19 5 12 12 5" stroke="#1B4332" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.backBtnText}>Voltar para Evolução</Text>
        </TouchableOpacity>

        {/* HEADER PRINCIPAL (main-header) */}
        <View style={styles.mainHeader}>
          <Text style={styles.mainHeaderTitle}>Histórico de Contatos</Text>
          <Text style={styles.mainHeaderSubtitle}>
            Acompanhe todos os cliques no seu WhatsApp e os respectivos retornos reportados por você.
          </Text>
        </View>

        {/* GRID DE KPIS (kpi-grid) */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Cliques Totais */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpiCliques}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                showKpiTooltip(
                  'Cliques Totais',
                  'Total de pessoas que clicaram no seu perfil para falar com você no WhatsApp.'
                )
              }
              style={styles.kpiLabelRow}
            >
              <Text style={styles.kpiLabel}>Cliques Totais</Text>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#94A3B8" strokeWidth={2} />
                <Path d="M12 16v-4" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
                <Path d="M12 8h.01" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Card 2: Mensagens Reais */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpiRecebidos}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                showKpiTooltip(
                  'Mensagens Reais',
                  "De todos os cliques, quantos de fato chegaram a te mandar um 'Oi' no WhatsApp."
                )
              }
              style={styles.kpiLabelRow}
            >
              <Text style={styles.kpiLabel}>Mensagens Reais</Text>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#94A3B8" strokeWidth={2} />
                <Path d="M12 16v-4" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
                <Path d="M12 8h.01" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Card 3: Negócios Fechados */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpiFechados}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                showKpiTooltip(
                  'Negócios Fechados',
                  'Total de pacientes que agendaram e iniciaram sessões com você.'
                )
              }
              style={styles.kpiLabelRow}
            >
              <Text style={styles.kpiLabel}>Negócios Fechados</Text>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#94A3B8" strokeWidth={2} />
                <Path d="M12 16v-4" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
                <Path d="M12 8h.01" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Card 4: Taxa de Fechamento */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpiConversao}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                showKpiTooltip(
                  'Taxa de Fechamento',
                  'Dentre as pessoas que te mandaram mensagem, qual porcentagem virou paciente (Fechados / Mensagens Reais).'
                )
              }
              style={styles.kpiLabelRow}
            >
              <Text style={styles.kpiLabel}>Taxa Fechamento</Text>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#94A3B8" strokeWidth={2} />
                <Path d="M12 16v-4" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
                <Path d="M12 8h.01" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {/* LISTA / CARDS DO HISTÓRICO (mobile table view) */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1B4332" />
            <Text style={styles.loadingText}>Carregando histórico...</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateIcon}>📭</Text>
            <Text style={styles.emptyStateTitle}>Nenhum clique registrado ainda</Text>
            <Text style={styles.emptyStateDesc}>
              Os pacientes que clicarem no seu WhatsApp aparecerão aqui.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {paginatedLogs.map((log) => {
              const { badgeStyle, textStyle, badgeText, isClickable } = getBadgeProps(log);
              return (
                <View key={log.id} style={styles.historyCard}>
                  {/* Linha 1: Data */}
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Data</Text>
                    <Text style={styles.cardValueDate}>{formatDateTime(log.createdAt)}</Text>
                  </View>

                  {/* Linha 2: Paciente / Contato */}
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Paciente / Contato</Text>
                    <Text style={styles.cardValuePatient}>
                      {log.guestName || 'Um paciente'}
                    </Text>
                  </View>

                  {/* Linha 3: Status do Retorno */}
                  <View style={[styles.cardRow, styles.cardRowLast]}>
                    <Text style={styles.cardLabel}>Status do Retorno</Text>
                    {isClickable ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleOpenStatusModal(log)}
                        style={[styles.badgeBase, badgeStyle, styles.badgeClickable]}
                      >
                        <Text style={[styles.badgeTextBase, textStyle]}>
                          {badgeText} <Text style={styles.badgeChevron}>▾</Text>
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.badgeBase, badgeStyle]}>
                        <Text style={[styles.badgeTextBase, textStyle]}>{badgeText}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* CONTROLES DE PAGINAÇÃO (pagination-controls) */}
            {totalPages > 1 && (
              <View style={styles.paginationControls}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={currentPage <= 1}
                  onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  style={[
                    styles.paginationBtn,
                    currentPage <= 1 && styles.paginationBtnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.paginationBtnText,
                      currentPage <= 1 && styles.paginationBtnTextDisabled,
                    ]}
                  >
                    ← Anterior
                  </Text>
                </TouchableOpacity>

                <Text style={styles.paginationInfo}>
                  Página {currentPage} de {totalPages}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={currentPage >= totalPages}
                  onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  style={[
                    styles.paginationBtn,
                    currentPage >= totalPages && styles.paginationBtnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.paginationBtnText,
                      currentPage >= totalPages && styles.paginationBtnTextDisabled,
                    ]}
                  >
                    Próxima →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </YeloScrollView>

      {/* MODAL BOTTOM SHEET DE ATUALIZAÇÃO DE STATUS */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            {/* Sheet Drag Handle */}
            <View style={styles.sheetHandle} />

            {/* Botão Fechar X */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Atualizar Status</Text>
            <Text style={styles.modalSubtitle}>
              Selecione o novo status para este contato.
            </Text>

            {isUpdatingStatus ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1B4332" />
                <Text style={{ marginTop: 8, color: '#64748B', fontSize: 13 }}>
                  Atualizando status...
                </Text>
              </View>
            ) : selectedLog ? (
              <View style={styles.modalOptionsContainer}>
                {/* 1. Cenário: Paciente Fantasma */}
                {(!selectedLog.contactReceived ||
                  selectedLog.dealClosed === 'no_contact' ||
                  selectedLog.dealClosed === 'wpp_issue' ||
                  selectedLog.dealClosed === 'unknown') && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handleUpdateStatus(true, 'talking')}
                    style={styles.modalOptionBtn}
                  >
                    <Text style={styles.modalOptionBtnText}>💬 Retornou o contato!</Text>
                  </TouchableOpacity>
                )}

                {/* 2. Cenário: Não Fechou */}
                {(selectedLog.dealClosed === 'not_started' ||
                  selectedLog.dealClosed === 'ghosted' ||
                  selectedLog.dealClosed === 'no' ||
                  (selectedLog.dealClosed && selectedLog.dealClosed.startsWith('not_started_'))) && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handleUpdateStatus(true, 'started')}
                    style={styles.modalOptionBtn}
                  >
                    <Text style={styles.modalOptionBtnText}>
                      ✅ Mudou de Ideia e Fechou!
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 3. Cenário: Em negociação (talking) */}
                {selectedLog.dealClosed === 'talking' && (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => handleUpdateStatus(true, 'started')}
                      style={styles.modalOptionBtn}
                    >
                      <Text style={styles.modalOptionBtnText}>✅ Fechamos Negócio!</Text>
                    </TouchableOpacity>

                    {!showReasonStep ? (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setShowReasonStep(true)}
                        style={styles.modalOptionBtn}
                      >
                        <Text style={styles.modalOptionBtnText}>❌ Paciente Desistiu</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.stepReasonBox}>
                        <Text style={styles.stepReasonTitle}>Qual o motivo?</Text>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleUpdateStatus(true, 'not_started_price')}
                          style={styles.modalOptionBtn}
                        >
                          <Text style={styles.modalOptionBtnText}>💰 Preço incompatível</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleUpdateStatus(true, 'not_started_schedule')}
                          style={styles.modalOptionBtn}
                        >
                          <Text style={styles.modalOptionBtnText}>⏰ Horário incompatível</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleUpdateStatus(true, 'not_started_other')}
                          style={styles.modalOptionBtn}
                        >
                          <Text style={styles.modalOptionBtnText}>🤷‍♂️ Outro motivo</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: 130, // Evita sobreposição com a barra de navegação inferior flutuante
  },

  // Botão Voltar (back-btn)
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

  // Header Principal (main-header)
  mainHeader: {
    backgroundColor: '#1B4332',
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
    shadowColor: '#1B4332',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mainHeaderTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 6,
  },
  mainHeaderSubtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    color: 'rgba(255, 255, 255, 0.85)',
  },

  // Grid de KPIs (kpi-grid)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  kpiValue: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 28,
    fontWeight: '700',
    color: '#1B4332',
    marginBottom: 4,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiLabel: {
    color: '#666666',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Loading & Empty States
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  emptyStateContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyStateIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Cards de Histórico (Mobile view da tabela)
  historyList: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  cardValueDate: {
    fontSize: 13.5,
    color: '#334155',
    textAlign: 'right',
  },
  cardValuePatient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },

  // Badges de Status
  badgeBase: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 20,
    alignSelf: 'flex-end',
  },
  badgeTextBase: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeClickable: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.2)',
  },
  badgeChevron: {
    opacity: 0.7,
    fontWeight: '900',
  },

  // Cores de cada status
  badgeFechado: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextFechado: {
    color: '#166534',
  },
  badgePendente: {
    backgroundColor: '#FFF3CD',
  },
  badgeTextPendente: {
    color: '#856404',
  },
  badgeNaoFechado: {
    backgroundColor: '#FEE2E2',
  },
  badgeTextNaoFechado: {
    color: '#991B1B',
  },
  badgeFantasma: {
    backgroundColor: '#F1F5F9',
  },
  badgeTextFantasma: {
    color: '#475569',
  },

  // Paginação
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FCFCFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  paginationBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  paginationBtnDisabled: {
    opacity: 0.45,
  },
  paginationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  paginationBtnTextDisabled: {
    color: '#94A3B8',
  },
  paginationInfo: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },

  // Modal Bottom Sheet
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
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
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
    marginBottom: 20,
  },
  modalOptionsContainer: {
    gap: 10,
  },
  modalOptionBtn: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  stepReasonBox: {
    gap: 10,
    marginTop: 6,
  },
  stepReasonTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#444444',
    textAlign: 'center',
    marginBottom: 4,
  },
});

