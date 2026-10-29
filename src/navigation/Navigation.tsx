import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  Theme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { useGatheringStore } from '@/store/gatheringStore';
import { startRealtime, stopRealtime } from '@/services/realtime';
import {
  RootStackParamList,
  AuthStackParamList,
  AppTabParamList,
  HomeStackParamList,
  GatheringsStackParamList,
  ProfileStackParamList,
  SettingsStackParamList,
  MemberJoinedPayload,
} from '@/types';
import { colors, fonts } from '@/theme';
import { LoadingSpinner, JoinedBanner } from '@/components';

// Auth screens
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';

// Home stack screens
import MapScreen from '@/screens/home/MapScreen';
import UserProfileScreen from '@/screens/home/UserProfileScreen';
import SetAvailabilityScreen from '@/screens/home/SetAvailabilityScreen';

// Gatherings stack screens
import GatheringsListScreen from '@/screens/gatherings/GatheringsListScreen';
import GatheringDetailScreen from '@/screens/gatherings/GatheringDetailScreen';
import CreateGatheringScreen from '@/screens/gatherings/CreateGatheringScreen';
import ReviewGatheringScreen from '@/screens/gatherings/ReviewGatheringScreen';

// Profile stack screens
import ProfileScreen from '@/screens/profile/ProfileScreen';
import EditProfileScreen from '@/screens/profile/EditProfileScreen';

// Settings stack screens
import SettingsScreen from '@/screens/settings/SettingsScreen';
import BlockListScreen from '@/screens/settings/BlockListScreen';
import AboutScreen from '@/screens/settings/AboutScreen';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const GatheringsStack = createNativeStackNavigator<GatheringsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.borderLight,
    notification: colors.primary,
  },
};

const screenOptions = {
  headerTintColor: colors.textPrimary,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  // iOS would otherwise label the back button with the previous route's name
  headerBackTitleVisible: false,
  headerTitleStyle: { fontWeight: '800' as const },
  contentStyle: { backgroundColor: colors.background },
};

// Main screens render their own branded AppHeader
const noHeader = { headerShown: false };

const TAB_ICONS: Record<keyof AppTabParamList, string> = {
  HomeStack: 'radar',
  GatheringsStack: 'account-group',
  ProfileStack: 'account-circle-outline',
  SettingsStack: 'cog-outline',
};

const AuthStackNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={screenOptions}>
    <HomeStack.Screen name="Map" component={MapScreen} options={noHeader} />
    <HomeStack.Screen
      name="UserProfile"
      component={UserProfileScreen}
      options={{ headerTitle: "Player's Profile" }}
    />
    <HomeStack.Screen
      name="SetAvailability"
      component={SetAvailabilityScreen}
      options={noHeader}
    />
  </HomeStack.Navigator>
);

const GatheringsStackNavigator = () => (
  <GatheringsStack.Navigator screenOptions={screenOptions}>
    <GatheringsStack.Screen
      name="GatheringsList"
      component={GatheringsListScreen}
      options={noHeader}
    />
    <GatheringsStack.Screen
      name="GatheringDetail"
      component={GatheringDetailScreen}
      options={{ headerTitle: 'Gathering' }}
    />
    <GatheringsStack.Screen
      name="CreateGathering"
      component={CreateGatheringScreen}
      options={{ headerTitle: 'Host a Gathering' }}
    />
    <GatheringsStack.Screen
      name="ReviewGathering"
      component={ReviewGatheringScreen}
      options={{ headerTitle: 'How Did It Go?' }}
    />
  </GatheringsStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={screenOptions}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} options={noHeader} />
    <ProfileStack.Screen
      name="EditProfile"
      component={EditProfileScreen}
      options={{ headerTitle: 'Edit Profile' }}
    />
  </ProfileStack.Navigator>
);

