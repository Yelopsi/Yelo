import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import {
  dateToTimeString,
  timeStringToDate,
  type NativeTimePickerProps,
} from './NativeTimePicker.shared';

export type { NativeTimePickerProps } from './NativeTimePicker.shared';

/**
 * Android Nativo: renderiza a pílula Yelo que, ao ser tocada, abre o
 * `TimePickerDialog` nativo Material 3 (Jetpack Compose) em modo 24h (`00:00`–`23:59`).
 */
export default function NativeTimePicker({
  time,
  onChangeTime,
  durationBadgeLabel,
  style,
}: NativeTimePickerProps) {
  const [open, setOpen] = useState(false);
  const dateValue = useMemo(() => timeStringToDate(time), [time]);

  return (
    <View style={[{ width: '100%' }, style]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={{
          backgroundColor: '#f9fafb',
          borderWidth: 1,
          borderColor: open ? '#1B4332' : '#ced4da',
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 11,
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Feather name="clock" size={16} color="#1B4332" style={{ marginRight: 8 }} />
          <Text
            className="font-sans"
            style={{ fontSize: 16, fontWeight: '700', color: '#1B4332' }}
          >
            {time}
          </Text>
          {durationBadgeLabel ? (
            <View
              style={{
                marginLeft: 10,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: '#e8f5e9',
              }}
            >
              <Text
                className="font-sans"
                style={{ fontSize: 11, fontWeight: '600', color: '#1B4332' }}
              >
                {durationBadgeLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Feather name="chevron-down" size={18} color="#1B4332" />
      </TouchableOpacity>

      {open && (
        <DateTimePicker
          value={dateValue}
          mode="time"
          presentation="dialog"
          is24Hour={true}
          accentColor="#1B4332"
          themeVariant="light"
          positiveButton={{ label: 'Confirmar' }}
          negativeButton={{ label: 'Cancelar' }}
          onChange={(event, selectedDate) => {
            setOpen(false);
            if (event.type === 'set' && selectedDate) {
              const next = dateToTimeString(selectedDate);
              if (next !== time) {
                onChangeTime(next);
              }
            }
          }}
          onDismiss={() => setOpen(false)}
          style={{ position: 'absolute', width: 0, height: 0 }}
        />
      )}
    </View>
  );
}
