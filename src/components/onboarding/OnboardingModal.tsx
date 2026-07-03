import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { APP_NAME } from '../../config/brand';
import { FullScreenSafeArea } from '../common/FullScreenSafeArea';
import { modalAnimation } from '../common/modalAnimation';
import { Theme, useThemedStyles } from '../../theme';

interface OnboardingSlide {
  glyph: string;
  title: string;
  body: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    glyph: '◎',
    title: 'Today が毎朝のホーム',
    body: `タスクを入れて Today を開くと、${APP_NAME} が今日の流れを自動で組み立てます。`,
  },
  {
    glyph: '◉',
    title: `${APP_NAME}に入る = 集中開始`,
    body: 'ボタンを押すと Focus モードが始まります。予定の再生成はしません。',
  },
  {
    glyph: '✦',
    title: '夜のふりかえりで学習',
    body: `1日を振り返ると ${APP_NAME} があなたを学習し、明日のプランが少しずつ賢くなります。`,
  },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const styles = useThemedStyles(makeStyles);
  const [index, setIndex] = useState(0);

  const slide = SLIDES[index];
  const isLast = index >= SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onComplete();
      setIndex(0);
      return;
    }
    setIndex((value) => value + 1);
  };

  const skip = () => {
    onComplete();
    setIndex(0);
  };

  return (
    <Modal
      visible={isOpen}
      animationType={modalAnimation('fade')}
      presentationStyle="fullScreen"
      onRequestClose={skip}
    >
      <FullScreenSafeArea style={styles.container}>
        <View style={styles.header}>
          {!isLast ? (
            <TouchableOpacity onPress={skip} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.skipText}>スキップ</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.glyphCircle}>
            <Text style={styles.glyph}>{slide.glyph}</Text>
          </View>
          <Text style={styles.kicker}>{APP_NAME}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.body}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((item, dotIndex) => (
              <View
                key={item.title}
                style={[styles.dot, dotIndex === index && styles.dotActive]}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{isLast ? 'はじめる' : '次へ'}</Text>
          </TouchableOpacity>
        </View>
      </FullScreenSafeArea>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    header: {
      minHeight: 32,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    skipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textTertiary,
    },
    skipPlaceholder: { height: 32 },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    glyphCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    glyph: {
      fontSize: 36,
      color: theme.accent,
      fontWeight: '700',
    },
    kicker: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.accent,
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      lineHeight: 34,
    },
    description: {
      fontSize: 16,
      lineHeight: 26,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      maxWidth: 320,
    },
    footer: {
      gap: 20,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.secondary,
    },
    dotActive: {
      backgroundColor: theme.accent,
      width: 20,
    },
    primaryBtn: {
      backgroundColor: theme.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '800',
    },
  });
