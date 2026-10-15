import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, Package, Layers, Calendar, User } from 'lucide-react-native';

export type ClientNavTab = 'HOME' | 'SHIPMENT' | 'REQUIREMENTS' | 'BOOKINGS' | 'PROFILE';

interface ClientBottomNavBarProps {
  activeTab: ClientNavTab;
  onSelectTab: (tab: ClientNavTab) => void;
}

export const ClientBottomNavBar: React.FC<ClientBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
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
          size={21}
          color={activeTab === 'HOME' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'HOME' ? 2.6 : 1.9}
        />
        <Text style={[styles.tabLabel, activeTab === 'HOME' && styles.tabLabelActive]}>
          Home
        </Text>
        {activeTab === 'HOME' && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 2: Shipment */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('SHIPMENT')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'SHIPMENT' }}
        accessibilityLabel="Shipment Tab"
      >
        <Package
          size={21}
          color={activeTab === 'SHIPMENT' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'SHIPMENT' ? 2.6 : 1.9}
        />
        <Text style={[styles.tabLabel, activeTab === 'SHIPMENT' && styles.tabLabelActive]}>
          Shipment
        </Text>
        {activeTab === 'SHIPMENT' && <View style={styles.activeTabIndicator} />}
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
        <Layers
          size={21}
          color={activeTab === 'REQUIREMENTS' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'REQUIREMENTS' ? 2.6 : 1.9}
        />
        <Text style={[styles.tabLabel, activeTab === 'REQUIREMENTS' && styles.tabLabelActive]}>
          Requirements
        </Text>
        {activeTab === 'REQUIREMENTS' && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 4: Bookings */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('BOOKINGS')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'BOOKINGS' }}
        accessibilityLabel="Bookings Tab"
      >
        <Calendar
          size={21}
          color={activeTab === 'BOOKINGS' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'BOOKINGS' ? 2.6 : 1.9}
        />
        <Text style={[styles.tabLabel, activeTab === 'BOOKINGS' && styles.tabLabelActive]}>
          Bookings
        </Text>
        {activeTab === 'BOOKINGS' && <View style={styles.activeTabIndicator} />}
      </TouchableOpacity>

      {/* Tab 5: Profile */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('PROFILE')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'PROFILE' }}
        accessibilityLabel="Profile Tab"
      >
        <User
          size={21}
          color={activeTab === 'PROFILE' ? '#F15A24' : '#64748B'}
          strokeWidth={activeTab === 'PROFILE' ? 2.6 : 1.9}
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
    fontSize: 10,
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
    width: 28,
    height: 3,
    backgroundColor: '#F15A24',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
