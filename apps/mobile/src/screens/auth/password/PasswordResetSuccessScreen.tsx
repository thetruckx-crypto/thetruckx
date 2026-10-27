import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { ArrowRight, Home, Check } from 'lucide-react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';

interface PasswordResetSuccessScreenProps {
  onGoToLogin: () => void;
  onBackToHome: () => void;
}

export const PasswordResetSuccessScreen: React.FC<PasswordResetSuccessScreenProps> = ({
  onGoToLogin,
  onBackToHome,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Logo */}
        <View style={styles.logoWrap}>
          <BrandLogoHeader size="md" theme="light" />
        </View>

        {/* Celebratory Checkmark Graphic Matching Reference Image 1 */}
        <View style={styles.graphicWrap}>
          <View style={styles.celebrationCircleContainer}>
            {/* Soft Outer Halo Rings & Radiating Lines */}
            <Svg width={140} height={140} viewBox="0 0 140 140" style={styles.svgRays}>
              {/* Outer soft ring */}
              <Circle cx="70" cy="70" r="54" fill="#E6F9F0" fillOpacity="0.6" />
              {/* Mid soft ring */}
              <Circle cx="70" cy="70" r="42" fill="#D1FAE5" fillOpacity="0.75" />

              {/* Radiating decorative ticks in orange and navy */}
              <Line x1="28" y1="36" x2="36" y2="44" stroke="#F05A22" strokeWidth="3" strokeLinecap="round" />
              <Line x1="112" y1="36" x2="104" y2="44" stroke="#F05A22" strokeWidth="3" strokeLinecap="round" />
              <Line x1="28" y1="104" x2="36" y2="96" stroke="#172B4D" strokeWidth="3" strokeLinecap="round" />
              <Line x1="112" y1="104" x2="104" y2="96" stroke="#F05A22" strokeWidth="3" strokeLinecap="round" />
              <Line x1="18" y1="70" x2="26" y2="70" stroke="#172B4D" strokeWidth="3" strokeLinecap="round" />
              <Line x1="122" y1="70" x2="114" y2="70" stroke="#172B4D" strokeWidth="3" strokeLinecap="round" />
            </Svg>

            {/* Solid Green Checkmark Center Badge */}
            <View style={styles.greenCheckBadge}>
              <Check size={34} color="#FFFFFF" strokeWidth={3.5} />
            </View>
          </View>
        </View>

        {/* Heading & Subtitle */}
        <View style={styles.textWrap}>
          <Text style={styles.titleText}>
            Password Reset{'\n'}
            <Text style={styles.orangeText}>Successful!</Text>
          </Text>
          <Text style={styles.subtitleText}>
            Your password has been updated successfully.{'\n'}
            You can now login to your account.
          </Text>
        </View>

        {/* Action Buttons Matching Reference Image 1 */}
        <View style={styles.actionsWrap}>
          {/* Button 1: Go to Login -> */}
          <TouchableOpacity
            style={styles.goToLoginBtn}
            onPress={onGoToLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.goToLoginBtnText}>Go to Login</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Button 2: Back to Home */}
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={onBackToHome}
            activeOpacity={0.7}
          >
            <Home size={18} color="#172B4D" strokeWidth={2.2} />
            <Text style={styles.backHomeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        {/* Bottom Scenic Highway Truck & Wave Curves */}
        <AuthBottomDecoration height={180} />
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
    marginTop: 18,
    marginBottom: 10,
  },
  graphicWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  celebrationCircleContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgRays: {
    position: 'absolute',
  },
  greenCheckBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172B4D',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 36,
    marginBottom: 10,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
  actionsWrap: {
    paddingHorizontal: 24,
    gap: 12,
  },
  goToLoginBtn: {
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  goToLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backHomeBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backHomeBtnText: {
    color: '#172B4D',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
