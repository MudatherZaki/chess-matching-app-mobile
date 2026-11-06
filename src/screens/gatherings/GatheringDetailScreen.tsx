import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Platform, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Gathering, GatheringPerson, GatheringsStackParamList } from '@/types';
import { apiClient } from '@/services/api';
import { useGatheringStore } from '@/store/gatheringStore';
import { useAuthStore } from '@/store/authStore';
import {
  Avatar,
  Button,
  Card,
  IconTile,
  Input,
  LoadingSpinner,
  RatingBadge,
  SectionHeader,
  Tag,
  Toggle,
  STATUS_LABELS,
  formatWindow,
} from '@/components';
import { colors, spacing, typography } from '@/theme';
import { formatDistance } from '@/utils/geolocation';
import { ratingUtils, timeUtils } from '@/utils';

type Props = NativeStackScreenProps<GatheringsStackParamList, 'GatheringDetail'>;

export default function GatheringDetailScreen({ route, navigation }: Props) {
  const { gatheringId } = route.params;
  const store = useGatheringStore();
  const myId = useAuthStore(s => s.user?.id);
  const requests = store.requestsToApprove.filter(r => r.gatheringId === gatheringId);

  const [gathering, setGathering] = useState<Gathering | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [bringingBoard, setBringingBoard] = useState(false);

  const load = useCallback(async () => {
    try {
      setGathering(await apiClient.getGathering(gatheringId));
    } catch (e: any) {
      Alert.alert('Gathering unavailable', e?.response?.data?.message || 'It may have been cancelled.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [gatheringId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
      store.fetchRequests().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const run = async (key: string, action: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    try {
      await action();
      after ? after() : await load();
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.response?.data?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirm = (title: string, body: string, action: () => void) =>
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: action },
    ]);

  const openProfile = (person: GatheringPerson) =>
    navigation.getParent()?.navigate('HomeStack', {
      screen: 'UserProfile',
      params: { userId: person.id },
      initial: false,
    });

  if (loading) return <LoadingSpinner message="Loading gathering..." />;
  if (!gathering) return null;

  const status = STATUS_LABELS[gathering.status];
  const active = gathering.status === 'open' || gathering.status === 'gathered';
  const point = gathering.location;
  const reviewed = gathering.reviewedByMe ?? [];
  const leftToReview = gathering.members.filter(m => m.id !== myId && !reviewed.includes(m.id));

  const openMaps = () => {
    if (!point) return;
    const destination = `${point.latitude},${point.longitude}`;
    Linking.openURL(
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${destination}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    ).catch(() => {});
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{gathering.venueName ?? 'A gathering nearby'}</Text>
          <Tag label={status.label} color={status.color} dot />
        </View>
        <View style={styles.metaRow}>
          <Icon name="clock-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.meta}>{formatWindow(gathering.startsAt, gathering.endsAt)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Icon name="map-marker-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.meta}>
            {point
              ? 'Exact spot shared with members'
              : gathering.distanceKm !== undefined
                ? `About ${formatDistance(gathering.distanceKm)} away. The exact spot is shared once you're in.`
                : "The exact spot is shared once you're in."}
          </Text>
        </View>
        {gathering.note ? <Text style={styles.note}>{gathering.note}</Text> : null}
        {point && active && (
          <Button title="Directions" icon="navigation-variant" variant="outline" onPress={openMaps} style={styles.top} />
        )}
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title={`${active ? "Who's coming" : 'Who came'} (${gathering.memberCount})`}
          icon="account-group-outline"
        />
        {gathering.members.map(m => (
          <PersonRow
            key={m.id}
            person={m}
            isHost={m.id === gathering.host.id}
            onPress={() => openProfile(m)}
          />
        ))}
      </View>

      {gathering.isMember && active && requests.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Asking to join" icon="hand-wave-outline" />
          <Text style={styles.hint}>One yes from anyone here lets them in.</Text>
          {requests.map(r => (
            <Card key={r.id} style={styles.request}>
              <PersonRow person={r.requester} onPress={() => openProfile(r.requester)} bare />
              {r.message ? <Text style={styles.quote}>"{r.message}"</Text> : null}
              <Text style={styles.hint}>Lapses in {timeUtils.getTimeUntilExpiry(r.expiresAt)}</Text>
              <View style={styles.actions}>
                <Button
                  title="Not this time"
                  variant="dark"
                  disabled={busy === r.id}
                  onPress={() => run(r.id, () => store.rejectRequest(r.id))}
                  style={styles.grow}
                />
                <Button
                  title="Let them in"
                  icon="check"
                  loading={busy === r.id}
                  onPress={() => run(r.id, () => store.approveRequest(r.id))}
                  style={[styles.grow, styles.gap]}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.section}>
        {!gathering.isMember && active && !gathering.myPendingRequestId && (
          <Card>
            <Text style={styles.cardTitle}>Ask to join</Text>
            <Text style={styles.hint}>
              Anyone already in can let you in. Your request lapses after 15 minutes.
            </Text>
            <Input
              placeholder="Say hi (optional)"
              value={message}
              onChangeText={setMessage}
              maxLength={300}
            />
            <View style={styles.boardRow}>
              <IconTile
                icon="checkerboard"
                color={bringingBoard ? colors.primary : colors.textTertiary}
              />
              <Text style={styles.boardLabel}>I'm bringing a board</Text>
              <Toggle value={bringingBoard} onValueChange={setBringingBoard} />
            </View>
            <Button
              title="Ask to join"
              icon="hand-wave-outline"
              loading={busy === 'join'}
              onPress={() =>
                run('join', () =>
                  store.requestToJoin(gathering.id, message.trim() || undefined, bringingBoard),
                )
              }
            />
          </Card>
        )}

        {!gathering.isMember && gathering.myPendingRequestId && (
          <Card>
            <Text style={styles.cardTitle}>Request sent</Text>
            <Text style={styles.hint}>You'll hear back as soon as someone here says yes.</Text>
            <Button
              title="Withdraw request"
              variant="outline"
              loading={busy === 'withdraw'}
              onPress={() => run('withdraw', () => store.withdrawRequest(gathering.myPendingRequestId!))}
            />
          </Card>
        )}

        {gathering.isMember && !gathering.isHost && active && (
          <Button
            title="Leave gathering"
            variant="outline"
            loading={busy === 'leave'}
            onPress={() =>
              confirm('Leave this gathering?', 'You can ask to join again later.', () =>
                run('leave', () => store.leaveGathering(gathering.id), () => navigation.goBack()),
              )
            }
          />
        )}

        {gathering.isHost && active && (
          <>
            <Button
              title="End gathering"
              icon="flag-checkered"
              variant="dark"
              loading={busy === 'end'}
              onPress={() =>
                confirm('End the gathering?', 'Everyone can then leave a short review.', () =>
                  run('end', () => store.endGathering(gathering.id)),
                )
              }
            />
            <Button
              title="Cancel gathering"
              variant="danger"
              loading={busy === 'cancel'}
              onPress={() =>
                confirm('Cancel the gathering?', 'Everyone in it will be told.', () =>
                  run('cancel', () => store.cancelGathering(gathering.id), () => navigation.goBack()),
                )
              }
              style={styles.top}
            />
          </>
        )}

        {gathering.isMember && gathering.status === 'ended' && leftToReview.length > 0 && (
          <Button
            title="Review the meetup"
            icon="message-star-outline"
            onPress={() => navigation.navigate('ReviewGathering', { gatheringId: gathering.id })}
          />
        )}
      </View>
    </ScrollView>
  );
}

function PersonRow({
  person,
  isHost,
  onPress,
  bare,
}: {
  person: GatheringPerson;
  isHost?: boolean;
  onPress: () => void;
  bare?: boolean;
}) {
  const rating = ratingUtils.best(person);
  const row = (
    <TouchableOpacity style={styles.person} onPress={onPress} activeOpacity={0.8}>
      <Avatar photoUrl={person.photoUrl} username={person.username} size={40} shape="circle" />
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{person.fullName || person.username}</Text>
        <View style={styles.personTags}>
          {isHost && <Tag label="Host" color={colors.primary} style={styles.personTag} />}
          {person.hasBoard && <Tag label="Has board" icon="checkerboard" style={styles.personTag} />}
        </View>
      </View>
      {rating ? <RatingBadge label={rating.label} rating={rating.rating} /> : <Tag label="Unrated" />}
    </TouchableOpacity>
  );
  return bare ? row : <Card style={styles.personCard}>{row}</Card>;
}

const styles = StyleSheet.create({
  boardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  boardLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    marginHorizontal: spacing.sm + 4,
  },
  flex: { flex: 1, backgroundColor: colors.background },
  grow: { flex: 1 },
  gap: { marginLeft: spacing.sm },
  top: { marginTop: spacing.sm },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h2, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  meta: { ...typography.caption, color: colors.textSecondary, marginLeft: 6, flex: 1 },
  note: { ...typography.body, color: colors.textPrimary, marginTop: spacing.md },
  hint: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.xs },
  cardTitle: { ...typography.h3, color: colors.textPrimary },
  quote: { ...typography.body, color: colors.textPrimary, fontStyle: 'italic', marginTop: spacing.sm },
  request: { marginBottom: spacing.md },
  actions: { flexDirection: 'row', marginTop: spacing.sm },
  personCard: { marginBottom: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center' },
  personInfo: { flex: 1, marginHorizontal: spacing.md },
  personName: { ...typography.bodyBold, color: colors.textPrimary },
  personTags: { flexDirection: 'row', flexWrap: 'wrap' },
  personTag: { marginRight: spacing.xs, marginTop: 4 },
});
