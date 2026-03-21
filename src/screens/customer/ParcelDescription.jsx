import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView } from 'react-native';
import { colors, spacing, radius, typography, shadows } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

function parseEstimatedValueToNumber(range) {
  const v = String(range ?? '').trim();
  if (!v) return null;

  if (v.toLowerCase().startsWith('under')) {
    // Under R200 -> 200
    const m = v.match(/R(\d+(?:\.\d+)?)/i);
    return m ? Number(m[1]) : null;
  }

  // R200-R500 / R500-R1000 / R1000-R2000
  const parts = v.replace(/to/gi, '-').split('-').map((x) => x.replace(/[^\d.]/g, ''));
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return Math.round((a + b) / 2);
  }

  // Fallback: try to find any number
  const m = v.match(/R(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

const ParcelDescription = ({ navigation, route }) => {
  const baseParams = route?.params || {};
  const [selectedCategory, setSelectedCategory] = useState('Documents');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [estimatedValue, setEstimatedValue] = useState('R200-R500');
  const [fragile, setFragile] = useState(false);
  const [upright, setUpright] = useState(false);
  const [careful, setCareful] = useState(false);
  const [prohibitedConfirmed, setProhibitedConfirmed] = useState(false);
  const [showProhibitedModal, setShowProhibitedModal] = useState(false);

  const categories = [
    { id: 'documents', name: 'Documents & Paperwork', icon: '📄' },
    { id: 'hardware', name: 'Hardware & Contractor Parts', icon: '🔧' },
    { id: 'clothing', name: 'Clothing & Personal', icon: '👕' },
    { id: 'business', name: 'Small Business Stock', icon: '📦' },
    { id: 'electronics', name: 'Small Electronics', icon: '💻' },
    { id: 'gifts', name: 'Gifts & Parcels', icon: '🎁' },
    { id: 'other', name: 'Other', icon: '❓' }
  ];

  const prohibitedItems = [
    '🚫 Illegal drugs or substances',
    '🚫 Weapons, firearms, or explosives',
    '🚫 Hazardous materials or chemicals',
    '🚫 Perishable food items',
    '🚫 Live animals or plants',
    '🚫 Stolen goods or counterfeit items',
    '🚫 Cash or negotiable instruments',
    '🚫 Pornographic or obscene materials'
  ];

  const sizes = [
    {
      id: 'small',
      name: 'Small',
      icon: '🎒',
      description: 'Fits in a backpack'
    },
    {
      id: 'medium',
      name: 'Medium',
      icon: '📦',
      description: 'Shoebox size'
    },
    {
      id: 'large',
      name: 'Large',
      icon: '🧳',
      description: 'Suitcase size'
    }
  ];

  const valueRanges = [
    'Under R200',
    'R200-R500',
    'R500-R1000',
    'R1000-R2000'
  ];

  const handleNext = () => {
    if (!prohibitedConfirmed) {
      setShowProhibitedModal(true);
    } else {
      const parcel_value = parseEstimatedValueToNumber(estimatedValue);
      const special_handling = JSON.stringify({ fragile, upright, careful });

      navigation.navigate('DeliveryTiers', {
        ...baseParams,
        parcel_type: selectedCategory,
        parcel_size: selectedSize,
        parcel_value,
        special_handling,
      });
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleProhibitedConfirm = () => {
    setProhibitedConfirmed(true);
    setShowProhibitedModal(false);
    const parcel_value = parseEstimatedValueToNumber(estimatedValue);
    const special_handling = JSON.stringify({ fragile, upright, careful });

    navigation.navigate('DeliveryTiers', {
      ...baseParams,
      parcel_type: selectedCategory,
      parcel_size: selectedSize,
      parcel_value,
      special_handling,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Describe Your Parcel</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 of 4</Text>
        </View>

        {/* What are you sending? */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What are you sending?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoriesContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.name && styles.categoryChipSelected
                  ]}
                  onPress={() => setSelectedCategory(category.name)}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === category.name && styles.categoryTextSelected
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Parcel Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parcel Size</Text>
          <View style={styles.sizesContainer}>
            {sizes.map((size) => (
              <TouchableOpacity
                key={size.id}
                style={[
                  styles.sizeCard,
                  selectedSize === size.id && styles.sizeCardSelected
                ]}
                onPress={() => setSelectedSize(size.id)}
              >
                <Text style={styles.sizeIcon}>{size.icon}</Text>
                <Text style={styles.sizeName}>{size.name}</Text>
                <Text style={styles.sizeDescription}>{size.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Estimated Value */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimated Value</Text>
          <View style={styles.valueContainer}>
            {valueRanges.map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.valueOption,
                  estimatedValue === range && styles.valueOptionSelected
                ]}
                onPress={() => setEstimatedValue(range)}
              >
                <Text style={[
                  styles.valueText,
                  estimatedValue === range && styles.valueTextSelected
                ]}>
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Special Handling */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Handling</Text>
          
          <TouchableOpacity
            style={styles.toggleItem}
            onPress={() => setFragile(!fragile)}
          >
            <View style={[styles.toggle, fragile && styles.toggleOn]}>
              <View style={[styles.toggleKnob, fragile && styles.toggleKnobOn]} />
            </View>
            <Text style={styles.toggleLabel}>Fragile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleItem}
            onPress={() => setUpright(!upright)}
          >
            <View style={[styles.toggle, upright && styles.toggleOn]}>
              <View style={[styles.toggleKnob, upright && styles.toggleKnobOn]} />
            </View>
            <Text style={styles.toggleLabel}>Keep Upright</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleItem}
            onPress={() => setCareful(!careful)}
          >
            <View style={[styles.toggle, careful && styles.toggleOn]}>
              <View style={[styles.toggleKnob, careful && styles.toggleKnobOn]} />
            </View>
            <Text style={styles.toggleLabel}>Handle with Care</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Next Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Prohibited Items Modal */}
      {showProhibitedModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Prohibited Items</Text>
            <Text style={styles.modalSubtitle}>
              Before we continue, please confirm your parcel does NOT contain any of the following:
            </Text>
            
            <ScrollView style={styles.prohibitedList} showsVerticalScrollIndicator={false}>
              {prohibitedItems.map((item, index) => (
                <View key={index} style={styles.prohibitedItem}>
                  <Text style={styles.prohibitedText}>{item}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.modalWarning}>
              By confirming, you agree that your parcel complies with our terms and conditions. 
              Sending prohibited items may result in legal action.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowProhibitedModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton} 
                onPress={handleProhibitedConfirm}
              >
                <Text style={styles.confirmButtonText}>I Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textWhite,
    width: width,
    height: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 24,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  categoryChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: colors.textWhite,
  },
  sizesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sizeCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sizeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sizeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  sizeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sizeDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  valueContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valueOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  valueOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  valueText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  valueTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggle: {
    width: 48,
    height: 24,
    backgroundColor: colors.border,
    borderRadius: 12,
    marginRight: 16,
  },
  toggleOn: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    backgroundColor: colors.textWhite,
    borderRadius: 10,
    margin: 2,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.textWhite,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  prohibitedList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  prohibitedItem: {
    backgroundColor: colors.accentLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  prohibitedText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  modalWarning: {
    fontSize: 12,
    color: colors.accent,
    backgroundColor: colors.accentLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ParcelDescription;
