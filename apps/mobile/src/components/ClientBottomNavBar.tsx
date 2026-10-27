import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Package, FileText, User } from 'lucide-react-native';

// Tab type definition supporting the unified 4-tab mobile layout:
// 'HOME' | 'SHIPMENT' | 'REQUIREMENTS' | 'BOOKINGS' | 'PROFILE'
export type ClientNavTab =
  | 'HOME'
  | 'SHIPMENT'
  | 'SHIPMENTS'
  | 'REQUIREMENTS'
  | 'BOOKINGS'
  | 'PROFILE';

interface ClientBottomNavBarProps {
  activeTab: ClientNavTab | string;
  onSelectTab: (tab: ClientNavTab) => void;
}

/**
 * ClientBottomNavBar — Unified 4-Tab Navigation:
 * Tab 1: Home — Main Client Dashboard
 * Tab 2: Shipment — Unified Shipments (Book, Track, Manage)
 * Tab 3: My Requirements — Freight RFQs & Quotations
 * Tab 4: Bookings (Migrated into Shipments tab)
 * Tab 5: Profile — Account & Settings
 */
export const ClientBottomNavBar: React.FC<ClientBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const isShipmentsActive = activeTab === 'SHIPMENT' || activeTab === 'SHIPMENTS' || activeTab === 'BOOKINGS';

  return (
    <View style={styles.bottomTabBar} accessibilityRole="tablist">
      {/* Tab 1: Home */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('HOME')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'HOME' }}
        accessibilityLabel="Home Tab"
      >
        <Home
          size={22}
          color={activeTab === 'HOME' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'HOME' ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, activeTab === 'HOME' && styles.tabLabelActive]}>
          Home
        </Text>
        {activeTab === 'HOME' && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 2: Shipment / Shipments */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('SHIPMENTS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isShipmentsActive }}
        accessibilityLabel="Shipments Tab"
      >
        <Package
          size={22}
          color={isShipmentsActive ? '#F15A24' : '#64748B'}
          strokeWidth={isShipmentsActive ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, isShipmentsActive && styles.tabLabelActive]}>
          Shipments
        </Text>
        {isShipmentsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 3: My Requirements */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('REQUIREMENTS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'REQUIREMENTS' }}
        accessibilityLabel="My Requirements Tab"
      >
        <FileText
          size={22}
          color={activeTab === 'REQUIREMENTS' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'REQUIREMENTS' ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, activeTab === 'REQUIREMENTS' && styles.tabLabelActive]}>
          My Requirements
        </Text>
        {activeTab === 'REQUIREMENTS' && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 4: Profile (Bookings migrated into Shipments) */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('PROFILE')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'PROFILE' }}
        accessibilityLabel="Profile Tab"
      >
        <User
          size={22}
          color={activeTab === 'PROFILE' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'PROFILE' ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, activeTab === 'PROFILE' && styles.tabLabelActive]}>
          Profile
        </Text>
        {activeTab === 'PROFILE' && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomTabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 76 : 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
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
