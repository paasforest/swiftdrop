import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { typography, resolveColor } from '../../theme/theme';

const VARIANTS = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'body',
  small: 'small',
  label: 'label',
};

export default function AppText({
  variant = 'body',
  color,
  children,
  style,
  ...rest
}) {
  const base = typography[VARIANTS[variant] ? variant : 'body'];
  const colorStyle = color ? { color: resolveColor(color) } : {};
  return (
    <Text style={[base, colorStyle, style]} {...rest}>
      {children}
    </Text>
  );
}
