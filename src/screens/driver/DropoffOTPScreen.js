import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../services/firebaseConfig';
import { postJson } from '../../apiClient';
import { theme } from '../../theme/theme';

export default function DriverDropoffOTPScreen({ route, navigation }) {
  const { booking } = route.params;
  const bookingId = booking?.bookingId || booking?.id;

  const [digits, setDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const otp = digits.join('');
  const canSubmit = otp.length === 4 && !loading;

  const handleChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyPress = ({ nativeEvent: { key } }, index) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await postJson(
        `/api/bookings/${bookingId}/verify-dropoff-otp`,
        { otp },
        { token }
      );
      navigation.replace('PhotoUpload', { booking, stage: 'dropoff' });
    } catch (err) {
      if (err.code === 'WRONG_OTP' || err.status === 400) {
        shake();
        setDigits(['', '', '', '']);
        inputRefs[0].current?.focus();
        Alert.alert('Incorrect code', 'Ask the receiver to read it again.');
      } else {
        Alert.alert('Error', 'Could not verify OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const allFilled = otp.length === 4;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Enter drop-off code</Text>
      <Text style={styles.subtitle}>Ask the receiver to read you their 4-digit code</Text>

      <Animated.View
        style={[styles.digitsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={inputRefs[i]}
            style={[
              styles.digitBox,
              allFilled && styles.digitBoxFilled,
              d && styles.digitBoxActive,
            ]}
            value={d}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectionColor={theme.colors.signalGreen}
            caretHidden
          />
        ))}
      </Animated.View>

      <TouchableOpacity
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
        onPress={handleConfirm}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={theme.colors.textLight} />
          : <Text style={styles.ctaText}>Confirm delivery</Text>
        }
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    top: 56,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: theme.colors.text },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 48,
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 48,
  },
  digitBox: {
    width: 64,
    height: 72,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  digitBoxActive: { borderColor: theme.colors.obsidian },
  digitBoxFilled: {
    borderColor: theme.colors.signalGreen,
    backgroundColor: 'rgba(74,222,128,0.06)',
  },
  cta: { ...theme.components.ctaButton },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...theme.components.ctaButtonText },
});
