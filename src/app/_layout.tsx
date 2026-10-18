import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WatchlistProvider } from '../context/WatchlistContext';
import { WatchingProvider } from '../context/WatchingContext';
import { useAlertsBootstrap } from '../services/backgroundRefresh';
import { useNotificationRouting } from '../services/notifications';

// Renders nothing; wires notifications, background refresh and tap routing.
// (Notifications/background tasks need a development build, not Expo Go.)
function AlertsBootstrap() {
  useAlertsBootstrap();
  useNotificationRouting();
  return null;
}

export default function RootLayout() {
  return (
    <WatchlistProvider>
    <WatchingProvider>
      <StatusBar style="light" />
      <AlertsBootstrap />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="content/[id]"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="upcoming"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="alerts"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="watching-progress/[id]"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: true,
          }}
        />
      </Stack>
    </WatchingProvider>
    </WatchlistProvider>
  );
}
