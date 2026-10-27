import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  ArrowRight,
  MapPin,
  Truck,
  CheckCircle2,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { authService } from '../../../services/authService';
import { mobileNotificationService } from '../../../services/notificationService';

interface NotificationPermissionScreenProps {
  onAllow: () => void;
  onSkip: () => void;
}

export const NotificationPermissionScreen: React.FC<NotificationPermissionScreenProps> = ({
  onAllow,
  onSkip,
}) => {
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    setLoading(true);
    try {
      await authService.setNotificationPermission(true);
      const session = await authService.getCurrentSession().catch(() => null);
      await mobileNotificationService.requestPushPermissionAndRegister(
        session?.userId,
        session?.role
      );
      onAllow();
    } catch {
      onAllow();
    } finally {
      setLoading(false);
    }
  };

  const handleNotNow = async () => {
    await authService.setNotificationPermission(false);
    onSkip();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Logo */}
        <View style={styles.logoWrap}>
          <BrandLogoHeader size="md" theme="light" />
        </View>

        {/* Center Permission Graphic */}
        <View style={styles.graphicSection}>
          <View style={styles.bellOuterCircle}>
            <View style={styles.bellInnerCircle}>
              <Bell size={42} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </View>
        </View>

        {/* Heading & Subtitle */}
        <View style={styles.textWrap}>
          <Text style={styles.titleText}>
            Never Miss a{'\n'}
            <Text style={styles.orangeText}>Delivery Update</Text>
          </Text>
          <Text style={styles.subtitleText}>
            Enable push notifications to stay informed on live lorry dispatches, trip arrivals, and instant digital POD sign-offs.
          </Text>
        </View>

        {/* 3 Value Pillars */}
        <View style={styles.valueList}>
          <View style={styles.valueItem}>
            <View style={[styles.valueIconBox, { backgroundColor: '#EFF6FF' }]}>
              <MapPin size={18} color="#2563EB" />
            </View>
            <View style={styles.valueTextCol}>
              <Text style={styles.valueTitle}>Live GPS Transit Alerts</Text>
              <Text style={styles.valueDesc}>Real-time checkpoints and arrival notifications</Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <View style={[styles.valueIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Truck size={18} color="#F05A22" />
            </View>
            <View style={styles.valueTextCol}>
              <Text style={styles.valueTitle}>Lorry Placement & Dispatch</Text>
              <Text style={styles.valueDesc}>Instant alert when vehicle is attached to your load</Text>
            </View>
          </View>

          <View style={styles.valueItem}>
            <View style={[styles.valueIconBox, { backgroundColor: '#F0FDF4' }]}>
              <CheckCircle2 size={18} color="#16A34A" />
            </View>
            <View style={styles.valueTextCol}>
              <Text style={styles.valueTitle}>Digital POD Sign-Off</Text>
              <Text style={styles.valueDesc}>Immediate proof of consignment handover</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.allowBtn}
            onPress={handleAllow}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.allowBtnText}>Allow Notifications</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notNowBtn}
            onPress={handleNotNow}
            activeOpacity={0.7}
          >
            <Text style={styles.notNowBtnText}>Not Now</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        {/* Bottom Truck & Wave Decoration */}
        <AuthBottomDecoration height={160} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  graphicSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  bellOuterCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellInnerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#172B4D',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 33,
    marginBottom: 8,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  valueList: {
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  valueIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTextCol: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#172B4D',
  },
  valueDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  actionsWrap: {
    paddingHorizontal: 24,
    gap: 10,
  },
  allowBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  notNowBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  notNowBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
