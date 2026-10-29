import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { HomeStackParamList } from '@/types';
import { useLocationStore } from '@/store/locationStore';
import { useAuthStore } from '@/store/authStore';
import { AppHeader, Button, Card, Tag, Toggle, IconTile, SectionHeader } from '@/components';
import { colors, spacing, typography, radius } from '@/theme';
import { getCurrentLocation, requestLocationPermission } from '@/utils/geolocation';

type Props = NativeStackScreenProps<HomeStackParamList, 'SetAvailability'>;

const DURATION_OPTIONS: { hours: number; label: string; hint: string; icon: string }[] = [
  { hours: 1, label: 'Quick', hint: '1 hour', icon: 'lightning-bolt' },
  { hours: 2, label: 'Session', hint: '2 hours', icon: 'timer-outline' },
  { hours: 4, label: 'Afternoon', hint: '4 hours', icon: 'weather-sunny' },
  { hours: 8, label: 'All Day', hint: '8 hours', icon: 'coffee-outline' },
];

export default function SetAvailabilityScreen({ navigation }: Props) {
  const { isAvailable, currentLocation, setAvailability, setUnavailable, isLoading } =
    useLocationStore();
  // Starts from the profile, since dropping the beacon saves this back to it
  const profileHasBoard = useAuthStore(s => !!s.user?.hasBoard);
  const [hasBoard, setHasBoard] = useState(profileHasBoard);
  const [duration, setDuration] = useState(4);
  const [locating, setLocating] = useState(false);

  const goOffline = async () => {
    try {
      await setUnavailable();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update availability');
    }
  };

  const dropBeacon = async () => {
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Location needed', 'Enable location access to drop your beacon.');
        return;
      }
      const location = await getCurrentLocation();
      await setAvailability(location, hasBoard, duration);
      Alert.alert('Beacon live!', "Nearby players can now see that you're up for a game.");
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const busy = isLoading || locating;
  const statusColor = isAvailable ? colors.primary : colors.textTertiary;

  return (
    <View style={styles.flex}>
      <AppHeader subtitle="Radar" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Tag label="Park radar broadcast" icon="access-point" color={colors.primary} />
        <Text style={styles.title}>Drop Your Chess Beacon</Text>
        <Text style={styles.subtitle}>
          Signal nearby players that you'd like to meet up for a game.
        </Text>

        <Card style={styles.statusCard} accent={isAvailable ? colors.primary : undefined}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIcon,
                { borderColor: statusColor + '66', backgroundColor: statusColor + '1A' },
              ]}>
              <Icon
                name={isAvailable ? 'broadcast' : 'broadcast-off'}
                size={24}
                color={statusColor}
              />
            </View>
            <View style={styles.flexFill}>
              <Text style={styles.statusTitle}>
                Status: {isAvailable ? 'Live Beacon Active' : 'Beacon Offline'}
              </Text>
              <Text style={[styles.statusSub, { color: statusColor }]}>
                {isAvailable ? 'Visible to nearby players' : 'Nobody can see you yet'}
              </Text>
            </View>
            <Tag label={isAvailable ? 'Online' : 'Offline'} dot color={statusColor} />
          </View>

          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={20} color={colors.primary} />
            <View style={styles.flexFill}>
              <Text style={styles.locationLabel}>Broadcasting at</Text>
              <Text style={styles.locationValue} numberOfLines={1}>
                {currentLocation?.address || (currentLocation ? 'Your current spot' : 'Location not set')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={dropBeacon}
              disabled={busy || !isAvailable}
              style={[styles.changeButton, !isAvailable && styles.hidden]}>
              <Text style={styles.changeText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gps}>
            <Icon
              name={currentLocation ? 'crosshairs-gps' : 'crosshairs-question'}
              size={16}
              color={currentLocation ? colors.primary : colors.textTertiary}
            />
            <Text style={styles.gpsText}>
              {currentLocation
                ? `GPS Locked · ${currentLocation.latitude.toFixed(4)}°, ${currentLocation.longitude.toFixed(4)}°`
                : 'GPS will lock when you go live'}
            </Text>
          </View>
        </Card>

        <SectionHeader
          title="Gear confirmation"
          mono
          right={
            <Text style={[styles.gearCount, { color: hasBoard ? colors.primary : colors.textTertiary }]}>
              {hasBoard ? '1 / 1 Ready' : '0 / 1 Ready'}
            </Text>
          }
        />
        <Card style={styles.gearCard}>
          <View style={styles.gearRow}>
            <IconTile icon="checkerboard" color={hasBoard ? colors.primary : colors.textTertiary} />
            <View style={styles.flexFill}>
              <Text style={styles.gearTitle}>Physical Chess Board</Text>
              <Text style={styles.gearSub}>Bring a set so you can play anywhere</Text>
            </View>
            <Toggle value={hasBoard} onValueChange={setHasBoard} />
          </View>
        </Card>

        <SectionHeader
          title="Stay visible for"
          mono
          right={<Text style={styles.hint}>Auto-expires</Text>}
        />
        <View style={styles.grid}>
          {DURATION_OPTIONS.map(opt => {
            const selected = duration === opt.hours;
            return (
              <TouchableOpacity
                key={opt.hours}
                activeOpacity={0.85}
                onPress={() => setDuration(opt.hours)}
                style={[styles.tile, selected && styles.tileSelected]}>
                {selected && <View style={styles.tileDot} />}
                <Icon
                  name={opt.icon}
                  size={20}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.tileTitle, selected && { color: colors.primary }]}>
                  {opt.label}
                </Text>
                <Text style={styles.tileHint}>{opt.hint}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title={isAvailable ? 'Update Beacon' : 'Drop Beacon'}
          icon="broadcast"
          size="lg"
          onPress={dropBeacon}
          loading={busy}
          style={styles.cta}
        />
        {isAvailable && (
          <Button
            title="Go Offline"
            icon="power"
            variant="dark"
            onPress={goOffline}
            disabled={busy}
            style={styles.offline}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flexFill: { flex: 1, marginLeft: spacing.sm + 4 },
  hidden: { opacity: 0 },
  container: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.display, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  statusCard: { marginTop: spacing.lg, marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { ...typography.h3, fontWeight: '800', color: colors.textPrimary },
  statusSub: { ...typography.caption, fontWeight: '600', marginTop: 2 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 12,
    marginTop: spacing.md,
  },
  locationLabel: { ...typography.small, color: colors.textSecondary },
  locationValue: { ...typography.bodyBold, fontWeight: '800', color: colors.textPrimary },
  changeButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeText: { ...typography.label, fontSize: 10, color: colors.textPrimary },
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 10,
    marginTop: spacing.sm + 4,
  },
  gpsText: { ...typography.label, fontSize: 11, textTransform: 'none', color: colors.textPrimary, marginLeft: 8 },
  gearCount: { ...typography.label, fontSize: 11 },
  gearCard: { marginBottom: spacing.lg },
  gearRow: { flexDirection: 'row', alignItems: 'center' },
  gearTitle: { ...typography.bodyBold, fontWeight: '800', color: colors.textPrimary },
  gearSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  hint: { ...typography.caption, color: colors.secondary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  tileSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  tileDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  tileTitle: { ...typography.h3, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  tileHint: { ...typography.label, fontSize: 11, textTransform: 'none', color: colors.textSecondary, marginTop: 2 },
  cta: { marginTop: spacing.md },
  offline: { marginTop: spacing.sm + 2 },
});
