import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  PanResponder,
  Dimensions,
  Animated,
  StyleSheet,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';

interface SwipeEdgeNavigatorProps {
  children: React.ReactNode;
}

// Rotas conhecidas de abas principais no fluxo do profissional
const TABS_ROUTES = [
  '/',
  '/clinica',
  '/calculadora',
  '/manual-conversao',
  '/financeiro',
  '/analytics',
  '/pacientes',
  '/ajustes',
  '/avisos',
  '/meu_perfil',
  '/fale_com_a_yelo',
  '/comunidade',
  '/forum',
  '/blog',
  '/jornada',
  '/notificacoes',
  '/favoritos-analytics',
];

const normalizePath = (p: string) => {
  if (!p) return '/';
  let clean = p.replace('/(tabs)', '');
  if (clean.endsWith('/') && clean.length > 1) {
    clean = clean.slice(0, -1);
  }
  if (clean === '/index' || clean === '' || clean === '/') return '/';
  return clean;
};

export default function SwipeEdgeNavigator({ children }: SwipeEdgeNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Histórico de navegação completo (pilha bidirecional Voltar / Avançar estilo browser)
  const historyRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const isSwipingNav = useRef(false);
  const isNavigating = useRef(false);

  // Refs de estado para leitura síncrona sem stale closure no PanResponder
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const canGoBackRef = useRef(false);
  const canGoForwardRef = useRef(false);
  const activeEdgeRef = useRef<'left' | 'right' | null>(null);

  // Animação e estado do indicador visual deslizante
  const [activeEdge, setActiveEdge] = useState<'left' | 'right' | null>(null);
  const dragAnim = useRef(new Animated.Value(0)).current;

  // Atualiza as flags de permissão de gesto
  const updateCanGoFlags = () => {
    canGoBackRef.current = currentIndexRef.current > 0;
    canGoForwardRef.current = currentIndexRef.current < historyRef.current.length - 1;
  };

  // Monitora alterações de pathname para gerenciar o histórico completo da sessão
  useEffect(() => {
    if (!pathname) return;
    const currentNormalized = normalizePath(pathname);

    // Se a navegação foi disparada pelo próprio gesto de swipe, apenas atualiza flags
    if (isSwipingNav.current) {
      isSwipingNav.current = false;
      updateCanGoFlags();
      return;
    }

    const history = historyRef.current;
    const currIdx = currentIndexRef.current;

    // Se já estiver na mesma página atual do histórico, não duplica
    if (currIdx >= 0 && history[currIdx] === currentNormalized) {
      updateCanGoFlags();
      return;
    }

    // Se o usuário navegou de volta através de um botão na tela (ex: botão "Voltar")
    if (currIdx > 0 && history[currIdx - 1] === currentNormalized) {
      currentIndexRef.current = currIdx - 1;
      updateCanGoFlags();
      return;
    }

    // Caso contrário, é uma nova navegação: descarta o histórico "para frente" e adiciona a nova página
    const newHistory = history.slice(0, currIdx + 1);
    newHistory.push(currentNormalized);
    historyRef.current = newHistory;
    currentIndexRef.current = newHistory.length - 1;
    updateCanGoFlags();
  }, [pathname]);

  const navigateToRoute = (route: string) => {
    const clean = normalizePath(route);
    if (TABS_ROUTES.includes(clean)) {
      const target = clean === '/' ? '/(tabs)' : `/(tabs)${clean}`;
      try {
        router.navigate(target as any);
        return;
      } catch (err) {
        console.warn('[SWIPE_NAV] Erro ao navegar para aba:', target, err);
      }
    }
    try {
      router.navigate(clean as any);
    } catch (err) {
      console.warn('[SWIPE_NAV] Erro ao navegar para rota:', clean, err);
    }
  };

  const handleGoBack = () => {
    if (isNavigating.current) return;
    if (currentIndexRef.current <= 0) return;

    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 400);

    const prevIndex = currentIndexRef.current - 1;
    const targetRoute = historyRef.current[prevIndex];

    if (targetRoute) {
      currentIndexRef.current = prevIndex;
      updateCanGoFlags();
      isSwipingNav.current = true;
      navigateToRoute(targetRoute);
    }
  };

  const handleGoForward = () => {
    if (isNavigating.current) return;
    if (currentIndexRef.current >= historyRef.current.length - 1) return;

    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 400);

    const nextIndex = currentIndexRef.current + 1;
    const targetRoute = historyRef.current[nextIndex];

    if (targetRoute) {
      currentIndexRef.current = nextIndex;
      updateCanGoFlags();
      isSwipingNav.current = true;
      navigateToRoute(targetRoute);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const curPath = pathnameRef.current;
        if (curPath === '/questionario' || curPath === '/psi_questionario') return false;

        const screenWidth = Dimensions.get('window').width;
        const edgeWidth = Math.max(90, screenWidth * 0.25);

        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;

        const isLeftEdgeSwipe = gestureState.x0 <= edgeWidth && gestureState.dx > 15 && canGoBackRef.current;
        const isRightEdgeSwipe = gestureState.x0 >= screenWidth - edgeWidth && gestureState.dx < -15 && canGoForwardRef.current;

        return isLeftEdgeSwipe || isRightEdgeSwipe;
      },

      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const curPath = pathnameRef.current;
        if (curPath === '/questionario' || curPath === '/psi_questionario') return false;

        const screenWidth = Dimensions.get('window').width;
        const edgeWidth = Math.max(90, screenWidth * 0.25);

        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;

        const isLeftEdgeSwipe = gestureState.x0 <= edgeWidth && gestureState.dx > 15 && canGoBackRef.current;
        const isRightEdgeSwipe = gestureState.x0 >= screenWidth - edgeWidth && gestureState.dx < -15 && canGoForwardRef.current;

        return isLeftEdgeSwipe || isRightEdgeSwipe;
      },

      onPanResponderGrant: (evt, gestureState) => {
        const screenWidth = Dimensions.get('window').width;
        const edgeWidth = Math.max(90, screenWidth * 0.25);

        if (gestureState.x0 <= edgeWidth && canGoBackRef.current) {
          activeEdgeRef.current = 'left';
          setActiveEdge('left');
        } else if (gestureState.x0 >= screenWidth - edgeWidth && canGoForwardRef.current) {
          activeEdgeRef.current = 'right';
          setActiveEdge('right');
        } else {
          activeEdgeRef.current = null;
        }
        dragAnim.setValue(0);
      },

      onPanResponderMove: (evt, gestureState) => {
        const dist = Math.min(60, Math.abs(gestureState.dx));
        dragAnim.setValue(dist);
      },

      onPanResponderRelease: (evt, gestureState) => {
        const edge = activeEdgeRef.current;
        const isLeft = edge === 'left';
        const isRight = edge === 'right';

        const triggerLeft = isLeft && (gestureState.dx > 35 || gestureState.vx > 0.25);
        const triggerRight = isRight && (gestureState.dx < -35 || gestureState.vx < -0.25);

        activeEdgeRef.current = null;

        Animated.timing(dragAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setActiveEdge(null);
        });

        if (triggerLeft) {
          handleGoBack();
        } else if (triggerRight) {
          handleGoForward();
        }
      },

      onPanResponderTerminate: () => {
        activeEdgeRef.current = null;
        Animated.timing(dragAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setActiveEdge(null);
        });
      },
    })
  ).current;

  // Interpolações para o indicador visual deslizante
  const leftTranslateX = dragAnim.interpolate({
    inputRange: [0, 60],
    outputRange: [-45, 15],
    extrapolate: 'clamp',
  });

  const rightTranslateX = dragAnim.interpolate({
    inputRange: [0, 60],
    outputRange: [45, -15],
    extrapolate: 'clamp',
  });

  const pillOpacity = dragAnim.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.7, 1],
    extrapolate: 'clamp',
  });

  const pillScale = dragAnim.interpolate({
    inputRange: [0, 45, 60],
    outputRange: [0.8, 1, 1.1],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}

      {/* Indicador Flutuante da Lateral Esquerda (Voltar) */}
      {activeEdge === 'left' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgePill,
            styles.leftEdgePill,
            {
              opacity: pillOpacity,
              transform: [{ translateX: leftTranslateX }, { scale: pillScale }],
            },
          ]}
        >
          <Feather name="chevron-left" size={24} color="#1B4332" />
        </Animated.View>
      )}

      {/* Indicador Flutuante da Lateral Direita (Avançar) */}
      {activeEdge === 'right' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgePill,
            styles.rightEdgePill,
            {
              opacity: pillOpacity,
              transform: [{ translateX: rightTranslateX }, { scale: pillScale }],
            },
          ]}
        >
          <Feather name="chevron-right" size={24} color="#1B4332" />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  edgePill: {
    position: 'absolute',
    top: '48%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#EAE3D9',
    zIndex: 99999,
  },
  leftEdgePill: {
    left: 0,
  },
  rightEdgePill: {
    right: 0,
  },
});
