import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../../theme/theme';

/**
 * Empty: dashed blue border. Uploaded: green border + thumbnail.
 */
export default function UploadDocumentCard({
  title,
  subtitle = 'Tap to upload',
  uploaded,
  onPress,
  thumbnailUri,
  accent = 'primary',
}) {
  const borderColor = uploaded
    ? colors.success
    : accent === 'accent'
      ? '#BFDBFE'
      : '#BFDBFE';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.card,
        uploaded ? styles.cardUploaded : styles.cardEmpty,
        { borderColor },
      ]}
    >
      {uploaded ? (
        <View style={styles.leftOk}>
          <Ionicons name="checkmark" size={18} color={colors.textWhite} />
        </View>
      ) : (
        <View style={styles.leftIcon}>
          <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.mid}>
        <Text style={[styles.title, uploaded && styles.titleOk]}>{title}</Text>
        <Text style={[styles.sub, uploaded && styles.subOk]}>
          {uploaded ? 'Uploaded ✓' : subtitle}
        </Text>
      </View>
      {uploaded && thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.thumb} />
      ) : (
        <Ionicons name="add-circle-outline" size={26} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardEmpty: {
    backgroundColor: colors.surface,
  },
  cardUploaded: {
    backgroundColor: colors.successLight,
  },
  leftOk: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  leftIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  mid: {
    flex: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  titleOk: {
    color: colors.success,
  },
  sub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subOk: {
    color: colors.success,
    fontWeight: '600',
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
