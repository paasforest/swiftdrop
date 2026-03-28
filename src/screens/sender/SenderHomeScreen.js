import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { clearAuth } from '../../authStore';
import { theme } from '../../theme/theme';

export default function SenderHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>SwiftDrop</Text>
      <Text style={styles.label}>Sender home — coming next</Text>
      <TouchableOpacity
        style={styles.logout}
        onPress={async () => {
          await signOut(auth);
          clearAuth();
        }}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.obsidian, alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordmark: { fontSize: 28, fontWeight: '700', color: theme.colors.volt, letterSpacing: -0.5 },
  label: { fontSize: 13, color: theme.colors.textOnDarkMuted },
  logout: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  logoutText: { fontSize: 13, color: theme.colors.textOnDark },
});
