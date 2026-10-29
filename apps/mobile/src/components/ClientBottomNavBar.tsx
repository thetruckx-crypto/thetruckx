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
        <View style={[styles.tabIconWrap, activeTab === 'HOME' && styles.tabIconWrapActive]}>
          <Home
            size={21}
            color={activeTab === 'HOME' ? '#F15A24' : '#64748B'}
            strokeWidth={activeTab === 'HOME' ? 2.4 : 1.8}
          />
        </View>
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
        <View style={[styles.tabIconWrap, isShipmentsActive && styles.tabIconWrapActive]}>
          <Package
            size={21}
            color={isShipmentsActive ? '#F15A24' : '#64748B'}
            strokeWidth={isShipmentsActive ? 2.4 : 1.8}
          />
        </View>
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
        <View style={[styles.tabIconWrap, activeTab === 'REQUIREMENTS' && styles.tabIconWrapActive]}>
          <FileText
            size={21}
            color={activeTab === 'REQUIREMENTS' ? '#F15A24' : '#64748B'}
            strokeWidth={activeTab === 'REQUIREMENTS' ? 2.4 : 1.8}
          />
        </View>
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
        <View style={[styles.tabIconWrap, activeTab === 'PROFILE' && styles.tabIconWrapActive]}>
          <User
            size={21}
            color={activeTab === 'PROFILE' ? '#F15A24' : '#64748B'}
            strokeWidth={activeTab === 'PROFILE' ? 2.4 : 1.8}
          />
        </View>
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
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: -0.2,
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
