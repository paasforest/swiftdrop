import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import { colors } from '../../theme/theme';

const SIZE = 140;

/** Screen 1 — parcel box */
export function ArtParcel() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
      <Rect x="20" y="35" width="60" height="45" rx="4" fill={colors.primary} opacity={0.9} />
      <Path d="M20 45 L50 30 L80 45" stroke={colors.primaryDark} strokeWidth="3" fill="none" />
      <Rect x="42" y="48" width="16" height="12" rx="2" fill={colors.textWhite} opacity={0.9} />
    </Svg>
  );
}

/** Screen 2 — pin + route */
export function ArtLocation() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
      <Path
        d="M50 18 C38 18 28 28 28 40 C28 55 50 78 50 78 S72 55 72 40 C72 28 62 18 50 18 Z"
        fill={colors.primary}
      />
      <Circle cx="50" cy="38" r="8" fill={colors.textWhite} />
      <Line x1="20" y1="88" x2="80" y2="88" stroke={colors.border} strokeWidth="4" strokeLinecap="round" />
      <Circle cx="25" cy="88" r="5" fill={colors.success} />
      <Circle cx="75" cy="88" r="5" fill={colors.accent} />
    </Svg>
  );
}

/** Screen 3 — shield + check */
export function ArtShield() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
      <Path
        d="M50 15 L78 28 L78 52 C78 72 50 88 50 88 S22 72 22 52 L22 28 Z"
        fill={colors.primaryLight}
        stroke={colors.primary}
        strokeWidth="3"
      />
      <Path
        d="M38 52 L46 60 L64 42"
        stroke={colors.success}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function OnboardingSlideArt({ index }) {
  switch (index) {
    case 0:
      return <ArtParcel />;
    case 1:
      return <ArtLocation />;
    case 2:
      return <ArtShield />;
    default:
      return <ArtParcel />;
  }
}
