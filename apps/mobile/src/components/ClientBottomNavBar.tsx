import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Layers, ClipboardList, User } from 'lucide-react-native';

// Tab type definition supporting the required 4-tab mobile layout:
// 1. Home
// 2. My Requirements (Unified Transport Lifecycle)
// 3. Received Quotations
// 4. Profile
export type ClientNavTab =
  | 'HOME'
  | 'REQUIREMENTS'
  | 'QUOTATIONS'
  | 'PROFILE'
  | 'SHIPMENT'
  | 'SHIPMENTS'
  | 'BOOKINGS';

interface ClientBottomNavBarProps {
  activeTab: ClientNavTab | string;
  onSelectTab: (tab: ClientNavTab) => void;
}

/**
 * ClientBottomNavBar — Standard THE TRUCKX 4-Tab Navigation:
 * Tab 1: Home — Main Client Dashboard & Quick Actions
 * Tab 2: My Requirements — Unified Transport Lifecycle (Draft, RFQ, Bookings, Shipments, Milestone Tracking)
 * Tab 3: Received Quotations — Vendor Quotations Review & Comparison
 * Tab 4: Profile — Account Details & Company Settings
 */
export const ClientBottomNavBar: React.FC<ClientBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const isHomeActive = activeTab === 'HOME';
  const isRequirementsActive =
    activeTab === 'REQUIREMENTS' ||
    activeTab === 'SHIPMENT' ||
    activeTab === 'SHIPMENTS' ||
    activeTab === 'BOOKINGS';
  const isQuotationsActive = activeTab === 'QUOTATIONS';
  const isProfileActive = activeTab === 'PROFILE';

  return (
    <View style={styles.bottomTabBar} accessibilityRole="tablist">
      {/* Tab 1: Home */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('HOME')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isHomeActive }}
        accessibilityLabel="Home Tab"
      >
        <View style={[styles.tabIconWrap, isHomeActive && styles.tabIconWrapActive]}>
          <Home
            size={21}
            color={isHomeActive ? '#F15A24' : '#64748B'}
            strokeWidth={isHomeActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isHomeActive && styles.tabLabelActive]}>
          Home
        </Text>
        {isHomeActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 2: My Requirements (Unified Requirements, Bookings & Tracking) */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('REQUIREMENTS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isRequirementsActive }}
        accessibilityLabel="My Requirements Tab"
      >
        <View style={[styles.tabIconWrap, isRequirementsActive && styles.tabIconWrapActive]}>
          <Layers
            size={21}
            color={isRequirementsActive ? '#F15A24' : '#64748B'}
            strokeWidth={isRequirementsActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isRequirementsActive && styles.tabLabelActive]}>
          My Requirements
        </Text>
        {isRequirementsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 3: Received Quotations */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('QUOTATIONS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isQuotationsActive }}
        accessibilityLabel="Received Quotations Tab"
      >
        <View style={[styles.tabIconWrap, isQuotationsActive && styles.tabIconWrapActive]}>
          <ClipboardList
            size={21}
            color={isQuotationsActive ? '#F15A24' : '#64748B'}
            strokeWidth={isQuotationsActive ? 2.4 : 1.8}
          />
        </View>
        <Text
          style={[styles.tabLabel, isQuotationsActive && styles.tabLabelActive]}
          numberOfLines={1}
        >
          Received Quotations
        </Text>
        {isQuotationsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 4: Profile */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('PROFILE')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isProfileActive }}
        accessibilityLabel="Profile Tab"
      >
        <View style={[styles.tabIconWrap, isProfileActive && styles.tabIconWrapActive]}>
          <User
            size={21}
            color={isProfileActive ? '#F15A24' : '#64748B'}
            strokeWidth={isProfileActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isProfileActive && styles.tabLabelActive]}>
          Profile
        </Text>
        {isProfileActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomTabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 78 : 66,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 6,
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 2,
  },
  tabIconWrap: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: '#FFF7ED',
  },
  tabLabel: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#F15A24',
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    top: -6,
    width: 32,
    height: 3,
    backgroundColor: '#F15A24',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