const SettingsStackNavigator = () => (
  <SettingsStack.Navigator screenOptions={screenOptions}>
    <SettingsStack.Screen
      name="Settings"
      component={SettingsScreen}
      options={noHeader}
    />
    <SettingsStack.Screen
      name="BlockList"
      component={BlockListScreen}
      options={{ headerTitle: 'Blocked Players' }}
    />
    <SettingsStack.Screen name="About" component={AboutScreen} options={{ headerTitle: 'About' }} />
  </SettingsStack.Navigator>
);

const AppTabNavigator = () => {
  const requestCount = useGatheringStore(s => s.requestsToApprove.length);
  const fetchRequests = useGatheringStore(s => s.fetchRequests);
  const fetchMine = useGatheringStore(s => s.fetchMine);
  // A fixed height overrides the tab bar's own safe-area padding, so add the
  // home-indicator inset back in
  const { bottom } = useSafeAreaInsets();
  const [joined, setJoined] = useState<MemberJoinedPayload | null>(null);
  const dismissJoined = useCallback(() => setJoined(null), []);
  const openGathering = useCallback((gatheringId: string) => {
    navigationRef.navigate('App', {
      screen: 'GatheringsStack',
      params: { screen: 'GatheringDetail', params: { gatheringId }, initial: false },
    });
  }, []);

  // Load join requests up front so the Gatherings badge is accurate, then keep
  // it current over the live connection. GatheringsListScreen retries and
  // surfaces errors when opened; here we just make sure failures are logged.
  useEffect(() => {
    const refresh = () =>
      fetchRequests().catch(error => {
        console.warn('Failed to load join requests for tab badge:', error);
      });
    refresh();
    startRealtime({
      onJoinRequestReceived: refresh,
      onJoinRequestResolved: () => {
        refresh();
        fetchMine().catch(() => {});
      },
      onMemberJoined: setJoined,
      onGatheringUpdated: () => {
        refresh();
        fetchMine().catch(() => {});
      },
    });
    return () => {
      stopRealtime();
    };
  }, [fetchRequests, fetchMine]);

  return (
    <View style={{ flex: 1 }}>
      <AppTabs.Navigator
        screenOptions={({ route }: { route: { name: keyof AppTabParamList } }) => ({
          headerShown: false,
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Icon name={TAB_ICONS[route.name]} size={focused ? 26 : 24} color={color} />
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            height: 68 + bottom,
            paddingTop: 8,
            paddingBottom: 10 + bottom,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.mono,
            fontSize: 10,
            fontWeight: '700' as const,
            letterSpacing: 0.8,
          },
          tabBarBadgeStyle: {
            backgroundColor: colors.secondary,
            color: colors.textInverse,
            fontSize: 10,
            fontWeight: '800' as const,
          },
        })}>
        <AppTabs.Screen
          name="HomeStack"
          component={HomeStackNavigator}
          options={{ tabBarLabel: 'RADAR' }}
        />
        <AppTabs.Screen
          name="GatheringsStack"
          component={GatheringsStackNavigator}
          options={{
            tabBarLabel: 'GATHERINGS',
            tabBarBadge: requestCount > 0 ? requestCount : undefined,
          }}
        />
        <AppTabs.Screen
          name="ProfileStack"
          component={ProfileStackNavigator}
          options={{ tabBarLabel: 'PROFILE' }}
        />
        <AppTabs.Screen
          name="SettingsStack"
          component={SettingsStackNavigator}
          options={{ tabBarLabel: 'SETTINGS' }}
        />
      </AppTabs.Navigator>
      <JoinedBanner joined={joined} onPress={openGathering} onDismiss={dismissJoined} />
    </View>
  );
};

export const Navigation = () => {
  const { user, restoreToken } = useAuthStore();
  // Only the startup session check gets a full-screen spinner. Sign-in and
  // sign-up also set isLoading; swapping the screen out for them would
  // unmount the form and wipe what the user typed.
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    restoreToken().finally(() => setRestoring(false));
  }, [restoreToken]);

  if (restoring) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="App" component={AppTabNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
