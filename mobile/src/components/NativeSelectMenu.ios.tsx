import React from 'react';
import { Keyboard, type StyleProp, type ViewStyle } from 'react-native';
import { Host, Menu, RNHostView, Toggle } from '@expo/ui/swift-ui';
import { menuOrder } from '@expo/ui/swift-ui/modifiers';
import type { NativeSelectMenuProps } from './NativeSelectMenu';

export type { NativeSelectOption, NativeSelectMenuProps } from './NativeSelectMenu';

/**
 * iOS Nativo: renderiza o componente real `SwiftUI.Menu` (`UIMenu`) do sistema operacional,
 * respeitando automaticamente versão do iOS, Liquid Glass, tema do sistema, acessibilidade e ordem fixa.
 */
export default function NativeSelectMenu({
  options,
  selectedValue,
  onSelect,
  style,
  children,
}: NativeSelectMenuProps) {
  const trigger = (
    <RNHostView matchContents boundedByHost>
      <>{children}</>
    </RNHostView>
  );

  return (
    <Host style={style} ignoreSafeArea="all">
      <Menu label={trigger} modifiers={[menuOrder('fixed')]}>
        {options.map((opt, idx) => {
          const isSelected = String(opt.value) === String(selectedValue);
          return (
            <Toggle
              key={opt.value !== '' ? opt.value : `__empty_${idx}__`}
              label={opt.label}
              isOn={isSelected}
              onIsOnChange={() => {
                Keyboard.dismiss();
                onSelect(opt.value);
              }}
            />
          );
        })}
      </Menu>
    </Host>
  );
}

