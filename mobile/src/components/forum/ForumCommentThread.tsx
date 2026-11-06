import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  AuthorBadges,
  BubbleIcon,
  EditIcon,
  FlagIcon,
  ForumAvatar,
  HeartIcon,
  MentionText,
  PinIcon,
  ThreadCollapseIcon,
  ThreadExpandIcon,
  TrashIcon,
  forumTimeAgo,
} from './forumUi';

/**
 * Árvore de comentários do Fórum (app) — réplica fiel de renderComment /
 * showReplyForm de public/psi/psi_forum.js e das regras mobile de
 * public/css/forum-community.css (estilo "flat Reddit" com threadline + elbow).
 */

export interface ForumComment {
  id: number;
  content: string;
  createdAt: string;
  isAnonymous?: boolean;
  isPinned?: boolean;
  authorName?: string;
  authorPhoto?: string | null;
  authorBadges?: any;
  authorSlug?: string | null;
  likes?: number;
  likedByMe?: boolean;
  isMine?: boolean;
  parentId?: number | null;
  replies?: ForumComment[];
  totalRepliesCount?: number;
}

export interface ThreadContextValue {
  isAdmin: boolean;
  closed: boolean;
  userPhoto?: string | null;
  expanded: Record<number, boolean>;
  activeReplyId: number | null;
  replyPrefill: { id: number; text: string; nonce: number } | null;
  aiLoadingId: number | null;
  setExpanded: (id: number, value: boolean) => void;
  onToggleReply: (comment: ForumComment) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: number, text: string) => Promise<boolean>;
  onLike: (id: number) => void;
  onDelete: (id: number) => void;
  onReport: (comment: ForumComment) => void;
  onPin: (comment: ForumComment) => void;
  onEdit: (id: number, text: string) => Promise<boolean>;
  onAi: (comment: ForumComment) => void;
  ensureVisible: (ref: React.RefObject<any>) => void;
  setActiveReplyRef?: (ref: React.RefObject<any> | null) => void;
}

export const ThreadContext = createContext<ThreadContextValue | null>(null);

const useThread = () => {
  const ctx = useContext(ThreadContext);
  if (!ctx) throw new Error('ThreadContext ausente');
  return ctx;
};

const countAll = (list?: ForumComment[]): number =>
  (list || []).reduce((acc, c) => acc + 1 + (c.totalRepliesCount ?? countAll(c.replies)), 0);

const REPLY_BATCH_SIZE = 3;
const READ_MORE_LINES = 4;

// ---------------------------------------------------------------------------
// Corpo do comentário com "Ler mais" (yt-read-more)
// ---------------------------------------------------------------------------

