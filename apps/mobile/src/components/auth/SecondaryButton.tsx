import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';

import { MobileRole } from '../../types';

interface SecondaryButtonProps {
  prefixText?: string;
  actionText?: string;
  role?: MobileRole;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  prefixText = "Don't have an account?",
  actionText,
  role,
  onPress,
  disabled = false,
  style,
}) => {
  const resolvedActionText =
    actionText ||
    (role === 'CLIENT'
      ? 'Register as Client'
      : role === 'VENDOR'
      ? 'Register as Vendor'
      : 'Register as Driver');
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <Text style={styles.prefixText}>{prefixText} </Text>
      <Text style={styles.actionText}>{resolvedActionText}</Text>
      <ArrowRight size={16} color="#F15A24" strokeWidth={2.4} style={styles.arrow} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F15A24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  prefixText: {
    fontSize: 14,
    color: '#7B8798',
    fontWeight: '500',
  },
  actionText: {
    fontSize: 14,
    color: '#F15A24',
    fontWeight: '700',
  },
  arrow: {
    marginLeft: 6,
  },
});
