import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { AppSettings } from '../types/schedule';
import { isGeminiConfigured, maskGeminiApiKey } from '../infrastructure/gemini/resolveGeminiConfig';
import { minutesToTime } from '../utils/time';
import { LooperDurationPickerField } from './pickers';
import { Theme, useTheme, useThemedStyles } from '../theme';
import { aiEngineLabel, getAiCapabilityStatus } from '../intelligence/ai/aiCapabilities';
import {
  canUseCloudAi,
  isLooperDevClient,
  looperPlanLabel,
  resolveLooperPlan,
} from '../config/aiEntitlement';
import { BETA_FORCE_PRO_PLAN, isLooperAiProxyConfigured } from '../config/cloudAiProxy';
import { APP_AI_LABEL, APP_NAME, APP_PRO_PLAN } from '../config/brand';
import { BETA_FEEDBACK_URL } from '../config/betaConfig';

function appVersionLabel(): string {
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
  const build = Constants.nativeBuildVersion;
  return build ? `${version} (ビルド ${build})` : version;
}

interface SettingsViewProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onOpenRoutines: () => void;
  onShowOnboarding?: () => void;
  onExportData?: () => Promise<void>;
  onResetData?: () => Promise<void>;
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
  const styles = useThemedStyles(makeStyles);
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

