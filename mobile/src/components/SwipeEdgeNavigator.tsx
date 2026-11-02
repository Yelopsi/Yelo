import React, { useRef, useState, useEffect } from 'react';
import { View, PanResponder, Dimensions, Animated, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Fluxo principal de abas públicas (ordem lógica do app)
const PUBLIC_TABS = ['/', '/perguntas', '/questionario', '/sobre_psis', '/login'];

// Páginas de conteúdo institucional
const INSTITUTIONAL_PAGES = ['/sobre_psis', '/faq', '/blog', '/contato', '/termos', '/privacidade'];

interface SwipeEdgeNavigatorProps {
  children: React.ReactNode;
}

export default function SwipeEdgeNavigator({ children }: SwipeEdgeNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Histórico de avanço (forward stack) para quando o usuário volta e quer avançar
  const forwardStack = useRef<string[]>([]);
  const isNavigating = useRef(false);

  // Animação e estado do indicador visual deslizante
  const [activeEdge, setActiveEdge] = useState<'left' | 'right' | null>(null);
  const dragAnim = useRef(new Animated.Value(0)).current;

  const handleGoBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 400);

    // Salva a rota atual na pilha de avanço para permitir avançar de volta
    if (pathname && !forwardStack.current.includes(pathname)) {
      forwardStack.current.push(pathname);
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    // Se não há histórico nativo, navega para a aba anterior
    const tabIndex = PUBLIC_TABS.indexOf(pathname);
    if (tabIndex > 0) {
      router.replace(PUBLIC_TABS[tabIndex - 1] as any);
      return;
    }

    if (pathname !== '/') {
      router.replace('/');
    }
  };

  const handleGoForward = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 400);

    // 1. Prioridade: pilha de páginas das quais o usuário voltou recentemente
    if (forwardStack.current.length > 0) {
      const nextRoute = forwardStack.current.pop();
      if (nextRoute && nextRoute !== pathname) {
        router.push(nextRoute as any);
        return;
      }
    }

    // 2. Próxima aba no menu público
    const tabIndex = PUBLIC_TABS.indexOf(pathname);
    if (tabIndex >= 0 && tabIndex < PUBLIC_TABS.length - 1) {
      router.push(PUBLIC_TABS[tabIndex + 1] as any);
      return;
    }

    // 3. Próxima página institucional
    const instIndex = INSTITUTIONAL_PAGES.indexOf(pathname);
    if (instIndex >= 0 && instIndex < INSTITUTIONAL_PAGES.length - 1) {
      router.push(INSTITUTIONAL_PAGES[instIndex + 1] as any);
      return;
    }

    // Se estiver na Home ('/'), avança para o Questionário
    if (pathname === '/') {
      router.push('/questionario');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // No questionário, a tela possui seu próprio controle por passos
        if (pathname === '/questionario') return false;

        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;

        // Arraste da lateral esquerda para a direita (Voltar)
        const isLeftEdgeSwipe = gestureState.x0 <= 60 && gestureState.dx > 15;

        // Arraste da lateral direita para a esquerda (Avançar)
        const isRightEdgeSwipe = gestureState.x0 >= width - 60 && gestureState.dx < -15;

        return isLeftEdgeSwipe || isRightEdgeSwipe;
      },

      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (pathname === '/questionario') return false;

        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;

        const isLeftEdgeSwipe = gestureState.x0 <= 60 && gestureState.dx > 15;
        const isRightEdgeSwipe = gestureState.x0 >= width - 60 && gestureState.dx < -15;

        return isLeftEdgeSwipe || isRightEdgeSwipe;
      },

      onPanResponderGrant: (evt, gestureState) => {
        if (gestureState.x0 <= 60) {
          setActiveEdge('left');
        } else if (gestureState.x0 >= width - 60) {
          setActiveEdge('right');
        }
        dragAnim.setValue(0);
      },

      onPanResponderMove: (evt, gestureState) => {
        const dist = Math.min(60, Math.abs(gestureState.dx));
        dragAnim.setValue(dist);
      },

      onPanResponderRelease: (evt, gestureState) => {
        const isLeft = activeEdge === 'left';
        const isRight = activeEdge === 'right';

        const triggerLeft = isLeft && (gestureState.dx > 45 || gestureState.vx > 0.3);
        const triggerRight = isRight && (gestureState.dx < -45 || gestureState.vx < -0.3);

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

