import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { getBaseUrl } from '../../services/api';

/**
 * Elementos visuais do Fórum (app) espelhando 1:1 a versão web mobile
 * (public/psi/psi_forum.html + public/css/forum-community.css).
 * Os ícones usam exatamente os mesmos paths SVG do template web.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Equivalente ao window.formatImageUrl da web. Retorna null quando não há foto. */
export function resolveForumImage(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  let clean = path.replace(/\\/g, '/');
  if (clean.includes('uploads/')) clean = clean.substring(clean.lastIndexOf('uploads/'));
  if (!clean.startsWith('/')) clean = `/${clean}`;
  return `${getBaseUrl()}${clean}`;
}

/** Equivalente ao timeSince da web ("há 7 meses", "há 2 horas"). */
export function forumTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'recentemente';
  try {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'poucos segundos';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    const years = Math.floor(days / 365);
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  } catch {
    return 'recentemente';
  }
}

// ---------------------------------------------------------------------------
// Ícones (mesmos paths do web)
// ---------------------------------------------------------------------------

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const Base = ({
  size = 14,
  color = '#64748B',
  strokeWidth = 2,
  fill = 'none',
  children,
}: IconProps & { fill?: string; children: React.ReactNode }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? p.color || '#64748B' : 'none'}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Base>
);

export const BubbleIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </Base>
);

export const FlagIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <Line x1="4" y1="22" x2="4" y2="15" />
  </Base>
);

export const EditIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    <Path d="M15 5l4 4" />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <Line x1="10" y1="11" x2="10" y2="17" />
    <Line x1="14" y1="11" x2="14" y2="17" />
  </Base>
);

export const ShareIcon = (p: IconProps) => (
  <Base {...p} strokeWidth={p.strokeWidth ?? 2.2}>
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Base>
);

export const RedirectIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <Polyline points="15 3 21 3 21 9" />
    <Line x1="10" y1="14" x2="21" y2="3" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p} strokeWidth={p.strokeWidth ?? 2.5}>
    <Line x1="12" y1="17" x2="12" y2="22" />
    <Path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </Base>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Base {...p} strokeWidth={p.strokeWidth ?? 2.6}>
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Base>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Base {...p}>
    <Polyline points="6 9 12 15 18 9" />
  </Base>
);

/** Ícones circulares ⊕ / ⊖ do toggle de respostas (estilo Reddit) */
export const ThreadExpandIcon = ({ size = 16, color = '#64748B' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill={color}>
    <Path d="M10 1a9 9 0 100 18 9 9 0 000-18Zm0 16.2a7.2 7.2 0 117.2-7.2 7.208 7.208 0 01-7.2 7.2Zm.9-8.1H14v1.8h-3.1V14H9.1v-3.1H6V9.1h3.1V6h1.8v3.1Z" />
  </Svg>
);

export const ThreadCollapseIcon = ({ size = 16, color = '#64748B' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill={color}>
    <Path d="M10 1a9 9 0 100 18 9 9 0 000-18Zm0 16.2a7.2 7.2 0 117.2-7.2 7.208 7.208 0 01-7.2 7.2ZM6 9.1h8v1.8H6Z" />
  </Svg>
);

// ---------------------------------------------------------------------------
// Badges do autor (renderInlineAuthorBadges da web)
// ---------------------------------------------------------------------------

const BADGE_STYLE: Record<string, { bg: string; fg: string }> = {
  autentico: { bg: '#ECFDF5', fg: '#166534' },
  semeador: { bg: '#F0FDF4', fg: '#15803D' },
  voz_ativa: { bg: '#F1F5F9', fg: '#475569' },
  pioneiro: { bg: '#FFFBEB', fg: '#B45309' },
};

const BadgeGlyph = ({ kind, fg, size }: { kind: string; fg: string; size: number }) => {
  if (kind === 'autentico') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z"
          fill="#1B4332"
        />
        <Path
          d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z"
          fill="white"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'semeador' && (
        <>
          <Path d="M12 22v-9" />
          <Path d="M12 13a5 5 0 0 0-5-5c0 4 2 6 5 6Z" />
          <Path d="M12 10a5 5 0 0 1 5-5c0 4-2 6-5 6Z" />
        </>
      )}
      {kind === 'voz_ativa' && (
        <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      )}
      {kind === 'pioneiro' && (
        <>
          <Circle cx="12" cy="8" r="6" />
          <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </>
      )}
    </Svg>
  );
};

export function AuthorBadges({ badges, boxSize = 14, marginLeft = 6 }: { badges: any; boxSize?: number; marginLeft?: number }) {
  let data = badges;
  if (typeof badges === 'string') {
    try {
      data = JSON.parse(badges);
    } catch {
      data = {};
    }
  }
  if (!data || typeof data !== 'object') return null;

  const order = ['autentico', 'semeador', 'voz_ativa', 'pioneiro'];
  const active = order.filter((k) => !!data[k]);
  if (active.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft }}>
      {active.map((kind) => (
        <View
          key={kind}
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: 4,
            backgroundColor: BADGE_STYLE[kind].bg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.75,
          }}
        >
          <BadgeGlyph kind={kind} fg={BADGE_STYLE[kind].fg} size={11} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatar (placeholder "Psi" idêntico ao fallback do formatImageUrl da web)
// ---------------------------------------------------------------------------

export function ForumAvatar({
  uri,
  size,
  border = 1.5,
  borderColor = '#E2E8F0',
  style,
}: {
  uri?: string | null;
  size: number;
  border?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveForumImage(uri);
  const box: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: border,
    borderColor,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  };

  if (!resolved || failed) {
    return (
      <View style={[box, { backgroundColor: '#1B4332', alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: Math.max(10, size * 0.28) }}>Psi</Text>
      </View>
    );
  }

  return (
    <View style={[box, style]}>
      <Image source={{ uri: resolved }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setFailed(true)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Texto com menções @Nome (hydrateForumMentions da web: verde escuro, negrito)
// ---------------------------------------------------------------------------

const MENTION_REGEX = /(@[^\s@,;:!?()"']+)/g;

export function MentionText({ text, style, ...rest }: { text: string; style?: any; numberOfLines?: number; onTextLayout?: (e: any) => void }) {
  const parts = (text || '').split(MENTION_REGEX);
  return (
    <Text style={style} {...rest}>
      {parts.map((part, i) =>
        part.startsWith('@') && part.length > 1 ? (
          <Text key={i} style={mentionStyles.mention}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

const mentionStyles = StyleSheet.create({
  mention: { color: '#1B4332', fontWeight: '700' },
});
