import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTab } from '../types/schedule';
import { theme } from '../theme';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'カレンダー', icon: '📅' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
          >
            {active && <View style={styles.indicator} />}
            <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: theme.navHeight,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
  },
  icon: { fontSize: 22, opacity: 0.45, marginBottom: 2 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: theme.textSecondary, fontWeight: '500' },
  labelActive: { color: theme.accent, fontWeight: '700' },
});
