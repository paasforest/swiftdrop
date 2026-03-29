import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

export default function SplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  const markPulse = useRef(new Animated.Value(1)).current;
  const barSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 700,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(markPulse, {
          toValue: 1.03,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(markPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(barSlide, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(barSlide, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fade, rise, markPulse, barSlide]);

  const barTranslate = barSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [-56, 56],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#14141F', theme.colors.obsidian, '#050508']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft top glow */}
      <LinearGradient
        colors={['rgba(232,255,0,0.08)', 'transparent']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fade,
              transform: [{ translateY: rise }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.markWrap,
              { transform: [{ scale: markPulse }] },
            ]}
          >
            <View style={styles.markOuter}>
              <View style={styles.mark}>
                <Text style={styles.markIcon}>→</Text>
              </View>
            </View>
          </Animated.View>

          <Text style={styles.wordmark}>SwiftDrop</Text>
          <Text style={styles.wordmarkHint}>same-day parcels</Text>

          <View style={styles.rule} />

          <Text style={styles.tagline}>PARCELS · DELIVERED</Text>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                { transform: [{ translateX: barTranslate }] },
              ]}
            />
          </View>
          <Text style={styles.footerLabel}>PREPARING</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  markWrap: {
    marginBottom: theme.spacing.xl,
  },
  markOuter: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
    backgroundColor: 'rgba(232,255,0,0.04)',
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.volt,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  mark: {
    width: 76,
    height: 76,
    backgroundColor: theme.colors.volt,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markIcon: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.obsidian,
    marginTop: -2,
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: theme.typography.tight,
  },
  wordmarkHint: {
    marginTop: 6,
    fontSize: theme.typography.sm,
    fontWeight: '500',
    color: theme.colors.textOnDarkMuted,
    letterSpacing: theme.typography.wide,
  },
  rule: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.32)',
    letterSpacing: 3.2,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
  },
  barTrack: {
    width: 120,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  barFill: {
    position: 'absolute',
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.volt,
    opacity: 0.9,
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.28)',
  },
});
