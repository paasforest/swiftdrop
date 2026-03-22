import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { confirmAdminLogout } from '../../utils/adminLogout';

export default function AdminLogoutIconButton({ navigation }) {
  return (
    <Pressable
      onPress={() => confirmAdminLogout(navigation)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Log out"
    >
      <Ionicons name="log-out-outline" size={22} color={colors.textWhite} />
    </Pressable>
  );
}
