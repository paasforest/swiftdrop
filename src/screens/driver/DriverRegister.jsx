import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { postJson } from '../../apiClient';
import { API_BASE_URL } from '../../apiConfig';
import { getAuth, setAuth } from '../../authStore';
import { colors, spacing, radius, typography } from '../../theme/theme';

const TERMS_ERROR = 'Please agree to the SwiftDrop terms to continue.';

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

function UnderReviewBody({ applicationPath }) {
  const isUber = applicationPath === 'uber_bolt';
  return (
    <View style={styles.underReviewCard}>
      <Text style={styles.underReviewTitle}>Under Review</Text>
      <Text style={styles.underReviewText}>
        {isUber
          ? 'We are verifying your Uber/Bolt profile. Approval usually takes 2-4 hours.'
          : 'We are reviewing your application. This usually takes 24-48 hours.'}
      </Text>
      <Text style={styles.underReviewSub}>
        After approval, you can log in and start accepting deliveries.
      </Text>
    </View>
  );
}

const DriverRegister = ({ navigation }) => {
  const [applicationPath, setApplicationPath] = useState(null); // 'uber_bolt' | 'new_driver'
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Account details (backend requirement)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile photo (required for both)
  const [profilePhoto, setProfilePhoto] = useState(null);

  // PATH 1 — existing Uber/Bolt driver
  const [uberProfileScreenshot, setUberProfileScreenshot] = useState(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehiclePhotoExisting, setVehiclePhotoExisting] = useState(null);

  // PATH 2 — new driver
  const [nationalId, setNationalId] = useState(null);
  const [driversLicense, setDriversLicense] = useState(null);
  const [vehicleRegistration, setVehicleRegistration] = useState(null);
  const [licenseDisc, setLicenseDisc] = useState(null);
  const [sapsClearance, setSapsClearance] = useState(null);
  const [vehiclePhotoFront, setVehiclePhotoFront] = useState(null);
  const [vehiclePhotoBack, setVehiclePhotoBack] = useState(null);
  const [vehiclePhotoSide, setVehiclePhotoSide] = useState(null);

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // OTP & submit flow
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [underReview, setUnderReview] = useState(false);
  const [underReviewPath, setUnderReviewPath] = useState(null);

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

  const validateCommon = () => {
    if (!termsAccepted) return TERMS_ERROR;
    if (!fullName.trim()) return 'Full name is required.';
    if (!email.trim()) return 'Email is required.';
    if (!phone.trim()) return 'Phone number is required.';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (!profilePhoto) return 'Profile photo is required.';
    return null;
  };

  const validateUber = () => {
    if (!uberProfileScreenshot) return 'Uber/Bolt profile screenshot is required.';
    if (!vehiclePhotoExisting) return 'Vehicle photo is required.';
    if (!vehicleMake.trim()) return 'Vehicle make is required.';
    if (!vehicleModel.trim()) return 'Vehicle model is required.';
    if (!vehicleYear.trim()) return 'Vehicle year is required.';
    if (!vehicleColor.trim()) return 'Vehicle colour is required.';
    if (!vehiclePlate.trim()) return 'Vehicle plate number is required.';
    return null;
  };

  const validateNewDriver = () => {
    if (!nationalId) return 'National ID is required.';
    if (!driversLicense) return "Driver's license is required.";
    if (!vehicleRegistration) return 'Vehicle registration is required.';
    if (!licenseDisc) return 'License disc is required.';
    if (!vehiclePhotoFront) return 'Vehicle front photo is required.';
    if (!vehiclePhotoBack) return 'Vehicle back photo is required.';
    if (!vehiclePhotoSide) return 'Vehicle side photo is required.';
    // sapsClearance optional
    return null;
  };

  const handleSendOtpOrRegister = async () => {
    setErrorMessage(null);
    const commonErr = validateCommon();
    if (commonErr) {
      setErrorMessage(commonErr);
      return;
    }
    if (applicationPath === 'uber_bolt') {
      const uberErr = validateUber();
      if (uberErr) {
        setErrorMessage(uberErr);
        return;
      }
    }
    if (applicationPath === 'new_driver') {
      const newErr = validateNewDriver();
      if (newErr) {
        setErrorMessage(newErr);
        return;
      }
    }

    setBusy(true);
    try {
      const data = await postJson('/api/auth/register-driver', {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      // If phone verification is skipped (testing mode), submit immediately.
      if (data.phoneVerificationRequired === false && data.token && data.refreshToken) {
        setAuth({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
        });

        await submitApplication(); // eslint-disable-line no-use-before-define
        return;
      }

      // Otherwise, OTP is required. Submit after OTP verifies.
      setPendingSubmit(true);
      navigation.navigate('DriverOTPScreen', { phone: phone.trim() });
    } catch (e) {
      setErrorMessage(e.message || 'Driver registration failed');
    } finally {
      setBusy(false);
    }
  };

  const appendImageFile = (formData, key, asset) => {
    if (!asset) return;
    formData.append(key, {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `${key}.jpg`,
    });
  };

  const submitApplication = async () => {
    if (hasSubmitted) return;

    const auth = getAuth();
    if (!auth?.token) {
      throw new Error('Not signed in. Please verify OTP again.');
    }
    if (!applicationPath) throw new Error('Missing application path.');

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('application_path', applicationPath);

      // Common
      appendImageFile(formData, 'selfie', profilePhoto);

      // PATH 1
      if (applicationPath === 'uber_bolt') {
        appendImageFile(formData, 'uber_profile_screenshot', uberProfileScreenshot);
        appendImageFile(formData, 'vehicle_photo', vehiclePhotoExisting);
        formData.append('vehicle_make', vehicleMake.trim());
        formData.append('vehicle_model', vehicleModel.trim());
        formData.append('vehicle_year', vehicleYear.trim());
        formData.append('vehicle_color', vehicleColor.trim());
        formData.append('vehicle_plate', vehiclePlate.trim());
      }

      // PATH 2
      if (applicationPath === 'new_driver') {
        appendImageFile(formData, 'national_id', nationalId);
        appendImageFile(formData, 'drivers_license', driversLicense);
        appendImageFile(formData, 'vehicle_registration', vehicleRegistration);
        appendImageFile(formData, 'license_disc', licenseDisc);
        appendImageFile(formData, 'saps_clearance', sapsClearance);
        appendImageFile(formData, 'vehicle_photo_front', vehiclePhotoFront);
        appendImageFile(formData, 'vehicle_photo_back', vehiclePhotoBack);
        appendImageFile(formData, 'vehicle_photo_side', vehiclePhotoSide);
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/driver/submit-application`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          // 'Content-Type' is set automatically for FormData
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
      setUnderReview(true);
      setUnderReviewPath(applicationPath);
    } finally {
      setBusy(false);
    }
  };

  // When returning from OTP verification, submit the application.
  useFocusEffect(
    useCallback(() => {
      if (!pendingSubmit || hasSubmitted) return;
      const auth = getAuth();
      if (auth?.token) {
        submitApplication().catch((e) => setErrorMessage(e.message || 'Submit failed'));
      }
    }, [pendingSubmit, hasSubmitted]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    // Reset internal flags when switching paths.
    setPendingSubmit(false);
    setHasSubmitted(false);
    setUnderReview(false);
    setUnderReviewPath(null);
    setErrorMessage(null);
  }, [applicationPath]);

  const renderPathPicker = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Choose Registration Path</Text>

      <TouchableOpacity
        style={[styles.pathCard, applicationPath === 'uber_bolt' && styles.pathCardSelected]}
        onPress={() => setApplicationPath('uber_bolt')}
      >
        <Text style={styles.pathTitle}>I already drive for Uber or Bolt</Text>
        <Text style={styles.pathSub}>Upload profile screenshot + vehicle details</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pathCard, applicationPath === 'new_driver' && styles.pathCardSelected]}
        onPress={() => setApplicationPath('new_driver')}
      >
        <Text style={styles.pathTitle}>I am a new driver</Text>
        <Text style={styles.pathSub}>Upload full documents + vehicle photos</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAccountDetails = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Account Details</Text>

      <TextInput style={styles.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
      <TextInput
        style={styles.input}
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex1]} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <View style={styles.checkboxRow}>
        <TouchableOpacity
          onPress={() => setTermsAccepted((v) => !v)}
          style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
        />
        <Text style={styles.checkboxLabel}>I agree to the SwiftDrop terms</Text>
      </View>
    </View>
  );

  const renderProfilePhoto = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Profile Photo (Required)</Text>
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => pickSingleImage(setProfilePhoto)}
      >
        <Text style={styles.uploadButtonText}>
          {profilePhoto ? 'Change Profile Photo' : 'Upload Profile Photo'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderUberPath = () => (
    <>
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Uber/Bolt Profile Screenshot (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setUberProfileScreenshot)}>
          <Text style={styles.uploadButtonText}>
            {uberProfileScreenshot ? 'Change Screenshot' : 'Upload Screenshot'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Vehicle Details</Text>
        <TextInput style={styles.input} placeholder="Make" value={vehicleMake} onChangeText={setVehicleMake} />
        <TextInput style={styles.input} placeholder="Model" value={vehicleModel} onChangeText={setVehicleModel} />
        <TextInput style={styles.input} placeholder="Year" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Colour" value={vehicleColor} onChangeText={setVehicleColor} />
        <TextInput style={styles.input} placeholder="Plate Number" value={vehiclePlate} onChangeText={setVehiclePlate} />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Vehicle Photo (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setVehiclePhotoExisting)}>
          <Text style={styles.uploadButtonText}>
            {vehiclePhotoExisting ? 'Change Vehicle Photo' : 'Upload Vehicle Photo'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderNewDriverPath = () => (
    <>
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>National ID (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setNationalId)}>
          <Text style={styles.uploadButtonText}>{nationalId ? 'Change National ID' : 'Upload National ID'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Drivers License (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setDriversLicense)}>
          <Text style={styles.uploadButtonText}>{driversLicense ? 'Change License' : 'Upload License'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Vehicle Registration (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setVehicleRegistration)}>
          <Text style={styles.uploadButtonText}>
            {vehicleRegistration ? 'Change Registration' : 'Upload Registration'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>License Disc (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setLicenseDisc)}>
          <Text style={styles.uploadButtonText}>{licenseDisc ? 'Change License Disc' : 'Upload Disc'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>SAPS Clearance (Optional but Recommended)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setSapsClearance)}>
          <Text style={styles.uploadButtonText}>{sapsClearance ? 'Change SAPS Clearance' : 'Upload SAPS Clearance'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Vehicle Photos (Front/Back/Side) (Required)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setVehiclePhotoFront)}>
          <Text style={styles.uploadButtonText}>{vehiclePhotoFront ? 'Change Front Photo' : 'Upload Front Photo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setVehiclePhotoBack)}>
          <Text style={styles.uploadButtonText}>{vehiclePhotoBack ? 'Change Back Photo' : 'Upload Back Photo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickSingleImage(setVehiclePhotoSide)}>
          <Text style={styles.uploadButtonText}>{vehiclePhotoSide ? 'Change Side Photo' : 'Upload Side Photo'}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const canSubmit = useMemo(() => {
    if (!applicationPath) return false;
    const commonErr = validateCommon();
    if (commonErr) return false;
    if (applicationPath === 'uber_bolt') return !validateUber();
    if (applicationPath === 'new_driver') return !validateNewDriver();
    return false;
  }, [
    applicationPath,
    termsAccepted,
    fullName,
    email,
    phone,
    password,
    confirmPassword,
    profilePhoto,
    uberProfileScreenshot,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    vehiclePlate,
    vehiclePhotoExisting,
    nationalId,
    driversLicense,
    vehicleRegistration,
    licenseDisc,
    sapsClearance,
    vehiclePhotoFront,
    vehiclePhotoBack,
    vehiclePhotoSide,
  ]);

  if (underReview) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <UnderReviewBody applicationPath={underReviewPath} />
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.doneButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Become a Driver</Text>
          <View style={styles.placeholder} />
        </View>

        {renderPathPicker()}

        {applicationPath ? (
          <>
            {renderAccountDetails()}
            {renderProfilePhoto()}
            {applicationPath === 'uber_bolt' ? renderUberPath() : renderNewDriverPath()}
          </>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.continueButton, (!canSubmit || busy) && styles.continueButtonDisabled]}
          onPress={handleSendOtpOrRegister}
          disabled={!canSubmit || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.textWhite} />
          ) : (
            <Text style={styles.continueButtonText}>Continue & Verify Phone (OTP)</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  placeholder: { width: 28 },
  formSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  pathCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: 12,
  },
  pathCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pathSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  uploadButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  bottomContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  underReviewCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  underReviewTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 10,
  },
  underReviewText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  underReviewSub: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DriverRegister;

