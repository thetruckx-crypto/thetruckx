import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';

interface VehicleThumbnailProps {
  vehicleId?: string;
  category?: string;
  tyres?: number;
  width?: number;
  height?: number;
}

export const VehicleThumbnail: React.FC<VehicleThumbnailProps> = ({
  vehicleId = '',
  width = 68,
  height = 44,
}) => {
  // Determine color theme based on vehicle type
  const isTrailer = vehicleId.includes('TRAILER');
  const isReefer = vehicleId.includes('REEFER');
  const isTanker = vehicleId.includes('TANKER');
  const is14Tyre = vehicleId.includes('14_TYRE');
  const is12Tyre = vehicleId.includes('12_TYRE');
  const is10Tyre = vehicleId.includes('10_TYRE') || vehicleId.includes('32_FT');

  // Cargo body color
  let bodyColor = '#E2E8F0'; // Default container white/gray
  let bodyBorderColor = '#CBD5E1';
  let bodyAccent = '#94A3B8';

  if (is14Tyre) {
    bodyColor = '#FEF08A'; // Yellow tarpaulin as shown in screenshot
    bodyBorderColor = '#EAB308';
    bodyAccent = '#CA8A04';
  } else if (is12Tyre) {
    bodyColor = '#FED7AA'; // Orange / brown container as shown in screenshot
    bodyBorderColor = '#F97316';
    bodyAccent = '#EA580C';
  } else if (is10Tyre) {
    bodyColor = '#F1F5F9'; // White corrugated container as shown in screenshot
    bodyBorderColor = '#CBD5E1';
    bodyAccent = '#94A3B8';
  } else if (isReefer) {
    bodyColor = '#E0F2FE';
    bodyBorderColor = '#38BDF8';
    bodyAccent = '#0284C7';
  } else if (isTanker) {
    bodyColor = '#E2E8F0';
    bodyBorderColor = '#94A3B8';
    bodyAccent = '#64748B';
  } else if (isTrailer) {
    bodyColor = '#CBD5E1';
    bodyBorderColor = '#64748B';
    bodyAccent = '#475569';
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 68 44" fill="none">
        {/* Ground shadow */}
        <Path d="M4 40h60" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />

        {/* Truck Chassis Frame */}
        <Rect x="8" y="32" width="52" height="3" rx="1" fill="#475569" />

        {/* Cargo Body (Rear) */}
        {!isTrailer && (
          <>
            <Rect
              x="22"
              y="10"
              width="38"
              height="22"
              rx="2"
              fill={bodyColor}
              stroke={bodyBorderColor}
              strokeWidth="1.5"
            />
            {/* Ribs / corrugated lines */}
            <Path
              d="M29 12v18M36 12v18M43 12v18M50 12v18M57 12v18"
              stroke={bodyAccent}
              strokeWidth="1"
              strokeOpacity="0.6"
            />
          </>
        )}

        {isTrailer && (
          <Rect
            x="20"
            y="26"
            width="42"
            height="6"
            rx="1"
            fill="#64748B"
            stroke="#475569"
            strokeWidth="1"
          />
        )}

        {/* Truck Cabin (Front) */}
        <Path
          d="M8 32V20c0-1.5 1-2.5 2.5-2.5h7.5c1.5 0 2 1 2 2.5v12H8z"
          fill="#FFFFFF"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />

        {/* Windshield */}
        <Path
          d="M9.5 21h6.5c.5 0 1 .5 1 1v4.5H9.5V21z"
          fill="#0C1A34"
          fillOpacity="0.8"
        />

        {/* Headlight */}
        <Rect x="8" y="28" width="2" height="3" rx="0.5" fill="#F15A24" />

        {/* Front Bumper */}
        <Rect x="6" y="31" width="4" height="3" rx="1" fill="#334155" />

        {/* Front Wheel */}
        <Circle cx="14" cy="35" r="4.5" fill="#1E293B" />
        <Circle cx="14" cy="35" r="2" fill="#94A3B8" />

        {/* Rear Wheels */}
        <Circle cx="34" cy="35" r="4.5" fill="#1E293B" />
        <Circle cx="34" cy="35" r="2" fill="#94A3B8" />

        <Circle cx="44" cy="35" r="4.5" fill="#1E293B" />
        <Circle cx="44" cy="35" r="2" fill="#94A3B8" />

        <Circle cx="54" cy="35" r="4.5" fill="#1E293B" />
        <Circle cx="54" cy="35" r="2" fill="#94A3B8" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
