import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';
import { getAuth, setAuth } from '../../authStore';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';
import { AppButton, AppInput } from '../../components/ui';
import { TERMS_PRIVACY_URL } from '../../config/legal';

function normalizeAssetType(type) {
  if (type && typeof type === 'string' && type.startsWith('image/')) return type;
  return 'image/jpeg';
}

function fileNameFromUri(uri, fallback) {
  const parts = String(uri).split('/');
  const last = parts[parts.length - 1];
  if (last && last.includes('.')) return last;
  return fallback;
}

function normalizePhoneForApi(phoneInput) {
  let v = String(phoneInput ?? '').trim();
  v = v.replace(/\s+/g, '');
  if (v.startsWith('+')) v = v.slice(1);
  if (v.startsWith('0')) v = `27${v.slice(1)}`;
  if (v.startsWith('27')) return `+${v}`;
  if (/^[678]\d{8}$/.test(v)) return `+27${v}`;
  return '';
}

function ProgressHeader({ step, title }) {
  const pct = (step / 4) * 100;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{title}</Text>
    </View>
  );
}

function UploadCard({ title, subtitle, uploaded, asset, onPress, emptyIcon = 'document-text-outline' }) {
  const has = Boolean(uploaded && asset?.uri);
  return (
    <TouchableOpacity
      style={[styles.uploadCard, has ? styles.uploadCardDone : styles.uploadCardEmpty]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {has ? (
        <View style={styles.uploadLeftDone}>
          <Ionicons name="checkmark" size={16} color={colors.textWhite} />
        </View>
      ) : (
        <View style={styles.uploadLeftEmpty}>
          <Ionicons name={emptyIcon} size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.uploadMid}>
        <Text style={[styles.uploadTitle, has && { color: colors.success }]}>{title}</Text>
        <Text style={[styles.uploadSub, has && { color: colors.success }]}>
          {has ? 'Uploaded ✓' : subtitle}
        </Text>
      </View>
      {has && asset?.uri ? (
        <Image source={{ uri: asset.uri }} style={styles.uploadThumb} />
      ) : (
        <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
}

export default function DriverRegister({ navigation }) {
  const [step, setStep] = useState(1);
  const [applicationPath, setApplicationPath] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uberProfileScreenshot, setUberProfileScreenshot] = useState(null);
  const [vehiclePhotoExisting, setVehiclePhotoExisting] = useState(null);

  const [nationalId, setNationalId] = useState(null);
  const [driversLicense, setDriversLicense] = useState(null);
  const [vehicleRegistration, setVehicleRegistration] = useState(null);
  const [licenseDisc, setLicenseDisc] = useState(null);
  const [sapsClearance, setSapsClearance] = useState(null);
  const [vehiclePhotoFront, setVehiclePhotoFront] = useState(null);
  const [vehiclePhotoBack, setVehiclePhotoBack] = useState(null);
  const [vehiclePhotoSide, setVehiclePhotoSide] = useState(null);

  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [successPath, setSuccessPath] = useState(null);
  const [checkScale] = useState(() => new Animated.Value(0.3));

  const phonePrefixEl = (
    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>+27</Text>
  );

  const requestPickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload documents.');
      return null;
    }
    return true;
  }, []);

  const pickSingleImage = useCallback(
    async (setter) => {
      const ok = await requestPickImage();
      if (!ok) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setter({
        uri: asset.uri,
        type: normalizeAssetType(asset.type),
        fileName: asset.fileName || fileNameFromUri(asset.uri, 'upload.jpg'),
      });
    },
    [requestPickImage]
  );

  const validateStep1 = () => applicationPath != null;

  const validateStep2 = () => {
    if (!fullName.trim()) return 'Full name is required.';
    if (!email.trim()) return 'Email is required.';
    if (!normalizePhoneForApi(phone)) return 'Enter a valid South African phone number.';
    if (!password || password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const validateStep3Uber = () =>
    profilePhoto && uberProfileScreenshot && vehiclePhotoExisting ? null : 'Upload all required documents.';

  const validateStep3New = () =>
    profilePhoto &&
    nationalId &&
    driversLicense &&
    vehicleRegistration &&
    licenseDisc &&
    vehiclePhotoFront &&
    vehiclePhotoBack &&
    vehiclePhotoSide
      ? null
      : 'Upload all required documents.';

  const validateStep4 = () => {
    if (!termsAccepted) return 'Please agree to the SwiftDrop terms to continue.';
    if (!vehicleMake.trim() || !vehicleModel.trim() || !vehicleYear.trim() || !vehicleColor.trim() || !vehiclePlate.trim()) {
      return 'Please complete all vehicle fields.';
    }
    return null;
  };

  const step3Ready = useMemo(() => {
    if (!applicationPath) return false;
    if (applicationPath === 'uber_bolt') return !validateStep3Uber();
    return !validateStep3New();
  }, [
    applicationPath,
    profilePhoto,
    uberProfileScreenshot,
    vehiclePhotoExisting,
    nationalId,
    driversLicense,
    vehicleRegistration,
    licenseDisc,
    vehiclePhotoFront,
    vehiclePhotoBack,
    vehiclePhotoSide,
  ]);

  const appendImageFile = (formData, key, asset) => {
    if (!asset) return;
    formData.append(key, {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `${key}.jpg`,
    });
  };

  const submitApplication = useCallback(async () => {
    if (hasSubmitted) return;
    const auth = getAuth();
    if (!auth?.token) throw new Error('Not signed in. Please verify OTP again.');
    if (!applicationPath) throw new Error('Missing application path.');

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('application_path', applicationPath);
      appendImageFile(formData, 'selfie', profilePhoto);

      if (applicationPath === 'uber_bolt') {
        appendImageFile(formData, 'uber_profile_screenshot', uberProfileScreenshot);
        appendImageFile(formData, 'vehicle_photo', vehiclePhotoExisting);
        formData.append('vehicle_make', vehicleMake.trim());
        formData.append('vehicle_model', vehicleModel.trim());
        formData.append('vehicle_year', vehicleYear.trim());
        formData.append('vehicle_color', vehicleColor.trim());
        formData.append('vehicle_plate', vehiclePlate.trim().toUpperCase());
      }

      if (applicationPath === 'new_driver') {
        appendImageFile(formData, 'national_id', nationalId);
        appendImageFile(formData, 'drivers_license', driversLicense);
        appendImageFile(formData, 'vehicle_registration', vehicleRegistration);
        appendImageFile(formData, 'license_disc', licenseDisc);
        appendImageFile(formData, 'saps_clearance', sapsClearance);
        appendImageFile(formData, 'vehicle_photo_front', vehiclePhotoFront);
        appendImageFile(formData, 'vehicle_photo_back', vehiclePhotoBack);
        appendImageFile(formData, 'vehicle_photo_side', vehiclePhotoSide);
        formData.append('vehicle_make', vehicleMake.trim());
        formData.append('vehicle_model', vehicleModel.trim());
        formData.append('vehicle_year', vehicleYear.trim());
        formData.append('vehicle_color', vehicleColor.trim());
        formData.append('vehicle_plate', vehiclePlate.trim().toUpperCase());
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/driver/submit-application`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formData,
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(json?.error || `Submit failed with HTTP ${res.status}`);
      }

      setHasSubmitted(true);
      setPendingSubmit(false);
      setSuccessPath(applicationPath);
      Animated.spring(checkScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    } finally {
      setBusy(false);
    }
  }, [
    hasSubmitted,
    applicationPath,
    profilePhoto,
    uberProfileScreenshot,
    vehiclePhotoExisting,
    nationalId,
    driversLicense,
    vehicleRegistration,
    licenseDisc,
    sapsClearance,
    vehiclePhotoFront,
    vehiclePhotoBack,
    vehiclePhotoSide,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    vehiclePlate,
    checkScale,
  ]);

  const handleRegisterAndOtp = async () => {
    const err = validateStep4();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(null);
    setBusy(true);
    try {
      const phoneNorm = normalizePhoneForApi(phone);
      const data = await postJson('/api/auth/register-driver', {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phoneNorm,
        password,
      });

      if (data.phoneVerificationRequired === false && data.token && data.refreshToken) {
        setAuth({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        await submitApplication();
        return;
      }

      setPendingSubmit(true);
      navigation.navigate('DriverOTPScreen', { phone: phoneNorm });
    } catch (e) {
      setErrorMessage(e.message || 'Driver registration failed');
    } finally {
      setBusy(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!pendingSubmit || hasSubmitted) return;
      const auth = getAuth();
      if (auth?.token) {
        submitApplication().catch((e) => {
          setErrorMessage(e.message || 'Submit failed');
          setPendingSubmit(false);
        });
      }
    }, [pendingSubmit, hasSubmitted, submitApplication])
  );

  useEffect(() => {
    if (applicationPath) {
      setPendingSubmit(false);
      setHasSubmitted(false);
      setSuccessPath(null);
    }
  }, [applicationPath]);

  const goNext = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (!validateStep1()) {
        setErrorMessage('Choose a registration path.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const e = validateStep2();
      if (e) {
        setErrorMessage(e);
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (applicationPath === 'uber_bolt') {
        const e = validateStep3Uber();
        if (e) {
          setErrorMessage(e);
          return;
        }
      } else {
        const e = validateStep3New();
        if (e) {
          setErrorMessage(e);
          return;
        }
      }
      setStep(4);
    }
  };

  const goBack = () => {
    setErrorMessage(null);
    if (step > 1) setStep((s) => s - 1);
    else navigation.goBack();
  };

  const openTerms = () => Linking.openURL(TERMS_PRIVACY_URL).catch(() => {});

  if (successPath) {
    const isUber = successPath === 'uber_bolt';
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.successScroll}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: checkScale }] }]}>
            <Ionicons name="checkmark" size={48} color={colors.textWhite} />
          </Animated.View>
          <Text style={styles.successTitle}>Application Submitted!</Text>
          <Text style={styles.successBody}>
            We will review your application and notify you via SMS.
          </Text>
          <Text style={styles.successHint}>
            {isUber ? 'Usually within 2 hours' : 'Usually within 24-48 hours'}
          </Text>
          <AppButton
            label="Back to Home"
            variant="primary"
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              })
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Driver</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <>
            <ProgressHeader step={1} title="Step 1 of 4 — Choose your path" />
            <TouchableOpacity
              style={[styles.pathCard, applicationPath === 'uber_bolt' && styles.pathUberSel]}
              onPress={() => setApplicationPath('uber_bolt')}
              activeOpacity={0.9}
            >
              <View style={[styles.pathIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="document-text" size={22} color={colors.primary} />
              </View>
              <View style={styles.pathMid}>
                <View style={styles.pathTitleRow}>
                  <Text style={styles.pathTitle}>Uber / Bolt driver</Text>
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>Fastest</Text>
                  </View>
                </View>
                <Text style={styles.pathSub}>Approved in 2 hours</Text>
              </View>
              <View style={[styles.radio, applicationPath === 'uber_bolt' && styles.radioUberOn]}>
                {applicationPath === 'uber_bolt' ? (
                  <Ionicons name="checkmark" size={14} color={colors.textWhite} />
                ) : null}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pathCard, applicationPath === 'new_driver' && styles.pathNewSel]}
              onPress={() => setApplicationPath('new_driver')}
              activeOpacity={0.9}
            >
              <View style={[styles.pathIconCircle, { backgroundColor: colors.background }]}>
                <Ionicons name="id-card-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.pathMid}>
                <View style={styles.pathTitleRow}>
                  <Text style={styles.pathTitle}>New driver</Text>
                  <View style={styles.badgeOrange}>
                    <Text style={styles.badgeOrangeText}>24-48 hrs</Text>
                  </View>
                </View>
                <Text style={styles.pathSub}>Full document verification</Text>
              </View>
              <View style={[styles.radio, applicationPath === 'new_driver' && styles.radioNewOn]}>
                {applicationPath === 'new_driver' ? (
                  <Ionicons name="checkmark" size={14} color={colors.textWhite} />
                ) : null}
              </View>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <ProgressHeader step={2} title="Step 2 of 4 — Personal details" />
            <AppInput
              accent="accent"
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
            />
            <AppInput
              accent="accent"
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="82 123 4567"
              keyboardType="phone-pad"
              prefix={phonePrefixEl}
            />
            <AppInput
              accent="accent"
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AppInput
              accent="accent"
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={!showPassword}
              rightAccessory={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />
            <AppInput
              accent="accent"
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              secureTextEntry={!showConfirmPassword}
              rightAccessory={
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />
          </>
        )}

        {step === 3 && applicationPath === 'uber_bolt' && (
          <>
            <ProgressHeader step={3} title="Step 3 of 4 — Documents" />
            <UploadCard
              title="Profile photo"
              subtitle="Tap to upload"
              uploaded={!!profilePhoto}
              asset={profilePhoto}
              onPress={() => pickSingleImage(setProfilePhoto)}
              emptyIcon="person-outline"
            />
            <UploadCard
              title="Uber / Bolt profile screenshot"
              subtitle="Tap to upload"
              uploaded={!!uberProfileScreenshot}
              asset={uberProfileScreenshot}
              onPress={() => pickSingleImage(setUberProfileScreenshot)}
            />
            <UploadCard
              title="Vehicle photo"
              subtitle="Tap to upload"
              uploaded={!!vehiclePhotoExisting}
              asset={vehiclePhotoExisting}
              onPress={() => pickSingleImage(setVehiclePhotoExisting)}
              emptyIcon="car-outline"
            />
            {!step3Ready ? (
              <Text style={styles.hintDisabled}>Upload all documents to continue</Text>
            ) : null}
          </>
        )}

        {step === 3 && applicationPath === 'new_driver' && (
          <>
            <ProgressHeader step={3} title="Step 3 of 4 — Documents" />
            <UploadCard
              title="Profile photo"
              subtitle="Tap to upload"
              uploaded={!!profilePhoto}
              asset={profilePhoto}
              onPress={() => pickSingleImage(setProfilePhoto)}
              emptyIcon="person-outline"
            />
            <UploadCard
              title="National ID"
              subtitle="Tap to upload"
              uploaded={!!nationalId}
              asset={nationalId}
              onPress={() => pickSingleImage(setNationalId)}
            />
            <UploadCard
              title="Driver's license"
              subtitle="Tap to upload"
              uploaded={!!driversLicense}
              asset={driversLicense}
              onPress={() => pickSingleImage(setDriversLicense)}
            />
            <UploadCard
              title="Vehicle registration"
              subtitle="Tap to upload"
              uploaded={!!vehicleRegistration}
              asset={vehicleRegistration}
              onPress={() => pickSingleImage(setVehicleRegistration)}
            />
            <UploadCard
              title="License disc"
              subtitle="Tap to upload"
              uploaded={!!licenseDisc}
              asset={licenseDisc}
              onPress={() => pickSingleImage(setLicenseDisc)}
            />
            <Text style={styles.sectionMini}>Vehicle photos</Text>
            <UploadCard
              title="Front"
              subtitle="Tap to upload"
              uploaded={!!vehiclePhotoFront}
              asset={vehiclePhotoFront}
              onPress={() => pickSingleImage(setVehiclePhotoFront)}
              emptyIcon="image-outline"
            />
            <UploadCard
              title="Back"
              subtitle="Tap to upload"
              uploaded={!!vehiclePhotoBack}
              asset={vehiclePhotoBack}
              onPress={() => pickSingleImage(setVehiclePhotoBack)}
              emptyIcon="image-outline"
            />
            <UploadCard
              title="Side"
              subtitle="Tap to upload"
              uploaded={!!vehiclePhotoSide}
              asset={vehiclePhotoSide}
              onPress={() => pickSingleImage(setVehiclePhotoSide)}
              emptyIcon="image-outline"
            />
            <TouchableOpacity style={styles.sapsRow} onPress={() => pickSingleImage(setSapsClearance)}>
              <Text style={styles.sapsText}>
                {sapsClearance ? 'SAPS clearance uploaded ✓' : 'Optional: SAPS clearance — tap to upload'}
              </Text>
            </TouchableOpacity>
            {!step3Ready ? (
              <Text style={styles.hintDisabled}>Upload all documents to continue</Text>
            ) : null}
          </>
        )}

        {step === 4 && (
          <>
            <ProgressHeader step={4} title="Step 4 of 4 — Vehicle details" />
            <AppInput
              accent="accent"
              label="Vehicle make"
              value={vehicleMake}
              onChangeText={setVehicleMake}
              placeholder="e.g. Toyota"
            />
            <AppInput
              accent="accent"
              label="Vehicle model"
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="e.g. Corolla"
            />
            <AppInput
              accent="accent"
              label="Year"
              value={vehicleYear}
              onChangeText={setVehicleYear}
              placeholder="e.g. 2019"
              keyboardType="numeric"
            />
            <AppInput
              accent="accent"
              label="Colour"
              value={vehicleColor}
              onChangeText={setVehicleColor}
              placeholder="e.g. White"
            />
            <AppInput
              accent="accent"
              label="Number plate"
              value={vehiclePlate}
              onChangeText={(t) => setVehiclePlate(t.toUpperCase())}
              placeholder="CA 123-456"
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted((v) => !v)}
              activeOpacity={0.85}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxOn]}>
                {termsAccepted ? <Ionicons name="checkmark" size={14} color={colors.textWhite} /> : null}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={openTerms}>
                  SwiftDrop Terms & Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {step < 4 ? (
          <View style={styles.btnRow}>
            <AppButton
              label="Back"
              variant="outlineAccent"
              fullWidth={false}
              onPress={goBack}
              style={styles.btnHalf}
            />
            <AppButton
              label={step === 3 ? 'Next' : 'Continue'}
              variant="accent"
              fullWidth={false}
              onPress={goNext}
              disabled={step === 3 && !step3Ready}
              style={styles.btnHalf}
            />
          </View>
        ) : (
          <AppButton
            label={busy ? 'Submitting…' : 'Submit Application'}
            variant="accent"
            onPress={handleRegisterAndOtp}
            loading={busy}
            disabled={busy}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  progressWrap: {
    marginBottom: spacing.lg,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  pathUberSel: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pathNewSel: {
    borderColor: colors.accent,
    backgroundColor: '#FFF7ED',
  },
  pathIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathMid: { flex: 1, marginLeft: spacing.md },
  pathTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  pathTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  pathSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  badgeGreen: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeGreenText: { fontSize: 10, fontWeight: '800', color: colors.success },
  badgeOrange: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeOrangeText: { fontSize: 10, fontWeight: '800', color: colors.accent },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUberOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioNewOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  uploadCardEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  uploadCardDone: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  uploadLeftEmpty: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLeftDone: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadMid: { flex: 1, marginHorizontal: spacing.sm },
  uploadTitle: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  uploadSub: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  uploadThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionMini: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sapsRow: { paddingVertical: spacing.sm },
  sapsText: { fontSize: 12, color: colors.textSecondary },
  hintDisabled: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  bottomBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  btnHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  successScroll: {
    padding: spacing.xl,
    alignItems: 'center',
    paddingTop: 60,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  successHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: '600',
  },
});
