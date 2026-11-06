import React, { useMemo } from 'react';
import { Keyboard, type StyleProp, type ViewStyle } from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import type { NativeSelectMenuProps } from './NativeSelectMenu';

export type { NativeSelectOption, NativeSelectMenuProps } from './NativeSelectMenu';

const EMPTY_SENTINEL = '__NATIVE_SELECT_EMPTY__';

/**
 * iOS Nativo: renderiza o componente real `SwiftUI.Menu` (`UIMenu`) do sistema operacional iOS
 * ancorado diretamente ao elemento gatilho, com efeitos de Liquid Glass e SF Symbols checkmark,
 * exatamente no padrão nativo do ecossistema Apple.
 */
export default function NativeSelectMenu({
  options,
  selectedValue,
  onSelect,
  title,
  style,
  children,
}: NativeSelectMenuProps) {
  const actions: MenuAction[] = useMemo(
    () =>
      options.map((opt) => {
        const isSelected = String(opt.value) === String(selectedValue);
        return {
          id: opt.value === '' ? EMPTY_SENTINEL : String(opt.value),
          title: opt.label,
          image: isSelected ? 'checkmark' : undefined,
        };
      }),
    [options, selectedValue]
  );

  return (
    <MenuView
      title={title}
      style={style as StyleProp<ViewStyle>}
      actions={actions}
      onOpenMenu={() => Keyboard.dismiss()}
      onPressAction={({ nativeEvent }) => {
        const raw = nativeEvent.event;
        const val = raw === EMPTY_SENTINEL ? '' : raw;
        if (val !== String(selectedValue)) {
          onSelect(val);
        }
      }}
    >
      {children}
    </MenuView>
  );
}
