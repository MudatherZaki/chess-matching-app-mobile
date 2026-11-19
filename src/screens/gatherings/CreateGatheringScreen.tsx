import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GatheringsStackParamList } from '@/types';
import { useGatheringStore } from '@/store/gatheringStore';
import { useLocationStore } from '@/store/locationStore';
import { Button, Card, Chip, IconTile, Input, SectionHeader, Toggle } from '@/components';
import { colors, radius, spacing, typography } from '@/theme';
import { getCurrentLocation, requestLocationPermission } from '@/utils/geolocation';
import { timeUtils } from '@/utils';

type Props = NativeStackScreenProps<GatheringsStackParamList, 'CreateGathering'>;

const START_OPTIONS = [
  { label: 'Now', minutes: 0 },
  { label: 'In 30 min', minutes: 30 },
  { label: 'In 1 hour', minutes: 60 },
  { label: 'In 2 hours', minutes: 120 },
];

const DURATION_OPTIONS = [1, 2, 3, 4];

export default function CreateGatheringScreen({ navigation }: Props) {
  const createGathering = useGatheringStore(s => s.createGathering);
  const currentLocation = useLocationStore(s => s.currentLocation);

  const [venueName, setVenueName] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState(
    currentLocation ?? { latitude: 30.0444, longitude: 31.2357 },
  );
  const [startIn, setStartIn] = useState(0);
  const [hours, setHours] = useState(2);
  const [hasBoard, setHasBoard] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start the pin where you are; you can then drag or tap to move it
  useEffect(() => {
    if (currentLocation) return;
    (async () => {
      if (await requestLocationPermission()) {
        try {
          setPin(await getCurrentLocation());
        } catch {
          // keep the default pin
        }
      }
    })();
  }, [currentLocation]);

  const startsAt = new Date(Date.now() + startIn * 60_000);
  const endsAt = new Date(startsAt.getTime() + hours * 3_600_000);

  const handleCreate = async () => {
    if (!venueName.trim()) {
      Alert.alert('Where are you meeting?', 'Give the venue a name, like "Fountain Plaza tables".');
      return;
    }
    setSaving(true);
    try {
      const gathering = await createGathering({
        venueName: venueName.trim(),
        latitude: pin.latitude,
        longitude: pin.longitude,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        note: note.trim() || undefined,
        hasBoard,
      });
      navigation.replace('GatheringDetail', { gatheringId: gathering.id });
    } catch (e: any) {
      Alert.alert("Couldn't create it", e?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Input
        label="Venue"
        icon="place"
        placeholder="Fountain Plaza tables"
        value={venueName}
        onChangeText={setVenueName}
        maxLength={120}
      />

      <SectionHeader title="Spot on the map" icon="map-marker-outline" />
      <Text style={styles.hint}>
        Tap or drag the pin. People nearby only see a rough area until they're in.
      </Text>
      <View style={styles.mapWrap}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          region={{ ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          onPress={e => setPin(e.nativeEvent.coordinate)}>
          <Marker
            coordinate={pin}
            draggable
            onDragEnd={e => setPin(e.nativeEvent.coordinate)}
            pinColor={colors.primary}
          />
        </MapView>
      </View>

      <SectionHeader title="Starts" icon="clock-outline" />
      <View style={styles.chips}>
        {START_OPTIONS.map(o => (
          <Chip key={o.label} label={o.label} active={startIn === o.minutes} onPress={() => setStartIn(o.minutes)} />
        ))}
      </View>

      <SectionHeader title="For how long" icon="timer-sand" />
      <View style={styles.chips}>
        {DURATION_OPTIONS.map(h => (
          <Chip key={h} label={`${h}h`} active={hours === h} onPress={() => setHours(h)} />
        ))}
      </View>
      <Text style={styles.hint}>
        {timeUtils.formatTime(startsAt)} – {timeUtils.formatTime(endsAt)}. Anyone can ask to join
        until it ends.
      </Text>

      <Card style={styles.boardCard}>
        <View style={styles.boardRow}>
          <IconTile icon="checkerboard" color={hasBoard ? colors.primary : colors.textTertiary} />
          <View style={styles.boardInfo}>
            <Text style={styles.boardTitle}>I'm bringing a board</Text>
            <Text style={styles.hint}>So people know there'll be a set to play on</Text>
          </View>
          <Toggle value={hasBoard} onValueChange={setHasBoard} />
        </View>
      </Card>

      <Input
        label="Note (optional)"
        placeholder="Bringing two boards and a clock. Beginners welcome."
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        style={styles.noteInput}
      />

      <Card style={styles.summary}>
        <Text style={styles.summaryText}>
          You'll be the host. Anyone who's in can let new people join, and you can end the
          gathering whenever you're done.
        </Text>
      </Card>

      <Button title="Host gathering" icon="account-group" loading={saving} onPress={handleCreate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  mapWrap: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  map: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  boardCard: { marginBottom: spacing.lg },
  boardRow: { flexDirection: 'row', alignItems: 'center' },
  boardInfo: { flex: 1, marginHorizontal: spacing.sm + 4 },
  boardTitle: { ...typography.bodyBold, color: colors.textPrimary },
  noteInput: { minHeight: 70, textAlignVertical: 'top' },
  summary: { marginVertical: spacing.md },
  summaryText: { ...typography.caption, color: colors.textSecondary },
});
