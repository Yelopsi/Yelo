import React, { useState, useCallback } from 'react';
import { ScrollView, ScrollViewProps, RefreshControl } from 'react-native';

interface YeloScrollViewProps extends ScrollViewProps {
  /**
   * Função executada quando o usuário puxa para recarregar.
   * Pode retornar uma Promise para controlar o estado de loading.
   */
  onRefreshAction?: () => Promise<void> | void;
  refreshColor?: string;
}

/**
 * Um wrapper para o ScrollView que automaticamente insere
 * o RefreshControl padronizado com as cores da Yelo.
 */
export default function YeloScrollView({ 
  children, 
  onRefreshAction, 
  refreshColor = '#1B4332',
  ...props 
}: YeloScrollViewProps) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Se existir uma ação específica, nós a aguardamos
    if (onRefreshAction) {
      try {
        await onRefreshAction();
      } catch (error) {
        console.error('Erro ao recarregar:', error);
      }
    } else {
      // Caso não passe função de Refresh, fazemos um timeout falso elegante
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    setRefreshing(false);
  }, [onRefreshAction]);

  return (
    <ScrollView
      bounces={true}
      alwaysBounceVertical={!props.horizontal}
      {...props}
      refreshControl={
        !props.horizontal ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[refreshColor]} // Android
            tintColor={refreshColor} // iOS
            title="Atualizando..."
            titleColor={refreshColor}
            progressViewOffset={40}
            progressBackgroundColor={refreshColor === '#ffffff' ? '#1B4332' : '#ffffff'}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
