import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Check } from 'lucide-react-native';

interface CustomCheckboxProps {
  checked: boolean;
  onToggle?: () => void;
  onChange?: (checked: boolean) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onToggle,
  onChange,
  label = 'Remember Me',
  style,
}) => {
  const handlePress = () => {
    if (onChange) {
      onChange(!checked);
    } else if (onToggle) {
      onToggle();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#D9E0E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  boxChecked: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  label: {
    fontSize: 14,
    color: '#172B4D',
    fontWeight: '500',
  },
});
