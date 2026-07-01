import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTab } from '../types/schedule';
import { Theme, useThemedStyles } from '../theme';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string; glyph: string }[] = [
  { id: 'today', label: '今日', glyph: '◎' },
  { id: 'calendar', label: 'カレンダー', glyph: '▦' },
  { id: 'insights', label: '学習', glyph: '✦' },
  { id: 'settings', label: '設定', glyph: '⚙' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const styles = useThemedStyles(makeStyles);
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
            <Text style={[styles.glyph, active && styles.glyphActive]}>{tab.glyph}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: theme.navHeight,
    backgroundColor: theme.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  glyph: {
    fontSize: 18,
    color: theme.textTertiary,
    marginBottom: 3,
  },
  glyphActive: {
    color: theme.accent,
  },
  label: {
    fontSize: 11,
    color: theme.textTertiary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: theme.text,
    fontWeight: '700',
  },
  });
