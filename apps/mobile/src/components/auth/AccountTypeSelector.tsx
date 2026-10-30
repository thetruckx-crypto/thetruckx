import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { MobileRole } from '../../types';

interface AccountTypeSelectorProps {
  selectedRole: MobileRole;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  layout?: 'inline' | 'stacked';
}

export const AccountTypeSelector: React.FC<AccountTypeSelectorProps> = ({
  selectedRole,
  onPress,
  style,
  layout = 'inline',
}) => {
  const getRoleDisplayName = (r: MobileRole): string => {
    switch (r) {
      case 'CLIENT':
        return 'Client';
      case 'VENDOR':
        return 'Vendor';
      case 'DRIVER':
        return 'Driver';
      default:
        return 'Client';
    }
  };

  const roleName = getRoleDisplayName(selectedRole);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        layout === 'stacked' && styles.containerStacked,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Login as ${roleName}. Tap to change account type.`}
    >
      {layout === 'stacked' ? (
        <View style={styles.stackedWrap}>
          <Text style={styles.stackedLabel}>Login as</Text>
          <Text style={styles.stackedRoleValue}>{roleName}</Text>
        </View>
      ) : (
        <View style={styles.inlineContentWrap}>
          <Text style={styles.inlineText}>
            <Text style={styles.loginAsPrefix}>Login as </Text>
            <Text style={styles.roleValueBold}>{roleName}</Text>
          </Text>
        </View>
      )}

      <ChevronDown
        size={18}
        color="#172B4D"
        strokeWidth={2.4}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  containerStacked: {
    height: undefined,
    minHeight: 62,
    paddingVertical: 10,
  },
  inlineContentWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineText: {
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingVertical: Platform.OS === 'android' ? 0 : 2,
  },
  loginAsPrefix: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7B8798',
  },
  roleValueBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#172B4D',
  },
  chevron: {
    marginLeft: 8,
  },
  stackedWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  stackedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7B8798',
    marginBottom: 3,
    includeFontPadding: false,
  },
  stackedRoleValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#172B4D',
    includeFontPadding: false,
  },
});
