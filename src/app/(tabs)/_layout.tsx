import React, { useRef, useCallback, useEffect } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import {
  View,
  Pressable,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useDerivedValue,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';

const AnimatedText = Reanimated.createAnimatedComponent(
  require('react-native').Text
);

const TAB_LIST = [
  { name: 'index', label: 'Home', icon: 'home' as const, route: '/' },
  { name: 'search', label: 'Search', icon: 'search' as const, route: '/search' },
  { name: 'list', label: 'List', icon: 'bookmark' as const, route: '/watchlist' },
  { name: 'stats', label: 'Stats', icon: 'stats-chart' as const, route: '/stats' },
  { name: 'watching', label: 'Current', icon: 'play-circle' as const, route: '/watching' },
];

// Pill dimensions — sized to cover icon + text
const PILL_PADDING_H = 6;

// Animation config
const SLIDE_CONFIG = {
  duration: 400,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

const COLOR_CONFIG = {
  duration: 350,
  easing: Easing.out(Easing.cubic),
};

const ACTIVE_COLOR = '#10B981';
const INACTIVE_COLOR = '#71717A';
const INACTIVE_LABEL_COLOR = '#52525B';

// ── Individual Tab Item ──────────────────────────────
function TabItem({
  tab,
  index,
  activeIndex,
  onPress,
  onLayout,
}: {
  tab: (typeof TAB_LIST)[number];
  index: number;
  activeIndex: number;
  onPress: (index: number) => void;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
}) {
  // Animate between 0 (inactive) and 1 (active)
  const progress = useDerivedValue(() => {
    return withTiming(activeIndex === index ? 1 : 0, COLOR_CONFIG);
  }, [activeIndex, index]);

  const animatedLabelStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 1],
      [INACTIVE_LABEL_COLOR, ACTIVE_COLOR]
    );
    return { color };
  });

  const isActive = activeIndex === index;

  return (
    <View
      style={styles.tabWrapper}
      onLayout={(e) => onLayout(index, e)}
    >
      <Pressable
        style={styles.tabPressable}
        onPress={() => onPress(index)}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={isActive ? tab.icon : (`${tab.icon}-outline` as any)}
            size={20}
            color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
          />
        </View>
        <AnimatedText
          style={[styles.tabLabel, animatedLabelStyle]}
        >
          {tab.label}
        </AnimatedText>
      </Pressable>
    </View>
  );
}

// ── Tabs Layout ──────────────────────────────────────
export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 12);

  // ── State ──────────────────────────────────────────
  const tabLayouts = useRef<{ x: number; width: number }[]>([]);
  const layoutsReady = useRef(false);

  // Reanimated shared values for the indicator
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(60);

  // ── Active index from pathname ─────────────────────
  const activeIndex = TAB_LIST.findIndex((t) => t.route === pathname);
  // Detail screens (content/[id], ...) sit above the tabs and change the
  // pathname; keep the last real tab highlighted so the pill doesn't jump.
  const lastIndex = useRef(0);
  if (activeIndex >= 0) lastIndex.current = activeIndex;
  const safeActiveIndex = lastIndex.current;

  // ── Indicator helpers ──────────────────────────────
  const slideIndicator = useCallback(
    (index: number, animated = true) => {
      const tab = tabLayouts.current[index];
      if (!tab) return;

      const targetX = tab.x + PILL_PADDING_H / 2;
      const targetW = tab.width - PILL_PADDING_H;

      if (animated) {
        indicatorX.value = withTiming(targetX, SLIDE_CONFIG);
        indicatorW.value = withTiming(targetW, SLIDE_CONFIG);
      } else {
        indicatorX.value = targetX;
        indicatorW.value = targetW;
      }
    },
    [indicatorX, indicatorW]
  );

  // ── Slide indicator when active route changes ──────
  useEffect(() => {
    if (layoutsReady.current) {
      slideIndicator(safeActiveIndex, true);
    }
  }, [pathname, safeActiveIndex, slideIndicator]);

  // ── Measure tab positions ──────────────────────────
  const onTabLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      tabLayouts.current[index] = { x, width };

      const allMeasured =
        tabLayouts.current.filter(Boolean).length === TAB_LIST.length;
      if (allMeasured && !layoutsReady.current) {
        layoutsReady.current = true;
        slideIndicator(safeActiveIndex, false);
      }
    },
    [safeActiveIndex, slideIndicator]
  );

  // ── Tab press handler ──────────────────────────────
  const onTabPress = useCallback(
    (index: number) => {
      if (index === safeActiveIndex) return;
      slideIndicator(index, true);
      router.replace(TAB_LIST[index].route as any);
    },
    [slideIndicator, router, safeActiveIndex]
  );

  // ── Animated indicator style ───────────────────────
  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorX.value }],
      width: indicatorW.value,
    };
  });

  return (
    <View className="flex-1 bg-black">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="watchlist" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="watching" />
      </Tabs>

      {/* Custom Floating Tab Bar */}
      <View
        style={[
          styles.barContainer,
          { bottom: bottomOffset },
        ]}
      >
        {/* ── Sliding indicator pill (covers icon + text) ── */}
        <Reanimated.View
          pointerEvents="none"
          style={[styles.indicator, indicatorStyle]}
        />

        {TAB_LIST.map((tab, index) => (
          <TabItem
            key={tab.name}
            tab={tab}
            index={index}
            activeIndex={safeActiveIndex}
            onPress={onTabPress}
            onLayout={onTabLayout}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  indicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: 9999,
    backgroundColor: 'rgba(16, 185, 129, 0.13)',
  },
  tabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
