import React, { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const W = Dimensions.get('window').width;

/** One shimmering tile-shaped placeholder. */
const Block = memo(function Block({ sweep }: { sweep: Animated.Value }) {
  const x = sweep.interpolate({ inputRange: [0, 1], outputRange: [-140, W] });
  return (
    <View style={s.block}>
      <Animated.View style={[s.sweep, { transform: [{ translateX: x }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

/** Shimmer placeholders that stand in for action tiles while the bundle loads. */
function SheetSkeleton({ count = 3 }: { count?: number }) {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  return (
    <>
      {Array.from({ length: count }, (_, i) => <Block key={i} sweep={sweep} />)}
    </>
  );
}

export default memo(SheetSkeleton);

const s = StyleSheet.create({
  block: {
    flexGrow: 1, flexBasis: '46%', height: 72, borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 140 },
});
