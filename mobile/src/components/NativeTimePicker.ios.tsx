import React, { useMemo } from 'react';
import { View, Text, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, environment, tint } from '@expo/ui/swift-ui/modifiers';
import {
  dateToTimeString,
  timeStringToDate,
  type NativeTimePickerProps,
} from './NativeTimePicker';

export type { NativeTimePickerProps } from './NativeTimePicker';

/**
 * iOS Nativo: renderiza o `SwiftUI.DatePicker` (`UIDatePicker` em estilo `.compact`)
 * integrado à pílula Yelo. Ao tocar no chip nativo de hora, o iOS abre o popover
 * flutuante nativo (Liquid Glass) com roleta 24h (`pt_BR`) + teclado numérico embutido.
 */
export default function NativeTimePicker({
  time,
  onChangeTime,
  durationBadgeLabel,
  label = 'Início',
  style,
}: NativeTimePickerProps) {
  const dateValue = useMemo(() => timeStringToDate(time), [time]);

  return (
    <View
      style={[
        {
          backgroundColor: '#f9fafb',
          borderWidth: 1,
          borderColor: '#ced4da',
          borderRadius: 999,
          paddingLeft: 18,
          paddingRight: 8,
          paddingVertical: 6,
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
        <Feather name="clock" size={16} color="#1B4332" style={{ marginRight: 8 }} />
        <Text
          className="font-sans"
          style={{ fontSize: 15, fontWeight: '600', color: '#1B4332' }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {durationBadgeLabel ? (
          <View
            style={{
              marginLeft: 8,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: '#e8f5e9',
            }}
          >
            <Text
              className="font-sans"
              style={{ fontSize: 11, fontWeight: '600', color: '#1B4332' }}
              numberOfLines={1}
            >
              {durationBadgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Host matchContents alignment="trailing" colorScheme="light" ignoreSafeArea="all">
        <DatePicker
          selection={dateValue}
          displayedComponents={['hourAndMinute']}
          onDateChange={(selectedDate) => {
            Keyboard.dismiss();
            const next = dateToTimeString(selectedDate);
            if (next !== time) {
              onChangeTime(next);
            }
          }}
          modifiers={[
            datePickerStyle('compact'),
            tint('#1B4332'),
            environment('locale', 'pt_BR'),
          ]}
        />
      </Host>
    </View>
  );
}
