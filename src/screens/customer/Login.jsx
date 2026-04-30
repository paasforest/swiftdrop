import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';

function cleanLoginInput(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
}

const Login = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizePhoneForApi = (phoneInput) => {
    let v = String(phoneInput ?? '').trim();
    v = v.replace(/\s+/g, '');
    if (v.startsWith('+')) v = v.slice(1);
    if (v.startsWith('0')) v = `27${v.slice(1)}`;
    if (v.startsWith('27')) return `+${v}`;
    if (/^[678]\d{8}$/.test(v)) return `+27${v}`;
    return '';
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const email = cleanLoginInput(loginEmail).toLowerCase();
      const password = cleanLoginInput(loginPassword);
      if (!email || !password) {
        setErrorMessage('Email and password are required.');
        return;
      }

      const data = await postJson('/api/auth/login', { email, password });

      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      resetToRoleHome(navigation, data.user);
    } catch (err) {
      setErrorMessage(err.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (!registerName || !registerEmail || !registerPassword || !confirmPassword) {
        setErrorMessage('Please fill in all registration fields.');
        return;
      }
      if (registerPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }
      if (registerPassword !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      const phone = normalizePhoneForApi(registerPhone);
      if (!phone) {
        setErrorMessage('Enter a valid South African phone number.');
        return;
      }

      const data = await postJson('/api/auth/register-customer', {
        full_name: registerName,
        email: registerEmail.trim(),
        phone,
        password: registerPassword,
      });

      if (data.phoneVerificationRequired === false && data.token && data.refreshToken) {
        setAuth({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        resetToRoleHome(navigation, data.user);
        return;
      }

      navigation.navigate('OTPScreen', { phone });
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {};
  const handleForgotPassword = () => {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.brandName}>SwiftDrop</Text>
          <Text style={styles.brandTagline}>Deliver with people going your way</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'login' && styles.activeTab]}
            onPress={() => setActiveTab('login')}
          >
            <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'register' && styles.activeTab]}
            onPress={() => setActiveTab('register')}
          >
            <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Login form */}
        {activeTab === 'login' && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Email or phone"
              placeholderTextColor="#BDBDBD"
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInputInner}
                placeholder="Password"
                placeholderTextColor="#BDBDBD"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#9E9E9E"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </TouchableOpacity>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Logging in…' : 'Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.outlineButton, { marginTop: 12 }]}
              onPress={() => navigation.navigate('DriverRegister')}
              disabled={isSubmitting}
            >
              <Text style={styles.outlineButtonText}>Register as driver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('register')}
              disabled={isSubmitting}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>Register as customer</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              activeOpacity={0.85}
            >
              <Ionicons
                name="logo-google"
                size={20}
                color="#9E9E9E"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.googleText}>Sign in with Google</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Register form */}
        {activeTab === 'register' && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Full name"
              placeholderTextColor="#BDBDBD"
              value={registerName}
              onChangeText={setRegisterName}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Email"
              placeholderTextColor="#BDBDBD"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.phoneContainer}>
              <Text style={styles.phonePrefix}>+27</Text>
              <TextInput
                style={styles.phoneInputInner}
                placeholder="Phone number"
                placeholderTextColor="#BDBDBD"
                value={registerPhone}
                onChangeText={setRegisterPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInputInner}
                placeholder="Password"
                placeholderTextColor="#BDBDBD"
                value={registerPassword}
                onChangeText={setRegisterPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#9E9E9E"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInputInner}
                placeholder="Confirm password"
                placeholderTextColor="#BDBDBD"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={8}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#9E9E9E"
                />
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Registering…' : 'Create account'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9E9E9E',
  },
  tabTextActive: {
    fontWeight: '700',
    color: '#000000',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#000000',
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    marginBottom: 12,
    paddingRight: 4,
  },
  passwordInputInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#000000',
  },
  eyeBtn: {
    padding: 10,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    marginBottom: 12,
  },
  phonePrefix: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  phoneInputInner: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#000000',
  },
  forgot: {
    textAlign: 'right',
    marginBottom: 16,
    color: '#9E9E9E',
    fontSize: 13,
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  outlineButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  outlineButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  linkWrap: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  link: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    color: '#9E9E9E',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    borderRadius: 14,
  },
  googleText: {
    color: '#9E9E9E',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default Login;
