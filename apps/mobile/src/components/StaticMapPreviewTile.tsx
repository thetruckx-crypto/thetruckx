import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Path, Circle, Text as SvgText } from 'react-native-svg';
import { MapPin } from 'lucide-react-native';

interface StaticMapPreviewTileProps {
  label?: string;
  city?: string;
  onPress?: () => void;
}

export const StaticMapPreviewTile: React.FC<StaticMapPreviewTileProps> = ({
  label,
  city,
  onPress,
}) => {
  const displayLabel = label?.trim() || city?.trim() || 'Consignment Location';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Map preview for ${displayLabel}`}
    >
      <Svg width="100%" height="100%" viewBox="0 0 160 110" preserveAspectRatio="none">
        {/* Background land */}
        <Rect x="0" y="0" width="160" height="110" fill="#E8ECE9" />

        {/* River water path */}
        <Path
          d="M 0,75 C 40,65 70,85 110,70 C 130,62 145,68 160,65 L 160,88 C 140,92 120,85 90,95 C 60,105 30,90 0,98 Z"
          fill="#BAE6FD"
        />

        {/* Secondary roads */}
        <Path
          d="M 10,0 L 45,110 M 110,0 L 80,110 M 0,35 L 160,45 M 0,85 L 160,80"
          stroke="#FFFFFF"
          strokeWidth="3.5"
        />

        {/* Main highway */}
        <Path
          d="M 0,20 C 50,22 80,45 130,50 L 160,55"
          stroke="#FDE047"
          strokeWidth="4"
        />
        <Path
          d="M 65,0 C 70,40 75,70 95,110"
          stroke="#FFFFFF"
          strokeWidth="4"
        />

        {/* Green park zone */}
        <Path
          d="M 120,10 C 135,8 150,15 155,30 C 145,35 130,30 120,20 Z"
          fill="#DCFCE7"
        />

        {/* Pin pulse circle */}
        <Circle cx="80" cy="50" r="14" fill="rgba(240, 90, 36, 0.2)" />
        <Circle cx="80" cy="50" r="8" fill="rgba(240, 90, 36, 0.4)" />

        {/* Google watermark text */}
        <SvgText
          x="6"
          y="102"
          fontSize="9"
          fontWeight="bold"
          fill="#475569"
          letterSpacing="0.2"
        >
          Google
        </SvgText>
      </Svg>

      {/* Red marker overlay */}
      <View style={styles.pinOverlay}>
        <View style={styles.pinMarker}>
          <MapPin size={16} color="#DC2626" fill="#DC2626" />
        </View>
        <View style={styles.labelBubble}>
          <Text style={styles.labelText} numberOfLines={1}>
            {displayLabel}
          </Text>
        </View>
      </View>

      {city ? (
        <View style={styles.cityBadge}>
          <Text style={styles.cityText}>{city}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 98,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E8ECE9',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  pinMarker: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  labelBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#DC2626',
    marginTop: -2,
    maxWidth: 120,
  },
  labelText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  cityBadge: {
    position: 'absolute',
    bottom: 4,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  cityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#334155',
  },
});
