import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { APP_NAME, APP_TAGLINE } from '../../config/brand';
import { Theme, useThemedStyles } from '../../theme';

interface LooperBootScreenProps {
  showSpinner?: boolean;
}

export function LooperBootScreen({ showSpinner = true }: LooperBootScreenProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <View style={styles.glyphCircle}>
          <Svg width={44} height={44} viewBox="0 0 44 44">
            <Circle cx={22} cy={22} r={16} stroke="#5C6F9E" strokeWidth={2.5} fill="none" />
            <Circle cx={22} cy={22} r={5} fill="#5C6F9E" />
          </Svg>
        </View>
        <Text style={styles.brand}>{APP_NAME}</Text>
        <Text style={styles.tagline}>{APP_TAGLINE}</Text>
      </View>
      {showSpinner ? <ActivityIndicator style={styles.spinner} color="#5C6F9E" /> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg,
      paddingHorizontal: 24,
    },
    logoWrap: {
      alignItems: 'center',
    },
    glyphCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    brand: {
      fontSize: 34,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: 0.5,
    },
    tagline: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: theme.accent,
      letterSpacing: 2,
    },
    spinner: {
      marginTop: 36,
    },
  });
