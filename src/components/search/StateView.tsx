import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'accent' | 'muted' | 'error';
}

/** Empty / no-results / error placeholder with an optional action button. */
export default function StateView({ icon, title, subtitle, actionLabel, onAction, tone = 'muted' }: Props) {
  const color = tone === 'accent' ? '#10B981' : tone === 'error' ? '#F87171' : '#52525B';
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, tone === 'error' && styles.iconError]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, paddingHorizontal: 40 },
  icon: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 16,
    backgroundColor: 'rgba(16,185,129,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  iconError: { backgroundColor: 'rgba(248,113,113,0.1)' },
  title: { color: '#E5E2E1', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: 18, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 9999,
    backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  buttonText: { color: '#10B981', fontSize: 14, fontWeight: '700' },
});
