import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppSettings } from '../types/schedule';
import { theme } from '../theme';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
      >
        <Text style={[styles.stepBtnText, value <= min && styles.stepBtnDisabled]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{label}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
      >
        <Text style={[styles.stepBtnText, value >= max && styles.stepBtnDisabled]}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

export function SettingsView({ settings, onUpdate }: SettingsViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>設定</Text>

      <Text style={styles.groupTitle}>タイムライン表示</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>表示倍率</Text>
            <Text style={styles.rowDesc}>大きいほど予定が潰れにくくなります</Text>
          </View>
          <Stepper
            value={settings.pxPerMinute}
            min={1}
            max={4}
            step={0.5}
            label={`${settings.pxPerMinute}px`}
            onChange={(v) => onUpdate({ pxPerMinute: v })}
          />
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>最小イベント高さ</Text>
          </View>
          <Stepper
            value={settings.minEventHeightPx}
            min={36}
            max={80}
            step={4}
            label={`${settings.minEventHeightPx}px`}
            onChange={(v) => onUpdate({ minEventHeightPx: v })}
          />
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>デフォルト時間</Text>
          </View>
          <Stepper
            value={settings.defaultDurationMinutes}
            min={5}
            max={120}
            step={5}
            label={`${settings.defaultDurationMinutes}分`}
            onChange={(v) => onUpdate({ defaultDurationMinutes: v })}
          />
        </View>
      </View>

      <Text style={styles.groupTitle}>AIスケジュール</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>タスク間バッファ</Text>
            <Text style={styles.rowDesc}>AIが各タスクの前に入れる切り替え時間</Text>
          </View>
          <Stepper
            value={settings.defaultBufferMinutes}
            min={0}
            max={15}
            step={5}
            label={`${settings.defaultBufferMinutes}分`}
            onChange={(v) => onUpdate({ defaultBufferMinutes: v })}
          />
        </View>
      </View>

      <Text style={styles.groupTitle}>カレンダー</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>週の始まり</Text>
          <View style={styles.weekToggle}>
            <TouchableOpacity
              style={[styles.weekBtn, settings.weekStartsOn === 0 && styles.weekBtnActive]}
              onPress={() => onUpdate({ weekStartsOn: 0 })}
            >
              <Text style={[styles.weekBtnText, settings.weekStartsOn === 0 && styles.weekBtnTextActive]}>
                日曜
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weekBtn, settings.weekStartsOn === 1 && styles.weekBtnActive]}
              onPress={() => onUpdate({ weekStartsOn: 1 })}
            >
              <Text style={[styles.weekBtnText, settings.weekStartsOn === 1 && styles.weekBtnTextActive]}>
                月曜
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>24時間表示</Text>
          <Switch
            value={settings.use24Hour}
            onValueChange={(v) => onUpdate({ use24Hour: v })}
            trackColor={{ false: theme.secondary, true: theme.accent }}
          />
        </View>
      </View>

      <View style={[styles.card, styles.infoCard]}>
        <Text style={styles.infoText}>
          分刻みの予定も最小高さを確保して読みやすく表示します。重なる予定は横に並べます。
        </Text>
        <Text style={[styles.infoMuted, { marginTop: 12 }]}>
          Google Gemini API（無料枠）を使う場合は .env に EXPO_PUBLIC_GEMINI_API_KEY を設定してください。キーは Google AI Studio から取得できます。未設定時はローカルでスケジュールを生成します。
        </Text>
        <Text style={styles.infoMuted}>Calendar v1.0 · Expo</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 34, fontWeight: '700', color: theme.text, marginBottom: 24 },
  groupTitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: theme.elevated,
    borderRadius: theme.radius.md,
    marginBottom: 24,
    overflow: 'hidden',
    ...theme.shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 16, color: theme.text },
  rowDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginHorizontal: 14 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg,
    borderRadius: 8,
    padding: 2,
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 18, color: theme.accent, fontWeight: '500' },
  stepBtnDisabled: { color: theme.textTertiary },
  stepValue: { minWidth: 52, textAlign: 'center', fontWeight: '600', fontSize: 14 },
  weekToggle: { flexDirection: 'row' },
  weekBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.bg,
    marginLeft: 6,
  },
  weekBtnActive: { backgroundColor: theme.accent },
  weekBtnText: { fontSize: 14, color: theme.textSecondary, fontWeight: '600' },
  weekBtnTextActive: { color: '#fff' },
  infoCard: { padding: 16 },
  infoText: { fontSize: 14, lineHeight: 22, color: theme.text },
  infoMuted: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
});
