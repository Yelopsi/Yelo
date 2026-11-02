import React, { useMemo } from 'react';
import { Keyboard, type StyleProp, type ViewStyle } from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import type { NativeSelectMenuProps } from './NativeSelectMenu';

export type { NativeSelectOption, NativeSelectMenuProps } from './NativeSelectMenu';

const EMPTY_SENTINEL = '__NATIVE_SELECT_EMPTY__';

/**
 * Android Nativo: renderiza o componente real `DropdownMenu` do Jetpack Compose / Material 3
 * seguindo o tema e padrão nativo do dispositivo Android.
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
      options.map((opt) => ({
        id: opt.value === '' ? EMPTY_SENTINEL : String(opt.value),
        title: opt.label,
        state: String(opt.value) === String(selectedValue) ? 'on' : 'off',
      })),
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
        onSelect(raw === EMPTY_SENTINEL ? '' : raw);
      }}
    >
      {children}
    </MenuView>
  );
}
