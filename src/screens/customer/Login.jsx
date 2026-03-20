import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView } from 'react-native';
import { postJson } from '../../apiClient';
import { setAuth } from '../../authStore';
import { resetToRoleHome } from '../../navigationHelpers';

const { width, height } = Dimensions.get('window');

/** Strip zero-width / BOM (common when copy-pasting email/password from chat). */
function cleanLoginInput(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
}

const Login = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
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

    // Drop '+' for normalization
    if (v.startsWith('+')) v = v.slice(1);

    // If local format starts with 0, convert to +27
    if (v.startsWith('0')) v = `27${v.slice(1)}`;

    // If they typed full country code "27..."
    if (v.startsWith('27')) return `+${v}`;

    // 9-digit local mobile without leading 0 (SA mobiles usually start with 6, 7, or 8)
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

      if (__DEV__) {
        console.log('[Login] sending', { emailLen: email.length, passwordLen: password.length });
      }

      const data = await postJson('/api/auth/login', {
        email,
        password,
      });

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
    console.log('[Register] Button pressed');
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      console.log('[Register] Validating fields...');
      if (!registerName || !registerEmail || !registerPassword || !confirmPassword) {
        console.log('[Register] Missing fields');
        setErrorMessage('Please fill in all registration fields.');
        return;
      }
      if (registerPassword.length < 8) {
        console.log('[Register] Password too short');
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }
      if (registerPassword !== confirmPassword) {
        console.log('[Register] Passwords do not match');
        setErrorMessage('Passwords do not match.');
        return;
      }

      const phone = normalizePhoneForApi(registerPhone);
      console.log('[Register] Normalized phone:', phone);
      if (!phone) {
        setErrorMessage('Enter a valid South African phone number.');
        return;
      }

      console.log('[Register] Calling API...');
      const data = await postJson('/api/auth/register-customer', {
        full_name: registerName,
        email: registerEmail.trim(),
        phone,
        password: registerPassword,
      });

      // When REQUIRE_PHONE_VERIFICATION=false on the server, register returns tokens and skips OTP.
      if (data.phoneVerificationRequired === false && data.token && data.refreshToken) {
        console.log('[Register] Server skipped phone verification; signing in.');
        setAuth({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        resetToRoleHome(navigation, data.user);
        return;
      }

      console.log('[Register] Success! Navigating to OTP...');
      navigation.navigate('OTPScreen', { phone });
    } catch (err) {
      console.error('[Register] Error:', err.message);
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    console.log('Google sign in');
  };

  const handleForgotPassword = () => {
    console.log('Forgot password');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>SwiftDrop</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'login' && styles.activeTab]}
            onPress={() => setActiveTab('login')}
          >
            <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'register' && styles.activeTab]}
            onPress={() => setActiveTab('register')}
          >
            <Text style={[styles.tabText, activeTab === 'register' && styles.activeTabText]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Login Form */}
        {activeTab === 'login' && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={[styles.loginButton, isSubmitting && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              <Text style={styles.loginButtonText}>{isSubmitting ? 'Logging in...' : 'Login'}</Text>
            </TouchableOpacity>

            {/* Driver registration */}
            <TouchableOpacity
              style={styles.driverRegisterButton}
              onPress={() => navigation.navigate('DriverRegister')}
              disabled={isSubmitting}
            >
              <Text style={styles.driverRegisterButtonText}>Register as Driver</Text>
            </TouchableOpacity>

            {/* Customer registration */}
            <TouchableOpacity
              onPress={() => setActiveTab('register')}
              disabled={isSubmitting}
              style={styles.customerRegisterLink}
            >
              <Text style={styles.customerRegisterLinkText}>Register as Customer</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={registerName}
              onChangeText={setRegisterName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={styles.phoneContainer}>
              <Text style={styles.phonePrefix}>+27</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="Phone Number"
                value={registerPhone}
                onChangeText={setRegisterPhone}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={registerPassword}
                onChangeText={setRegisterPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeText}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={[styles.registerButton, isSubmitting && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              <Text style={styles.registerButtonText}>{isSubmitting ? 'Registering...' : 'Create Account'}</Text>
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
    width: width,
    height: height,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
  eyeText: {
    fontSize: 20,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  phonePrefix: {
    padding: 16,
    fontSize: 16,
    color: '#666666',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  forgotPassword: {
    color: '#1A73E8',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  driverRegisterButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1A73E8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  driverRegisterButtonText: {
    color: '#1A73E8',
    fontSize: 16,
    fontWeight: '700',
  },
  customerRegisterLink: {
    alignItems: 'center',
    marginBottom: 10,
  },
  customerRegisterLinkText: {
    color: '#1A73E8',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  registerButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666666',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#d93025',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default Login;