function CommentBody({ text }: { text: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const decided = useRef(false);

  return (
    <View>
      <MentionText
        text={text}
        style={styles.bodyText}
        numberOfLines={collapsed ? READ_MORE_LINES : undefined}
        onTextLayout={(e) => {
          if (decided.current) return;
          decided.current = true;
          if (e.nativeEvent.lines.length > READ_MORE_LINES) setCollapsed(true);
        }}
      />
      {collapsed && (
        <TouchableOpacity onPress={() => setCollapsed(false)} activeOpacity={0.7} style={styles.readMoreBtn}>
          <Text style={styles.readMoreText}>Ler mais</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formulário inline de resposta em formato de PÍLULA SIMPLES (Instagram-style)
// Abre exatamente abaixo do comentário clicado e rola suavemente acima do teclado.
// ---------------------------------------------------------------------------

function InlineReplyPill({
  placeholder,
  initialText,
  prefillKey,
  isEdit,
  onCancel,
  onSubmit,
  containerStyle,
  ensureVisible,
  setActiveReplyRef,
  userPhoto,
}: {
  placeholder: string;
  initialText: string;
  prefillKey: number;
  isEdit?: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<boolean>;
  containerStyle?: any;
  ensureVisible: (ref: React.RefObject<any>) => void;
  setActiveReplyRef?: (ref: React.RefObject<any> | null) => void;
  userPhoto?: string | null;
}) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<any>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    setActiveReplyRef?.(wrapRef);
    const tFocus = setTimeout(() => inputRef.current?.focus(), 80);
    // Chamadas escalonadas garantem scroll perfeito durante e após abertura do teclado no iOS/Android
    const tScroll1 = setTimeout(() => ensureVisible(wrapRef), 220);
    const tScroll2 = setTimeout(() => ensureVisible(wrapRef), 480);
    const tScroll3 = setTimeout(() => ensureVisible(wrapRef), 700);

    return () => {
      clearTimeout(tFocus);
      clearTimeout(tScroll1);
      clearTimeout(tScroll2);
      clearTimeout(tScroll3);
      setActiveReplyRef?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setText(initialText);
    const t = setTimeout(() => ensureVisible(wrapRef), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const handleSubmit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit(text.trim());
    if (!ok) setBusy(false);
  };

  const hasContent = text.trim().length > 0;

  return (
    <View ref={wrapRef} collapsable={false} style={[styles.replyPillWrap, containerStyle]}>
      <View style={styles.replyPillContainer}>
        {userPhoto ? (
          <ForumAvatar uri={userPhoto} size={22} />
        ) : (
          <View style={styles.replyPillIconCircle}>
            <Feather name={isEdit ? 'edit-2' : 'corner-down-right'} size={12} color="#1B4332" />
          </View>
        )}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          style={styles.replyPillInput}
          multiline
          maxLength={1000}
          onFocus={() => {
            setTimeout(() => ensureVisible(wrapRef), 150);
            setTimeout(() => ensureVisible(wrapRef), 400);
          }}
          textAlignVertical="center"
        />
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.replyPillCancelBtn}
          activeOpacity={0.65}
        >
          <Feather name="x" size={16} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={busy || !hasContent}
          activeOpacity={0.8}
          style={[styles.replyPillSendBtn, (!hasContent || busy) && styles.replyPillSendBtnDisabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name={isEdit ? 'check' : 'arrow-up'} size={14} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Botão ⊕ / ⊖ de respostas
// ---------------------------------------------------------------------------

function ThreadToggle({
  label,
  collapse,
  elbow,
  onPress,
  style,
}: {
  label: string;
  collapse?: boolean;
  elbow?: boolean;
  onPress: () => void;
  style?: any;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={[styles.toggleBtn, style]}>
      {elbow && <View pointerEvents="none" style={styles.toggleElbow} />}
      {collapse ? <ThreadCollapseIcon size={16} color="#64748B" /> : <ThreadExpandIcon size={16} color="#64748B" />}
      <Text style={styles.toggleText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Pílula de ação (comment-action-pill)
// ---------------------------------------------------------------------------

function ActionPill({
  onPress,
  children,
  compact,
  disabled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[styles.pill, compact && styles.pillCompact, disabled && { opacity: 0.45 }]}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
    >
      {children}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Nó recursivo de comentário
// ---------------------------------------------------------------------------

export const CommentNode = React.memo(function CommentNode({ comment, depth }: { comment: ForumComment; depth: number }) {
  const ctx = useThread();
  const [shown, setShown] = useState(REPLY_BATCH_SIZE);
  const [editing, setEditing] = useState(false);

  const isRoot = depth === 0;
  const avatarSize = isRoot ? 36 : 28;
  const replies = comment.replies || [];
  const hasReplies = replies.length > 0;
  const total = comment.totalRepliesCount ?? countAll(replies);
  const isExpanded = !!ctx.expanded[comment.id];
  const isReplying = ctx.activeReplyId === comment.id;
  const authorName = comment.isAnonymous ? 'Anônimo' : comment.authorName || 'Colega';
  const liked = !!comment.likedByMe;
  const padTop = comment.isPinned ? 8 : isRoot ? 6 : 4;
  const prefill = ctx.replyPrefill && ctx.replyPrefill.id === comment.id ? ctx.replyPrefill : null;

  const handleReplyPress = () => {
    if (ctx.closed) {
      Alert.alert('Discussão encerrada', 'Esta discussão está encerrada para novas respostas.');
      return;
    }
    ctx.onToggleReply(comment);
  };

  return (
    <View
      style={[
        styles.card,
        isRoot ? styles.rootCard : styles.replyCard,
        comment.isPinned && styles.pinnedCard,
      ]}
    >
      {/* Galho em curva (elbow) que conecta a linha do pai ao avatar do filho */}
      {!isRoot && <View pointerEvents="none" style={styles.elbow} />}

      {/* Threadline-strip (clicável para recolher a conversa) */}
      {isExpanded && hasReplies && (
        <Pressable
          onPress={() => ctx.setExpanded(comment.id, false)}
          style={[styles.threadStrip, { top: padTop + avatarSize + 2, left: comment.isPinned ? 10 : 0 }]}
        >
          <View style={styles.threadLine} />
        </Pressable>
      )}

      {comment.isPinned && (
        <View style={styles.pinnedChip}>
          <PinIcon size={9} color="#92400E" />
          <Text style={styles.pinnedChipText}>Fixado pelo Administrador</Text>
        </View>
      )}

      {/* Cabeçalho */}
      <View style={styles.header}>
        <ForumAvatar uri={comment.isAnonymous ? null : comment.authorPhoto} size={avatarSize} />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, comment.isAnonymous && { fontStyle: 'italic' }]}>{authorName}</Text>
            {!comment.isAnonymous && <AuthorBadges badges={comment.authorBadges} marginLeft={isRoot ? 6 : 5} />}
          </View>
          <Text style={styles.time}>há {forumTimeAgo(comment.createdAt)}</Text>
        </View>
      </View>

      {/* Conteúdo + ações (gutter de 46px alinhado ao nome) */}
      <View style={styles.content}>
        {editing ? (
          <InlineReplyPill
            placeholder="Edite seu comentário..."
            initialText={comment.content}
            prefillKey={0}
            isEdit
            containerStyle={{ marginLeft: 0, marginTop: 4, marginBottom: 8 }}
            ensureVisible={ctx.ensureVisible}
            setActiveReplyRef={ctx.setActiveReplyRef}
            userPhoto={ctx.userPhoto}
            onCancel={() => setEditing(false)}
            onSubmit={async (value) => {
              const ok = await ctx.onEdit(comment.id, value);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        ) : (
          <CommentBody text={comment.content} />
        )}

        <View style={styles.actions}>
          <ActionPill onPress={() => ctx.onLike(comment.id)}>
            <HeartIcon size={14} color={liked ? '#DC2626' : '#64748B'} filled={liked} />
            <Text style={[styles.pillCount, liked && { color: '#DC2626' }]}>{comment.likes || 0}</Text>
          </ActionPill>

          <ActionPill onPress={handleReplyPress} disabled={ctx.closed}>
            <BubbleIcon size={14} color={isReplying ? '#1B4332' : '#64748B'} />
            <Text style={[styles.pillText, isReplying && { color: '#1B4332', fontWeight: '700' }]}>Responder</Text>
          </ActionPill>

          {ctx.isAdmin && (
            <ActionPill onPress={() => ctx.onPin(comment)}>
              <PinIcon size={13} color={comment.isPinned ? '#B45309' : '#64748B'} />
              <Text style={[styles.pillText, comment.isPinned && { color: '#B45309', fontWeight: '700' }]}>
                {comment.isPinned ? 'Desafixar' : 'Fixar'}
              </Text>
            </ActionPill>
          )}

          {ctx.isAdmin && !ctx.closed && (
            <ActionPill onPress={() => ctx.onAi(comment)}>
              {ctx.aiLoadingId === comment.id ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : (
                <Text style={styles.pillText}>✨ IA</Text>
              )}
            </ActionPill>
          )}

          <View style={styles.secondaryActions}>
            {comment.isMine && !editing && (
              <ActionPill compact onPress={() => (ctx.closed ? Alert.alert('Discussão encerrada', 'Esta discussão está encerrada para edições.') : setEditing(true))} disabled={ctx.closed}>
                <EditIcon size={14} color="#64748B" />
              </ActionPill>
            )}
            {comment.isMine && (
              <ActionPill compact onPress={() => ctx.onDelete(comment.id)}>
                <TrashIcon size={14} color="#DC2626" />
              </ActionPill>
            )}
            <ActionPill compact onPress={() => ctx.onReport(comment)}>
              <FlagIcon size={14} color="#64748B" />
            </ActionPill>
          </View>
        </View>
      </View>

      {/* Campo de resposta: pílula simples estilo Instagram */}
      {isReplying && (
        <InlineReplyPill
          placeholder={`Responder a @${authorName.split(' ')[0]}...`}
          initialText={prefill ? prefill.text : ''}
          prefillKey={prefill ? prefill.nonce : 0}
          ensureVisible={ctx.ensureVisible}
          setActiveReplyRef={ctx.setActiveReplyRef}
          userPhoto={ctx.userPhoto}
          onCancel={ctx.onCancelReply}
          onSubmit={(value) => ctx.onSubmitReply(comment.id, value)}
        />
      )}

      {/* Toggle colapsado */}
      {hasReplies && !isExpanded && (
        <ThreadToggle
          label={`${total} ${total > 1 ? 'outras respostas' : 'outra resposta'}`}
          onPress={() => ctx.setExpanded(comment.id, true)}
          style={{ marginLeft: 28, marginTop: 4, marginBottom: 6 }}
        />
      )}

      {/* Respostas aninhadas (recursivo) */}
      {hasReplies && isExpanded && (
        <View style={styles.branch}>
          {replies.slice(0, shown).map((reply) => (
            <CommentNode key={reply.id} comment={reply} depth={depth + 1} />
          ))}
          {shown < replies.length && (
            <ThreadToggle
              elbow
              label="Mostrar mais respostas"
              onPress={() => setShown((s) => s + REPLY_BATCH_SIZE)}
              style={{ marginTop: 4, marginBottom: 6 }}
            />
          )}
          <ThreadToggle
            elbow
            collapse
            label={`Ocultar ${total === 1 ? 'resposta' : 'respostas'}`}
            onPress={() => ctx.setExpanded(comment.id, false)}
            style={{ marginTop: 4, marginBottom: 6 }}
          />
        </View>
      )}
    </View>
  );
});

const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  card: {
    position: 'relative',
  },
  rootCard: {
    paddingTop: 6,
    paddingBottom: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  replyCard: {
    paddingVertical: 4,
    marginBottom: 2,
  },
  pinnedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  elbow: {
    position: 'absolute',
    left: -15,
    top: 0,
    width: 15,
    height: 20,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#CBD5E1',
    borderBottomLeftRadius: 12,
  },
  threadStrip: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    zIndex: 2,
  },
  threadLine: {
    position: 'absolute',
    left: 13,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: '#CBD5E1',
  },
  pinnedChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginBottom: 4,
    opacity: 0.85,
  },
  pinnedChipText: {
    fontSize: 10.4,
    fontWeight: '600',
    color: '#92400E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16.8,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  time: {
    fontSize: 11.84,
    lineHeight: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  content: {
    marginLeft: 46,
  },
  bodyText: {
    fontSize: 15.68,
    lineHeight: 25,
    color: '#1E293B',
    marginBottom: 6,
  },
  readMoreBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  readMoreText: {
    fontSize: 14.4,
    fontWeight: '600',
    color: '#606060',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 26,
    borderRadius: 6,
  },
  pillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 26,
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
  },
  pillCount: {
    fontSize: 13.1,
    fontWeight: '700',
    color: '#64748B',
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  replyPillWrap: {
    marginLeft: 46,
    marginTop: 6,
    marginBottom: 6,
  },
  replyPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 24,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 40,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  replyPillIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPillInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: '#0F172A',
    paddingVertical: 4,
    paddingHorizontal: 0,
    maxHeight: 80,
  },
  replyPillCancelBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPillSendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPillSendBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.45,
  },
  replyFormWrap: {
    marginLeft: 46,
    marginTop: 8,
    marginBottom: 4,
  },
  inlineInput: {
    minHeight: 48,
    maxHeight: windowHeight * 0.25,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 24,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inlineActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  inlineCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  inlineCancelText: {
    color: '#64748B',
    fontSize: 14.4,
    fontWeight: '600',
  },
  inlineSubmitBtn: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 18,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSubmitText: {
    color: '#FFFFFF',
    fontSize: 14.4,
    fontWeight: '700',
  },
  toggleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  toggleElbow: {
    position: 'absolute',
    left: -15,
    top: 0,
    width: 15,
    height: 14,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#CBD5E1',
    borderBottomLeftRadius: 10,
  },
  toggleText: {
    fontSize: 13.1,
    fontWeight: '600',
    color: '#64748B',
  },
  branch: {
    marginLeft: 28,
    marginTop: 6,
    gap: 8,
  },
});

