import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/theme';

/**
 * Round driver photo or primary-colored initial fallback (customer trust UI).
 */
export default function DriverAvatar({ uri, name, size = 56 }) {
  const trimmed = name != null ? String(name).trim() : '';
  const initial = (trimmed.charAt(0) || 'D').toUpperCase();
  const r = size / 2;
  const photo = uri != null ? String(uri).trim() : '';

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[styles.image, { width: size, height: size, borderRadius: r }]}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.initialText, { fontSize: Math.round(size * 0.39) }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  fallback: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: colors.textWhite,
    fontWeight: 'bold',
  },
});
