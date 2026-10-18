import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGuardedPush } from '../navGuard';
import { Ionicons } from '@expo/vector-icons';
import { useOttData } from './useOtt';

/** Bell icon with unread badge; opens the alerts screen. */
export default function AlertsBellButton() {
  const push = useGuardedPush();
  const { unread } = useOttData();

  return (
    <Pressable
      style={styles.btn}
      onPress={() => push('/alerts')}
      hitSlop={8}
      accessibilityLabel="Alerts"
    >
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={22} color="#FFFFFF" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#000000', fontSize: 10, fontWeight: '800' },
});