export function SettingsView({
  settings,
  onUpdate,
  onOpenRoutines,
  onShowOnboarding,
  onExportData,
  onResetData,
}: SettingsViewProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const aiStatus = getAiCapabilityStatus(settings);
  const aiEnabled = aiStatus.cloudAiAvailable;
  const looperPlan = resolveLooperPlan(settings);
  const displayPlan = BETA_FORCE_PRO_PLAN ? 'pro' : looperPlan;
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [dataBusy, setDataBusy] = useState(false);

  const isWeb = Platform.OS === 'web';
  const savedGeminiKey = settings.geminiApiKey?.trim() ?? '';
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setApiKeyMessage('キーを入力してください。');
      return;
    }
    onUpdate({ geminiApiKey: trimmed });
    setApiKeyInput('');
    setApiKeyMessage('保存しました。AI 機能が使えるようになります。');
  };

  const handleClearApiKey = () => {
    onUpdate({ geminiApiKey: undefined });
    setApiKeyInput('');
    setApiKeyMessage('キーを削除しました。');
  };

  const cloudAiStatusDesc = (() => {
    if (aiEnabled && isLooperAiProxyConfigured()) {
      return `${APP_AI_LABEL}（ベータ・プロキシ）`;
    }
    if (aiEnabled && isLooperDevClient()) {
      return '開発モード（.env）';
    }
    if (canUseCloudAi(settings)) {
      return `${APP_PRO_PLAN}（プロキシ URL 未設定）`;
    }
    return '無料プラン（ローカル）';
  })();

  const handleExportData = async () => {
    if (!onExportData || dataBusy) {
      return;
    }
    setDataBusy(true);
    setDataMessage(null);
    try {
      await onExportData();
      setDataMessage('バックアップをエクスポートしました');
    } catch {
      setDataMessage('エクスポートに失敗しました。もう一度お試しください。');
    } finally {
      setDataBusy(false);
    }
  };

  const confirmResetData = () => {
    if (!onResetData || dataBusy) {
      return;
    }
    Alert.alert(
      'すべてのデータをリセット',
      'タスク・予定・ふりかえり・学習データが端末から削除されます。この操作は取り消せません。先にエクスポートすることをおすすめします。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセットする',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDataBusy(true);
              setDataMessage(null);
              try {
                await onResetData();
                setDataMessage('データをリセットしました');
              } catch {
                setDataMessage('リセットに失敗しました。もう一度お試しください。');
              } finally {
                setDataBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>設定</Text>

      <Text style={styles.groupTitle}>外観</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>テーマ</Text>
            <Text style={styles.rowDesc}>ライト / ダークを切り替えます</Text>
          </View>
          <View style={styles.weekToggle}>
            <TouchableOpacity
              style={[styles.weekBtn, settings.themeMode === 'light' && styles.weekBtnActive]}
              onPress={() => onUpdate({ themeMode: 'light' })}
            >
              <Text style={[styles.weekBtnText, settings.themeMode === 'light' && styles.weekBtnTextActive]}>
                ライト
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weekBtn, settings.themeMode === 'dark' && styles.weekBtnActive]}
              onPress={() => onUpdate({ themeMode: 'dark' })}
            >
              <Text style={[styles.weekBtnText, settings.themeMode === 'dark' && styles.weekBtnTextActive]}>
                ダーク
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
          <LooperDurationPickerField
            value={settings.defaultDurationMinutes}
            minMinutes={5}
            maxMinutes={120}
            minuteInterval={5}
            variant="inline"
            onChange={(v) => onUpdate({ defaultDurationMinutes: v })}
          />
        </View>
      </View>

      <Text style={styles.groupTitle}>{APP_AI_LABEL}</Text>
      <View style={styles.card}>
        <View style={[styles.banner, aiEnabled ? styles.bannerOn : styles.bannerOff]}>
          <Text style={[styles.bannerTitle, aiEnabled ? styles.bannerTitleOn : styles.bannerTitleOff]}>
            {aiEnabled ? `${APP_AI_LABEL} 有効` : 'ローカルモード'}
          </Text>
          <Text style={styles.bannerDesc}>
            {aiEnabled
              ? `コーチ・ふりかえり抽出・所要時間推定で ${APP_AI_LABEL} を利用します。`
              : '言語理解タスクはローカル処理です。Today の自動配置・学習は引き続き動作します。'}
          </Text>
        </View>

        <View style={styles.aiPlanBody}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>現在のプラン</Text>
              <Text style={styles.rowDesc}>
                {looperPlanLabel(displayPlan)}
                {BETA_FORCE_PRO_PLAN
                  ? ' — ベータ期間中は全員 Pro'
                  : displayPlan === 'free'
                    ? ` — ${APP_AI_LABEL} は有料プランに含まれます`
                    : ''}
              </Text>
            </View>
            <View
              style={[
                styles.aiBadge,
                displayPlan === 'pro' ? styles.aiBadgeOn : styles.aiBadgeOff,
              ]}
            >
              <Text
                style={[
                  styles.aiBadgeText,
                  displayPlan === 'pro' ? styles.aiBadgeTextOn : styles.aiBadgeTextOff,
                ]}
              >
                {displayPlan === 'pro' ? 'Pro' : 'Free'}
              </Text>
            </View>
          </View>
          <Text style={styles.aiPlanNote}>
            API キーの入力は不要です。{APP_NAME} サーバー（Cloud AI プロキシ）経由で AI を利用します。
            {BETA_FORCE_PRO_PLAN ? ' ベータ期間中は全員 Pro 扱いです。' : ''}
            {isLooperDevClient() && !isLooperAiProxyConfigured()
              ? ' 開発ビルドでは .env の EXPO_PUBLIC_GEMINI_API_KEY も使えます。'
              : ''}
          </Text>
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
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>スケジュール配置</Text>
            <Text style={styles.rowDesc}>UserModel を参照するローカルエンジン（学習型AI）</Text>
          </View>
          <View style={[styles.aiBadge, styles.aiBadgeOff]}>
            <Text style={[styles.aiBadgeText, styles.aiBadgeTextOff]}>
              {aiEngineLabel(aiStatus.placement)}
            </Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>AIコーチ</Text>
            <Text style={styles.rowDesc}>今日の理由説明・相談</Text>
          </View>
          <View style={[styles.aiBadge, aiStatus.coach === 'gemini' ? styles.aiBadgeOn : styles.aiBadgeOff]}>
            <Text
              style={[
                styles.aiBadgeText,
                aiStatus.coach === 'gemini' ? styles.aiBadgeTextOn : styles.aiBadgeTextOff,
              ]}
            >
              {aiEngineLabel(aiStatus.coach)}
            </Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>ふりかえり抽出</Text>
            <Text style={styles.rowDesc}>自由記述 → 気分・エネルギー等へ変換</Text>
          </View>
          <View
            style={[
              styles.aiBadge,
              aiStatus.reflectionExtract === 'gemini' ? styles.aiBadgeOn : styles.aiBadgeOff,
            ]}
          >
            <Text
              style={[
                styles.aiBadgeText,
                aiStatus.reflectionExtract === 'gemini' ? styles.aiBadgeTextOn : styles.aiBadgeTextOff,
              ]}
            >
              {aiEngineLabel(aiStatus.reflectionExtract)}
            </Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>所要時間推定</Text>
            <Text style={styles.rowDesc}>タスク名から所要時間・カテゴリを推測</Text>
          </View>
          <View
            style={[
              styles.aiBadge,
              aiStatus.taskDurationEstimate === 'gemini' ? styles.aiBadgeOn : styles.aiBadgeOff,
            ]}
          >
            <Text
              style={[
                styles.aiBadgeText,
                aiStatus.taskDurationEstimate === 'gemini' ? styles.aiBadgeTextOn : styles.aiBadgeTextOff,
              ]}
            >
              {aiEngineLabel(aiStatus.taskDurationEstimate)}
            </Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>接続状態</Text>
            <Text style={styles.rowDesc}>{cloudAiStatusDesc}</Text>
          </View>
          <View style={[styles.aiBadge, aiEnabled ? styles.aiBadgeOn : styles.aiBadgeOff]}>
            <Text style={[styles.aiBadgeText, aiEnabled ? styles.aiBadgeTextOn : styles.aiBadgeTextOff]}>
              {aiEnabled ? '利用可' : 'ローカル'}
            </Text>
          </View>
        </View>
      </View>

      {isWeb ? (
        <View style={styles.card}>
          <View style={styles.betaBody}>
            <Text style={styles.rowLabel}>Gemini API キー（Web版）</Text>
            <Text style={[styles.rowDesc, { marginTop: 4 }]}>
              Web版では AI 機能にご自身の Gemini API キーが必要です。
              {savedGeminiKey
                ? `　現在: ${maskGeminiApiKey(savedGeminiKey)}（${
                    isGeminiConfigured(settings) ? '有効' : '無効'
                  }）`
                : '　未設定'}
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder={savedGeminiKey ? '新しいキーで置き換える' : 'AIza... を貼り付け'}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.apiKeyActions}>
              <TouchableOpacity
                style={[styles.apiKeyBtn, styles.apiKeyBtnPrimary]}
                onPress={handleSaveApiKey}
                activeOpacity={0.85}
              >
                <Text style={styles.apiKeyBtnPrimaryText}>保存</Text>
              </TouchableOpacity>
              {savedGeminiKey ? (
                <TouchableOpacity
                  style={styles.apiKeyBtn}
                  onPress={handleClearApiKey}
                  activeOpacity={0.85}
                >
                  <Text style={styles.apiKeyBtnText}>削除</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {apiKeyMessage ? <Text style={styles.dataMessage}>{apiKeyMessage}</Text> : null}
            <Text style={styles.betaNote}>
              キーは
              <Text
                style={styles.linkText}
                onPress={() => {
                  void Linking.openURL('https://aistudio.google.com/apikey');
                }}
              >
                {' '}Google AI Studio{' '}
              </Text>
              で無料取得できます。この端末（ブラウザ）内にのみ保存され、外部には送信しません。
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.groupTitle}>生活リズム</Text>
      <TouchableOpacity style={styles.card} onPress={onOpenRoutines} activeOpacity={0.8}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>起床・就寝と固定予定</Text>
            <Text style={styles.rowDesc}>
              {minutesToTime(settings.wakeMinutes)}–{minutesToTime(settings.sleepMinutes)} ・
              通勤や授業などを設定
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

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

      <Text style={styles.groupTitle}>データ</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>バックアップをエクスポート</Text>
            <Text style={styles.rowDesc}>
              タスク・予定・ふりかえり・学習データを JSON で保存（端末内のみ）
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.dataBtn, dataBusy && styles.dataBtnDisabled]}
            onPress={() => {
              void handleExportData();
            }}
            disabled={!onExportData || dataBusy}
            activeOpacity={0.85}
          >
            <Text style={styles.dataBtnText}>エクスポート</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>すべてリセット</Text>
            <Text style={styles.rowDesc}>端末内の {APP_NAME} データを初期状態に戻します</Text>
          </View>
          <TouchableOpacity
            style={[styles.dataBtnDanger, dataBusy && styles.dataBtnDisabled]}
            onPress={confirmResetData}
            disabled={!onResetData || dataBusy}
            activeOpacity={0.85}
          >
            <Text style={styles.dataBtnDangerText}>リセット</Text>
          </TouchableOpacity>
        </View>
        {dataMessage ? <Text style={styles.dataMessage}>{dataMessage}</Text> : null}
        <Text style={styles.dataNote}>
          データはこの端末にのみ保存されています。機種変更前にエクスポートしてください。
        </Text>
      </View>

      <Text style={styles.groupTitle}>アプリ</Text>
      {onShowOnboarding ? (
        <TouchableOpacity style={styles.card} onPress={onShowOnboarding} activeOpacity={0.8}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>使い方ガイド</Text>
              <Text style={styles.rowDesc}>{APP_NAME} の基本操作をもう一度見る</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.groupTitle}>ベータ</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>バージョン</Text>
            <Text style={styles.rowDesc}>{appVersionLabel()}</Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.betaBody}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {
              void Linking.openURL(BETA_FEEDBACK_URL);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.linkText}>フィードバックを送る ›</Text>
          </TouchableOpacity>
          <Text style={styles.betaNote}>
            TestFlight ベータ版です。不具合や改善のご意見をお寄せください。
          </Text>
        </View>
      </View>

      <View style={[styles.card, styles.infoCard]}>
        <Text style={styles.infoText}>
          分刻みの予定も最小高さを確保して読みやすく表示します。重なる予定は横に並べます。
        </Text>
        <Text style={[styles.infoMuted, { marginTop: 12 }]}>
          {APP_AI_LABEL} はコーチ・ふりかえり・所要時間推定などの言語理解に使います。ベータは Cloud AI プロキシ経由です。
        </Text>
        <Text style={styles.infoMuted}>{APP_NAME} · {appVersionLabel()}</Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
    gap: 12,
  },
  rowInfo: { flex: 1, minWidth: 0 },
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
  stepValue: { minWidth: 52, textAlign: 'center', fontWeight: '600', fontSize: 14, color: theme.text },
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
  weekBtnTextActive: { color: theme.onAccent },
  infoCard: { padding: 16 },
  infoText: { fontSize: 14, lineHeight: 22, color: theme.text },
  infoMuted: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
  chevron: { fontSize: 22, color: theme.textTertiary, fontWeight: '300' },
  aiBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  aiBadgeOn: { backgroundColor: theme.accentSoft },
  aiBadgeOff: { backgroundColor: theme.secondary },
  aiBadgeText: { fontSize: 13, fontWeight: '700' },
  aiBadgeTextOn: { color: theme.accent },
  aiBadgeTextOff: { color: theme.textSecondary },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  bannerOn: { backgroundColor: theme.accentSoft },
  bannerOff: { backgroundColor: theme.secondary },
  bannerTitle: { fontSize: 14, fontWeight: '800' },
  bannerTitleOn: { color: theme.accent },
  bannerTitleOff: { color: theme.textSecondary },
  bannerDesc: { fontSize: 12, lineHeight: 18, color: theme.textSecondary, marginTop: 4 },
  aiPlanBody: { padding: 14, gap: 10 },
  aiPlanNote: { fontSize: 12, lineHeight: 18, color: theme.textTertiary },
  linkRow: { alignSelf: 'flex-start' },
  linkText: { fontSize: 13, fontWeight: '700', color: theme.accent },
  dataBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.accentSoft,
    },
    dataBtnText: { fontSize: 13, fontWeight: '700', color: theme.accent },
    dataBtnDanger: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.eventColors.red.bg,
      borderWidth: 1,
      borderColor: theme.eventColors.red.border,
    },
    dataBtnDangerText: { fontSize: 13, fontWeight: '700', color: theme.eventColors.red.text },
    dataBtnDisabled: { opacity: 0.45 },
    dataMessage: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSecondary,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    dataNote: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textTertiary,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    betaBody: { padding: 14, gap: 10 },
    betaNote: { fontSize: 12, lineHeight: 18, color: theme.textTertiary },
    apiKeyInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.separator,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.bg,
    },
    apiKeyActions: { flexDirection: 'row', gap: 10 },
    apiKeyBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: theme.accentSoft,
    },
    apiKeyBtnText: { fontSize: 14, fontWeight: '700', color: theme.accent },
    apiKeyBtnPrimary: { backgroundColor: theme.accent },
    apiKeyBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  });
