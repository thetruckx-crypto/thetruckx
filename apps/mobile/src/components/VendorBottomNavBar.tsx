import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Layers, ClipboardList, CheckCircle2, User, MoreHorizontal } from 'lucide-react-native';

export type VendorNavTab =
  | 'HOME'
  | 'LOADS'
  | 'QUOTATIONS'
  | 'BOOKINGS'
  | 'MORE'
  | 'TRIPS'
  | 'FLEET'
  | 'PROFILE';

interface VendorBottomNavBarProps {
  activeTab: VendorNavTab | string;
  onSelectTab: (tab: VendorNavTab) => void;
  unreadCount?: number;
}

/**
 * VendorBottomNavBar — THE TRUCKX 5-Tab Navigation for Fleet Transporters & Vendors:
 * Tab 1: Home — Vendor Dashboard & Quick Access
 * Tab 2: Loads — Available Freight Requirements & Open Market Bids
 * Tab 3: Quotations — Submitted Bids & Rate Negotiations
 * Tab 4: Bookings — Awarded Orders & Active Consignments
 * Tab 5: More — Fleet, Drivers, Regional Hubs, Financials & Profile
 */
export const VendorBottomNavBar: React.FC<VendorBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
}) => {
  const isHomeActive = activeTab === 'HOME';
  const isLoadsActive = activeTab === 'LOADS';
  const isQuotationsActive = activeTab === 'QUOTATIONS';
  const isBookingsActive = activeTab === 'BOOKINGS';
  const isMoreActive = activeTab === 'MORE' || activeTab === 'PROFILE';

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
            size={20}
            color={isHomeActive ? '#F05A22' : '#64748B'}
            strokeWidth={isHomeActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isHomeActive && styles.tabLabelActive]}>
          Home
        </Text>
        {isHomeActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 2: Loads */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('LOADS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isLoadsActive }}
        accessibilityLabel="Available Loads Tab"
      >
        <View style={[styles.tabIconWrap, isLoadsActive && styles.tabIconWrapActive]}>
          <Layers
            size={20}
            color={isLoadsActive ? '#F05A22' : '#64748B'}
            strokeWidth={isLoadsActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isLoadsActive && styles.tabLabelActive]}>
          Loads
        </Text>
        {isLoadsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 3: Quotations */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('QUOTATIONS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isQuotationsActive }}
        accessibilityLabel="My Quotations Tab"
      >
        <View style={[styles.tabIconWrap, isQuotationsActive && styles.tabIconWrapActive]}>
          <ClipboardList
            size={20}
            color={isQuotationsActive ? '#F05A22' : '#64748B'}
            strokeWidth={isQuotationsActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isQuotationsActive && styles.tabLabelActive]}>
          Quotations
        </Text>
        {isQuotationsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 4: Bookings */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('BOOKINGS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isBookingsActive }}
        accessibilityLabel="Awarded Bookings Tab"
      >
        <View style={[styles.tabIconWrap, isBookingsActive && styles.tabIconWrapActive]}>
          <CheckCircle2
            size={20}
            color={isBookingsActive ? '#F05A22' : '#64748B'}
            strokeWidth={isBookingsActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isBookingsActive && styles.tabLabelActive]}>
          Bookings
        </Text>
        {isBookingsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 5: More / Profile */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('MORE')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isMoreActive }}
        accessibilityLabel="More Options Tab"
      >
        <View style={[styles.tabIconWrap, isMoreActive && styles.tabIconWrapActive]}>
          <MoreHorizontal
            size={20}
            color={isMoreActive ? '#F05A22' : '#64748B'}
            strokeWidth={isMoreActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isMoreActive && styles.tabLabelActive]}>
          More
        </Text>
        {isMoreActive && <View style={styles.activeTabIndicator} />}
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIconWrapActive: {
    backgroundColor: '#FFF7ED',
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#F05A22',
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    top: -6,
    width: 28,
    height: 3,
    backgroundColor: '#F05A22',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
