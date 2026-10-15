import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { ArrowRight, Truck, ShieldCheck, MapPin, TrendingUp, Shield } from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { authService } from '../services/authService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingScreenProps {
  onFinishOnboarding: () => void;
  onSkip: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onFinishOnboarding,
  onSkip,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const handleNext = async () => {
    if (activeSlide < 2) {
      setActiveSlide(activeSlide + 1);
    } else {
      await authService.setOnboardingCompleted();
      onFinishOnboarding();
    }
  };

  const handleSkip = async () => {
    await authService.setOnboardingCompleted();
    onSkip();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Background Sky Gradient */}
      <View style={styles.topGradient}>
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT * 0.58}>
          <Defs>
            <LinearGradient id="sky0" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#082B66" />
              <Stop offset="0.45" stopColor="#0E4494" />
              <Stop offset="0.85" stopColor="#1B5EB8" />
              <Stop offset="1" stopColor="#3074CE" stopOpacity="0.85" />
            </LinearGradient>
            <LinearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0A1931" />
              <Stop offset="0.35" stopColor="#1E3A8A" />
              <Stop offset="0.7" stopColor="#C2410C" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#F97316" stopOpacity="0.85" />
            </LinearGradient>
            <LinearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#082046" />
              <Stop offset="0.4" stopColor="#123470" />
              <Stop offset="0.8" stopColor="#EA580C" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#F97316" stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 L${SCREEN_WIDTH} 0 L${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.58} L0 ${SCREEN_HEIGHT * 0.58} Z`}
            fill={activeSlide === 0 ? 'url(#sky0)' : activeSlide === 1 ? 'url(#sky1)' : 'url(#sky2)'}
          />
        </Svg>
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Row with Skip Button */}
        <View style={styles.topBar}>
          <View style={{ width: 44 }} />
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Official Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/necl-logo.png')}
            style={[styles.logoImage, { tintColor: '#FFFFFF' }]}
            resizeMode="contain"
          />
        </View>

        {activeSlide === 0 ? (
          /* Slide 1 (Reference Image 2: Simplifying Transport for a Stronger Tomorrow) */
          <>
            <View style={styles.textWrap}>
              <Text style={styles.heroTitle}>
                Simplifying Transport{'\n'}
                <Text style={styles.orangeText}>for a Stronger Tomorrow</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Book, manage and track your shipments with trusted transport partners across India.
              </Text>
            </View>

            {/* 3 Circular Glass Badges Row */}
            <View style={styles.badgesRow}>
              <View style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <Truck size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.badgeLabel}>
                  Wide Network{'\n'}of Vehicles
                </Text>
              </View>

              <View style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <ShieldCheck size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.badgeLabel}>
                  Safe & Reliable{'\n'}Deliveries
                </Text>
              </View>

              <View style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <MapPin size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.badgeLabel}>
                  Pan India{'\n'}Coverage
                </Text>
              </View>
            </View>
          </>
        ) : activeSlide === 1 ? (
          /* Slide 2 (Reference Image 1: Connecting Businesses. Delivering Growth.) */
          <>
            <View style={styles.textWrap}>
              <Text style={styles.heroTitle}>
                Connecting Businesses.{'\n'}
                <Text style={styles.orangeText}>Delivering Growth.</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Pan-India contract freight, guaranteed lorry sourcing & transparent multi-point rates.
              </Text>
            </View>

            {/* 3 Feature Columns with Dividers */}
            <View style={styles.featureColsRow}>
              <View style={styles.featureCol}>
                <View style={styles.featureColIconBox}>
                  <Truck size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.featureColLabel}>
                  Reliable{'\n'}Transport
                </Text>
              </View>

              <View style={styles.colDivider} />

              <View style={styles.featureCol}>
                <View style={styles.featureColIconBox}>
                  <Shield size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.featureColLabel}>
                  Trusted{'\n'}Partnerships
                </Text>
              </View>

              <View style={styles.colDivider} />

              <View style={styles.featureCol}>
                <View style={styles.featureColIconBox}>
                  <TrendingUp size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.featureColLabel}>
                  Nationwide{'\n'}Coverage
                </Text>
              </View>
            </View>
          </>
        ) : (
          /* Slide 3: Smart Logistics & Live GPS Tracking */
          <>
            <View style={styles.textWrap}>
              <Text style={styles.heroTitle}>
                Smart Fleet Logistics.{'\n'}
                <Text style={styles.orangeText}>Live GPS Tracking.</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Real-time transit monitoring, digital POD verification & 24/7 control tower operations.
              </Text>
            </View>

            {/* 3 Circular Glass Badges Row */}
            <View style={styles.badgesRow}>
              <View style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <MapPin size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.badgeLabel}>
                  Live GPS{'\n'}Telematics
                </Text>
              </View>

              <View style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <ShieldCheck size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.badgeLabel}>
                  Instant Digital{'\n'}POD Proof
                </Text>
              </View>

              <View style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <Truck size={22} color="#F05A22" strokeWidth={2.2} />
                </View>
                <Text style={styles.badgeLabel}>
                  24/7 Control{'\n'}Tower
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={{ flex: 1 }} />
      </SafeAreaView>

      {/* Bottom Half: Decorative Wave Base */}
      <View style={styles.bottomHeroContainer}>
        {/* Sweeping Wave Curves at Bottom */}
        <View style={styles.bottomWaveOverlay}>
          <Svg
            width={SCREEN_WIDTH}
            height={130}
            viewBox={`0 0 ${SCREEN_WIDTH} 130`}
          >
            <Path
              d={`M0 45 Q ${SCREEN_WIDTH * 0.28} 80 ${SCREEN_WIDTH * 0.65} 115 L ${SCREEN_WIDTH} 130 L 0 130 Z`}
              fill="#0A1931"
            />
            <Path
              d={`M0 58 Q ${SCREEN_WIDTH * 0.32} 92 ${SCREEN_WIDTH * 0.72} 130 L 0 130 Z`}
              fill="#F05A22"
            />
            <Path
              d={`M0 80 Q ${SCREEN_WIDTH * 0.36} 118 ${SCREEN_WIDTH * 0.62} 104 Q ${SCREEN_WIDTH * 0.82} 90 ${SCREEN_WIDTH} 74 L ${SCREEN_WIDTH} 130 L 0 130 Z`}
              fill="#FFFFFF"
            />
          </Svg>
        </View>

        {/* Bottom Bar: Carousel Dots + Orange Circle Arrow Button */}
        <View style={styles.bottomActionRow}>
          {/* Carousel Dots */}
          <View style={styles.dotsWrap}>
            <TouchableOpacity onPress={() => setActiveSlide(0)}>
              <View style={[styles.dot, activeSlide === 0 && styles.activeDot]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveSlide(1)}>
              <View style={[styles.dot, activeSlide === 1 && styles.activeDot]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveSlide(2)}>
              <View style={[styles.dot, activeSlide === 2 && styles.activeDot]} />
            </TouchableOpacity>
          </View>

          {/* Circular Arrow Button */}
          <TouchableOpacity
            style={styles.circleArrowBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <ArrowRight size={24} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1931',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.58,
  },
  safeArea: {
    flex: 1,
    zIndex: 2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  logoImage: {
    width: 240,
    height: 70,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 35,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  orangeText: {
    color: '#F05A22',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 6,
  },
  badgeItem: {
    alignItems: 'center',
    flex: 1,
  },
  badgeCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeLabel: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  featureColsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  featureCol: {
    alignItems: 'center',
    flex: 1,
  },
  featureColIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  featureColLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  colDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  bottomHeroContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.44,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  highwayTruckImage: {
    width: '100%',
    height: '100%',
  },
  bottomWaveOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  bottomActionRow: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  dotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
  },
  circleArrowBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
});
