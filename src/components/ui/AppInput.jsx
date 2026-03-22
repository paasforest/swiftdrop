import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Platform } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

const INPUT_HEIGHT = 56;

export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  editable = true,
  style,
  inputStyle,
  rightAccessory,
  prefix,
  /** 'primary' (blue) | 'accent' (orange) for focus border */
  accent = 'primary',
}) {
  const [focused, setFocused] = useState(false);
  const focusColor = accent === 'accent' ? colors.accent : colors.primary;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.row,
          prefix ? styles.rowWithPrefix : null,
          { borderColor: focused ? focusColor : colors.border },
        ]}
      >
        {prefix ? <View style={styles.prefixWrap}>{prefix}</View> : null}
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightAccessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: INPUT_HEIGHT,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  rowWithPrefix: {
    paddingHorizontal: 0,
  },
  prefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    minHeight: INPUT_HEIGHT,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: INPUT_HEIGHT - 2,
  },
});
