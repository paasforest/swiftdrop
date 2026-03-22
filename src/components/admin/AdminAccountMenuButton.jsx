import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { showAdminAccountMenu } from '../../utils/adminLogout';

export default function AdminAccountMenuButton({ navigation }) {
  return (
    <Pressable
      onPress={() => showAdminAccountMenu(navigation)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Account and log out"
    >
      <Ionicons name="person-circle-outline" size={28} color={colors.textWhite} />
    </Pressable>
  );
}
