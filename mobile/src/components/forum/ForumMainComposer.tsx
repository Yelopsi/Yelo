import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

/**
 * Composer principal de comentários (form#comment-form de psi_forum.html).
 * Estado local para não re-renderizar a árvore inteira a cada tecla.
 */

export interface MainComposerHandle {
  setText: (value: string) => void;
}

interface Props {
  aiAllowed: boolean;
  aiLoading: boolean;
  onGenerateAi: () => void;
  onSubmit: (text: string, anonymous: boolean) => Promise<boolean>;
  ensureVisible: (ref: React.RefObject<any>) => void;
}

const MainComposer = forwardRef<MainComposerHandle, Props>(function MainComposer(
  { aiAllowed, aiLoading, onGenerateAi, onSubmit, ensureVisible },
  handle
) {
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<any>(null);

  useImperativeHandle(handle, () => ({ setText }), []);

  const handleSubmit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit(text.trim(), anonymous);
    setBusy(false);
    if (ok) {
      setText('');
      setAnonymous(false);
    }
  };

  return (
    <View ref={wrapRef} collapsable={false} style={[styles.wrap, focused && styles.wrapFocused]}>
      <TextInput
        multiline
        value={text}
        onChangeText={setText}
        placeholder="deixe seu comentário."
        placeholderTextColor="#94A3B8"
        style={styles.input}
        textAlignVertical="top"
        onFocus={() => {
          setFocused(true);
          setTimeout(() => ensureVisible(wrapRef), 350);
        }}
        onBlur={() => setFocused(false)}
      />

      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => setAnonymous((v) => !v)} activeOpacity={0.8} style={styles.checkRow}>
          <View style={[styles.checkbox, anonymous && styles.checkboxOn]}>
            {anonymous && <Feather name="check" size={11} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkLabel} numberOfLines={1}>
            Comentar como Anônimo
          </Text>
        </TouchableOpacity>

        <View style={styles.right}>
          {aiAllowed && (
            <TouchableOpacity onPress={onGenerateAi} disabled={aiLoading} activeOpacity={0.85}>
              <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBtn}>
                {aiLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.aiBtnText}>IA</Text>}
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSubmit} disabled={busy} activeOpacity={0.85} style={[styles.sendBtn, busy && { opacity: 0.7 }]}>
            {busy ? <Text style={styles.sendText}>Enviando...</Text> : <Text style={styles.sendText}>Comentar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default MainComposer;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  wrapFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2D6A4F',
    shadowColor: '#2D6A4F',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    minHeight: 36,
    maxHeight: Dimensions.get('window').height * 0.25,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    lineHeight: 24.8,
    color: '#0F172A',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#1B4332',
    borderColor: '#1B4332',
  },
  checkLabel: {
    fontSize: 13.1,
    fontWeight: '600',
    color: '#475569',
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  aiBtn: {
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  aiBtnText: {
    color: '#FFFFFF',
    fontSize: 13.6,
    fontWeight: '700',
  },
  sendBtn: {
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B4332',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 13.6,
    fontWeight: '700',
  },
});
