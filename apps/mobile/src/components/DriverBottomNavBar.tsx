import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Truck, ShieldCheck, Bell, User } from 'lucide-react-native';

export type DriverNavTab =
  | 'HOME'
  | 'TRIPS'
  | 'VERIFICATION'
  | 'NOTIFICATIONS'
  | 'PROFILE';

interface DriverBottomNavBarProps {
  activeTab: DriverNavTab | string;
  onSelectTab: (tab: DriverNavTab) => void;
  unreadNotificationsCount?: number;
}

/**
 * DriverBottomNavBar — Standard THE TRUCKX 5-Tab Navigation for Heavy Transport Drivers:
 * Tab 1: Home — Driver Dashboard & Quick Operations
 * Tab 2: My Trips — Assigned Trips & Transit Dispatches
 * Tab 3: Verification — Driver Credentials, DL & Verification Status
 * Tab 4: Notifications — In-app alerts, trip dispatches & updates
 * Tab 5: Profile — Commercial Driver Profile & Account Settings
 */
export const DriverBottomNavBar: React.FC<DriverBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  unreadNotificationsCount = 0,
}) => {
  const isHomeActive = activeTab === 'HOME';
  const isTripsActive = activeTab === 'TRIPS';
  const isVerificationActive = activeTab === 'VERIFICATION';
  const isNotificationsActive = activeTab === 'NOTIFICATIONS';
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

      {/* Tab 2: My Trips */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('TRIPS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isTripsActive }}
        accessibilityLabel="My Trips Tab"
      >
        <View style={[styles.tabIconWrap, isTripsActive && styles.tabIconWrapActive]}>
          <Truck
            size={20}
            color={isTripsActive ? '#F05A22' : '#64748B'}
            strokeWidth={isTripsActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isTripsActive && styles.tabLabelActive]}>
          My Trips
        </Text>
        {isTripsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 3: Verification */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('VERIFICATION')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isVerificationActive }}
        accessibilityLabel="Verification Tab"
      >
        <View style={[styles.tabIconWrap, isVerificationActive && styles.tabIconWrapActive]}>
          <ShieldCheck
            size={20}
            color={isVerificationActive ? '#F05A22' : '#64748B'}
            strokeWidth={isVerificationActive ? 2.4 : 1.8}
          />
        </View>
        <Text style={[styles.tabLabel, isVerificationActive && styles.tabLabelActive]}>
          Verification
        </Text>
        {isVerificationActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 4: Notifications */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('NOTIFICATIONS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isNotificationsActive }}
        accessibilityLabel="Notifications Tab"
      >
        <View style={[styles.tabIconWrap, isNotificationsActive && styles.tabIconWrapActive]}>
          <Bell
            size={20}
            color={isNotificationsActive ? '#F05A22' : '#64748B'}
            strokeWidth={isNotificationsActive ? 2.4 : 1.8}
          />
          {unreadNotificationsCount > 0 && (
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.tabLabel, isNotificationsActive && styles.tabLabelActive]}>
          Alerts
        </Text>
        {isNotificationsActive && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 5: Profile */}
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
            size={20}
            color={isProfileActive ? '#F05A22' : '#64748B'}
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
  badgeWrap: {
    position: 'absolute',
    top: 0,
    right: 2,
    backgroundColor: '#EF4444',
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
});

