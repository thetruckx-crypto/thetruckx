import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  KeyboardTypeOptions,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';

interface AppTextFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AppTextField: React.FC<AppTextFieldProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
  disabled = false,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.container,
          isFocused && styles.containerFocused,
          error ? styles.containerError : null,
          disabled ? styles.containerDisabled : null,
        ]}
      >
        <Text
          style={[
            styles.label,
            isFocused && styles.labelFocused,
            error ? styles.labelError : null,
          ]}
        >
          {label}
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            maxLength={maxLength}
            editable={!disabled}
          />
          {value.length > 0 && !disabled && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onChangeText('')}
              activeOpacity={0.7}
            >
              <X size={14} color="#7B8798" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 60,
    justifyContent: 'center',
  },
  containerFocused: {
    borderColor: '#F15A24',
  },
  containerError: {
    borderColor: '#DC3545',
  },
  containerDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.7,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7B8798',
    marginBottom: 4,
  },
  labelFocused: {
    color: '#F15A24',
  },
  labelError: {
    color: '#DC3545',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#172B4D',
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
