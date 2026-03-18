import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView } from 'react-native';

const { width, height } = Dimensions.get('window');

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

  const handleLogin = () => {
    // Navigate to Home screen after "login"
    navigation.navigate('Home');
  };

  const handleRegister = () => {
    // Navigate to Home screen after "registration"
    navigation.navigate('Home');
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

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Login</Text>
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

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
              <Text style={styles.registerButtonText}>Create Account</Text>
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
});

export default Login;
