import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import {
  Building2,
  Store,
  Truck,
  UserCheck,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { MobileRole } from '../../../types';

interface ChooseAccountTypeScreenProps {
  selectedRole: MobileRole;
  onSelectRole: (role: MobileRole) => void;
  onContinue: (role?: MobileRole) => void;
  onSkip?: () => void;
  onBack?: () => void;
}

export const ChooseAccountTypeScreen: React.FC<ChooseAccountTypeScreenProps> = ({
  selectedRole,
  onSelectRole,
  onContinue,
  onSkip,
  onBack,
}) => {
  const handleRolePress = (role: MobileRole) => {
    onSelectRole(role);
    onContinue(role);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Bar with Skip */}
        <View style={styles.topBar}>
          <View style={{ width: 44 }} />
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => (onSkip ? onSkip() : onContinue())}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Logo Center */}
        <View style={styles.logoWrap}>
          <BrandLogoHeader size="md" theme="light" />
        </View>

        {/* Heading & Subtitle Matching Reference Image 2 */}
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            Choose Your Role{'\n'}
            <Text style={styles.orangeText}>to Get Started</Text>
          </Text>
          <Text style={styles.subtitleText}>
            Select how you want to use our platform
          </Text>
        </View>

        {/* 3 Large Role Cards Matching Reference Image 2 */}
        <View style={styles.cardsWrap}>
          {/* Card 1: Client */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'CLIENT' && styles.roleCardActive,
            ]}
            onPress={() => handleRolePress('CLIENT')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconSquircle}>
                <Building2 size={24} color="#F05A22" strokeWidth={2} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardTitle}>Client</Text>
                <Text style={styles.cardDesc}>
                  Book shipments, track your cargo and manage your logistics needs.
                </Text>
              </View>
            </View>

            {/* Right Visual Snippet & Orange Action Arrow Circle */}
            <View style={styles.cardVisualWrap}>
              <View style={styles.thumbnailBox}>
                <Building2 size={22} color="#F05A22" />
              </View>
              <View style={styles.actionCircleBtn}>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 2: Vendor */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'VENDOR' && styles.roleCardActive,
            ]}
            onPress={() => handleRolePress('VENDOR')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconSquircle}>
                <Store size={24} color="#F05A22" strokeWidth={2} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardTitle}>Vendor</Text>
                <Text style={styles.cardDesc}>
                  List your vehicles, provide quotations and grow your business with us.
                </Text>
              </View>
            </View>

            {/* Right Visual Snippet & Orange Action Arrow Circle */}
            <View style={styles.cardVisualWrap}>
              <View style={styles.thumbnailBox}>
                <Store size={22} color="#F05A22" />
              </View>
              <View style={styles.actionCircleBtn}>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 3: Driver */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'DRIVER' && styles.roleCardActive,
            ]}
            onPress={() => handleRolePress('DRIVER')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconSquircle}>
                <UserCheck size={24} color="#F05A22" strokeWidth={2} />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={styles.cardTitle}>Driver</Text>
                <Text style={styles.cardDesc}>
                  View assigned trips, update status and deliver with confidence.
                </Text>
              </View>
            </View>

            {/* Right Visual Snippet & Orange Action Arrow Circle */}
            <View style={styles.cardVisualWrap}>
              <View style={styles.thumbnailBox}>
                <UserCheck size={22} color="#F05A22" />
              </View>
              <View style={styles.actionCircleBtn}>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, minHeight: 20 }} />

        {/* Bottom Scenic Highway Truck & Wave Decoration */}
        <AuthBottomDecoration height={180} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  titleText: {
    fontSize: 27,
    fontWeight: '800',
    color: '#172B4D',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 35,
    marginBottom: 6,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
  },
  cardsWrap: {
    paddingHorizontal: 20,
    gap: 14,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5EAF0',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  roleCardActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFFDFB',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  cardIconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  cardVisualWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  thumbnailBox: {
    width: 60,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
});
