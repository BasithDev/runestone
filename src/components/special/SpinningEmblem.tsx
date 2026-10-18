import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  size?: number;
  style?: ViewStyle;
}

/** Large, faint, slowly rotating decoration (e.g. a ship's wheel). */
export default function SpinningEmblem({ icon, color, size = 150, style }: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', transform: [{ rotate }] }, style]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Animated.View>
  );
}
