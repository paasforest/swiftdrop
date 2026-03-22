import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '../../theme/theme';

const HEIGHT = 56;
const R = radius.md;

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    fullWidth && styles.fullWidth,
    variant === 'primary' && styles.primary,
    variant === 'accent' && styles.accent,
    variant === 'outline' && styles.outline,
    variant === 'outlineAccent' && styles.outlineAccent,
    variant === 'outlineDanger' && styles.outlineDanger,
    variant === 'success' && styles.success,
    variant === 'danger' && styles.danger,
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    variant === 'outline' && styles.labelOutline,
    variant === 'outlineAccent' && styles.labelOutlineAccent,
    variant === 'outlineDanger' && styles.labelOutlineDanger,
    variant === 'success' && styles.label,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'outline'
              ? colors.primary
              :     variant === 'outlineAccent'
                ? colors.accent
                : variant === 'outlineDanger'
                  ? colors.danger
                  : variant === 'success'
                    ? colors.textWhite
                    : colors.textWhite
          }
        />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: HEIGHT,
    borderRadius: R,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineAccent: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  outlineDanger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  success: {
    backgroundColor: colors.success,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textWhite,
  },
  labelOutline: {
    color: colors.primary,
  },
  labelOutlineAccent: {
    color: colors.accent,
  },
  labelOutlineDanger: {
    color: colors.danger,
  },
});
