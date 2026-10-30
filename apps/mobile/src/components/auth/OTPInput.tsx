import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';

interface OTPInputProps {
  length?: number;
  value: string;
  onChangeText?: (code: string) => void;
  onChange?: (code: string) => void;
  onFilled?: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  error?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChangeText,
  onChange,
  onFilled,
  onComplete,
  disabled = false,
  hasError = false,
  error = false,
}) => {
  const notifyChange = (code: string) => {
    if (onChange) onChange(code);
    if (onChangeText) onChangeText(code);
  };

  const notifyComplete = (code: string) => {
    if (onComplete) onComplete(code);
    if (onFilled) onFilled(code);
  };

  const isError = hasError || error;
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    // Focus first input on mount
    if (!disabled && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [disabled]);

  const handleChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');

    // Case 1: Pasted multiple digits
    if (clean.length > 1) {
      const pasted = clean.slice(0, length);
      notifyChange(pasted);
      const nextIndex = Math.min(pasted.length, length - 1);
      setFocusedIndex(nextIndex);
      inputRefs.current[nextIndex]?.focus();
      if (pasted.length === length) {
        notifyComplete(pasted);
      }
      return;
    }

    // Case 2: Single digit entered
    const newDigits = [...digits];
    newDigits[index] = clean;
    const newCode = newDigits.join('');
    notifyChange(newCode);

    if (clean && index < length - 1) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.length === length) {
      notifyComplete(newCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        const newCode = newDigits.join('');
        notifyChange(newCode);
        setFocusedIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        const isFilled = digit !== '';

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.box,
              isFocused && styles.boxFocused,
              isFilled && styles.boxFilled,
              isError && styles.boxError,
              disabled && styles.boxDisabled,
            ]}
            onPress={() => {
              if (!disabled) {
                setFocusedIndex(index);
                inputRefs.current[index]?.focus();
              }
            }}
            activeOpacity={1}
          >
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={index === 0 ? length : 1}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              editable={!disabled}
              selectTextOnFocus
              accessibilityLabel={`OTP digit ${index + 1}`}
            />
            {isFocused && !digit && <View style={styles.cursor} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 12,
  },
  box: {
    width: 48,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D9E0E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  boxFocused: {
    borderColor: '#F15A24',
    backgroundColor: '#FFFFFF',
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  boxFilled: {
    borderColor: '#172B4D',
    backgroundColor: '#FFFFFF',
  },
  boxError: {
    borderColor: '#DC3545',
    backgroundColor: '#FFF5F5',
  },
  boxDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  input: {
    fontSize: 22,
    fontWeight: '700',
    color: '#172B4D',
    textAlign: 'center',
    width: '100%',
    height: '100%',
    padding: 0,
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: '#F15A24',
    borderRadius: 1,
  },
});
