import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Package, Navigation, Truck, Grid2x2 } from 'lucide-react-native';

export type VendorNavTab = 'HOME' | 'LOADS' | 'TRIPS' | 'FLEET' | 'MORE';

interface VendorBottomNavBarProps {
  activeTab: VendorNavTab | string;
  onSelectTab: (tab: VendorNavTab) => void;
  onOpenMore?: () => void;
}

/**
 * VendorBottomNavBar — Mobile Carrier Dashboard 5-Tab Navigation:
 * Tab 1: Home — Carrier Control Tower (Vendor Dashboard)
 * Tab 2: Loads — Available Transport Loads (Live RFQs)
 * Tab 3: Trips — Active Trips & Live Shipments
 * Tab 4: Fleet — Fleet & Driver Management
 * Tab 5: More — Secondary Features (Quotations, Bookings, Reports, KYC, Profile)
 */
export const VendorBottomNavBar: React.FC<VendorBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenMore,
}) => {
  const isHome = activeTab === 'HOME' || activeTab === 'DASHBOARD';
  const isLoads = activeTab === 'LOADS' || activeTab === 'REQUIREMENTS';
  const isTrips = activeTab === 'TRIPS';
  const isFleet = activeTab === 'FLEET' || activeTab === 'DRIVERS';
  const isMore = activeTab === 'MORE';

  const handleTabPress = (tab: VendorNavTab) => {
    if (tab === 'MORE') {
      if (onOpenMore) {
        onOpenMore();
      } else {
        onSelectTab('MORE');
      }
    } else {
      onSelectTab(tab);
    }
  };

  return (
    <View style={styles.bottomTabBar} accessibilityRole="tablist">
      {/* Tab 1: Home */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleTabPress('HOME')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isHome }}
        accessibilityLabel="Carrier Control Tower Home"
      >
        {isHome && <View style={styles.activeTabIndicator} />}
        <Home
          size={22}
          color={isHome ? '#FF5A1F' : '#68768A'}
          strokeWidth={isHome ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, isHome && styles.tabLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Tab 2: Loads */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleTabPress('LOADS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isLoads }}
        accessibilityLabel="Available Loads & Live RFQs"
      >
        {isLoads && <View style={styles.activeTabIndicator} />}
        <Package
          size={22}
          color={isLoads ? '#FF5A1F' : '#68768A'}
          strokeWidth={isLoads ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, isLoads && styles.tabLabelActive]}>
          Loads
        </Text>
      </TouchableOpacity>

      {/* Tab 3: Trips */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleTabPress('TRIPS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isTrips }}
        accessibilityLabel="Active Trips"
      >
        {isTrips && <View style={styles.activeTabIndicator} />}
        <Navigation
          size={21}
          color={isTrips ? '#FF5A1F' : '#68768A'}
          strokeWidth={isTrips ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, isTrips && styles.tabLabelActive]}>
          Trips
        </Text>
      </TouchableOpacity>

      {/* Tab 4: Fleet */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleTabPress('FLEET')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFleet }}
        accessibilityLabel="Fleet Management & Drivers"
      >
        {isFleet && <View style={styles.activeTabIndicator} />}
        <Truck
          size={22}
          color={isFleet ? '#FF5A1F' : '#68768A'}
          strokeWidth={isFleet ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, isFleet && styles.tabLabelActive]}>
          Fleet
        </Text>
      </TouchableOpacity>

      {/* Tab 5: More */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handleTabPress('MORE')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isMore }}
        accessibilityLabel="More Carrier Options"
      >
        {isMore && <View style={styles.activeTabIndicator} />}
        <Grid2x2
          size={21}
          color={isMore ? '#FF5A1F' : '#68768A'}
          strokeWidth={isMore ? 2.5 : 1.8}
        />
        <Text style={[styles.tabLabel, isMore && styles.tabLabelActive]}>
          More
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomTabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 84 : 66,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E6EAF0',
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
    height: '100%',
  },
  activeTabIndicator: {
    position: 'absolute',
    top: -6,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF5A1F',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#68768A',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#FF5A1F',
    fontWeight: '700',
  },
});
