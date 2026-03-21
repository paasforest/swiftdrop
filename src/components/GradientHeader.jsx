/**
 * Header “gradient” using only Views — no react-native-svg, no expo-linear-gradient.
 * Base blue + semi-transparent darker overlay for depth.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

const GradientHeader = ({ children, style }) => (
  <View
    style={[
      {
        backgroundColor: colors.primary,
        paddingTop: 48,
        paddingBottom: 20,
        paddingHorizontal: 20,
        overflow: 'hidden',
        position: 'relative',
      },
      style,
    ]}
    collapsable={false}
  >
    <View
      pointerEvents="none"
      style={styles.overlay}
    />
    <View style={styles.content} collapsable={false}>
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '60%',
    height: '100%',
    backgroundColor: colors.gradientEnd,
    opacity: 0.4,
    borderTopLeftRadius: 100,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GradientHeader;
