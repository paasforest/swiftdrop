import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** White parcel/box icon for gradient headers — 44×44 viewBox */
export default function ParcelLogoIcon({ size = 44, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <Rect x={4} y={8} width={36} height={28} rx={4} stroke={color} strokeWidth={2} fill="none" />
      <Path d="M4 16 L22 24 L40 16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M22 8 L22 36" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}
