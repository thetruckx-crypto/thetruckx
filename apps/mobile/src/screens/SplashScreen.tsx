import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { authService, AuthSessionData } from '../services/authService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashScreenProps {
  onSessionFound: (session: AuthSessionData) => void;
  onFirstTimeUser: () => void;
  onReturningUser: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onSessionFound,
  onFirstTimeUser,
  onReturningUser,
}) => {
  const [loadingText, setLoadingText] = useState('Preparing your logistics workspace...');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Responsive logo sizing based on screen dimensions
  const logoWidth = Math.min(SCREEN_WIDTH * 0.68, 260);
  const logoHeight = Math.round(logoWidth * (979 / 2560));

  useEffect(() => {
    let mounted = true;

    // 1. Smooth Fade-in on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // 2. Continuous Native Spinner Rotation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    // 3. Subtle Spinner Pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Helper to change loading text with smooth micro-fade
    const updateStatusText = (newText: string) => {
      if (!mounted) return;
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        if (!mounted) return;
        setLoadingText(newText);
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    };

    // 4. Background Initialization & Multi-stage loading progression
    const runInitialization = async () => {
      try {
        // Stage 1: Network & Workspace
        const stage1 = setTimeout(() => {
          updateStatusText('Connecting to freight network...');
        }, 850);

        // Stage 2: Check for existing session
        const existingSession = await authService.checkExistingSession();

        const stage2 = setTimeout(() => {
          updateStatusText('Initializing secure session...');
        }, 1650);

        // Stage 3: Smooth exit transition automatically
        const stage3 = setTimeout(() => {
          if (!mounted) return;

          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }).start(() => {
            if (!mounted) return;
            if (existingSession && typeof onSessionFound === 'function') {
              onSessionFound(existingSession);
            } else if (typeof onReturningUser === 'function') {
              onReturningUser();
            } else if (typeof onFirstTimeUser === 'function') {
              onFirstTimeUser();
            }
          });
        }, 2450);

        return () => {
          clearTimeout(stage1);
          clearTimeout(stage2);
          clearTimeout(stage3);
        };
      } catch (err) {
        console.warn('Splash initialization check:', err);
        setTimeout(() => {
          if (!mounted) return;
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => {
            if (mounted && typeof onReturningUser === 'function') {
              onReturningUser();
            }
          });
        }, 2000);
      }
    };

    runInitialization();

    return () => {
      mounted = false;
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.rootContainer}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      <Animated.View style={[styles.canvasContainer, { opacity: fadeAnim }]}>
        {/* Layer 1: High-res background art with India map at top, waves, and sunset truck at bottom (no baked-in logo, loader or text) */}
        <Image
          source={require('../../assets/necl-splash-bg-clean.jpg')}
          style={styles.fullScreenImage}
          resizeMode="cover"
        />

        {/* Layer 2: Foreground Real Branding, Rotating Loading, and Real Loading Text */}
        <View style={styles.foregroundContainer}>
          {/* Real Official NECL HD Logo */}
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/necl-logo.png')}
              style={{ width: logoWidth, height: logoHeight }}
              resizeMode="contain"
              accessibilityLabel="North Eastern Carriers Logo"
            />
          </View>

          {/* Crisp Tagline Typography */}
          <Text style={styles.taglineText}>
            Commercial Freight & Logistics Network
          </Text>

          {/* Real Rotating Loading Indicator */}
          <View style={styles.loaderArea}>
            <Animated.View
              style={[
                styles.spinnerRingContainer,
                {
                  transform: [{ rotate: spin }, { scale: pulseAnim }],
                },
              ]}
            >
              <Svg width={44} height={44} viewBox="0 0 44 44">
                <Defs>
                  <LinearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#F05A22" stopOpacity="1" />
                    <Stop offset="65%" stopColor="#FFA26B" stopOpacity="0.8" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
                  </LinearGradient>
                </Defs>
                <Circle
                  cx={22}
                  cy={22}
                  r={17}
                  stroke="url(#orangeGrad)"
                  strokeWidth={3.8}
                  strokeLinecap="round"
                  strokeDasharray="76 30"
                  fill="none"
                />
              </Svg>
            </Animated.View>
          </View>

          {/* Real Loading Text */}
          <Animated.View style={[styles.loadingTextWrap, { opacity: textFadeAnim }]}>
            <Text style={styles.loadingText} numberOfLines={1}>
              {loadingText}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF9F4', // Warm cream base matching top sky
    width: '100%',
    height: '100%',
  },
  canvasContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fullScreenImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  foregroundContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.28, // Sits precisely in the luminous middle canvas zone
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  taglineText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0A1931',
    letterSpacing: 0.25,
    textAlign: 'center',
    marginBottom: 24,
  },
  loaderArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  spinnerRingContainer: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingTextWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minHeight: 22,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
