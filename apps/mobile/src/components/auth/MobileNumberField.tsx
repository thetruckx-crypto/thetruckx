import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';

interface MobileNumberFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string | null;
  onClear?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const MobileNumberField: React.FC<MobileNumberFieldProps> = ({
  value,
  onChangeText,
  label,
  error,
  onClear,
  autoFocus = false,
  disabled = false,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = (raw: string) => {
    // Only allow digits 0-9
    const clean = raw.replace(/[^0-9]/g, '').slice(0, 10);
    onChangeText(clean);
  };

  const handleClear = () => {
    onChangeText('');
    if (onClear) onClear();
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.container,
          label ? styles.containerWithLabel : styles.containerWithoutLabel,
          isFocused && styles.containerFocused,
          error ? styles.containerError : null,
          disabled ? styles.containerDisabled : null,
        ]}
      >
        {/* Floating Label (rendered only if explicitly provided) */}
        {label ? (
          <Text style={[styles.floatingLabel, isFocused && styles.floatingLabelFocused, error ? styles.floatingLabelError : null]}>
            {label}
          </Text>
        ) : null}

        <View style={styles.inputRow}>
          {/* Country Selector (India +91) */}
          <TouchableOpacity
            style={styles.countrySelector}
            activeOpacity={0.7}
            accessibilityLabel="Country code: India +91"
          >
            <Text style={styles.flagEmoji}>🇮🇳</Text>
            <Text style={styles.dialCode}>+91</Text>
            <ChevronDown size={14} color="#172B4D" strokeWidth={2.5} style={styles.chevron} />
          </TouchableOpacity>

          {/* Vertical Divider */}
          <View style={styles.divider} />

          {/* Number Input Field */}
          <TextInput
            style={styles.input}
            placeholder="Enter 10-digit mobile number"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            maxLength={10}
            value={value}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus={autoFocus}
            editable={!disabled}
            accessibilityLabel="Mobile Number Input"
          />

          {/* Clear Button */}
          {value.length > 0 && !disabled && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
              activeOpacity={0.7}
              accessibilityLabel="Clear mobile number"
            >
              <X size={15} color="#7B8798" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error Message */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  containerWithLabel: {
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 64,
  },
  containerWithoutLabel: {
    height: 56,
  },
  containerFocused: {
    borderColor: '#F15A24',
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  containerError: {
    borderColor: '#DC3545',
  },
  containerDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.7,
  },
  floatingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7B8798',
    marginBottom: 4,
  },
  floatingLabelFocused: {
    color: '#F15A24',
  },
  floatingLabelError: {
    color: '#DC3545',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  flagEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  dialCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#172B4D',
    letterSpacing: 0.2,
  },
  chevron: {
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: '#D9E0E8',
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#172B4D',
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC3545',
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },
});
