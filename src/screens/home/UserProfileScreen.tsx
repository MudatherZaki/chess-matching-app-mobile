import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { HomeStackParamList, UserPublicProfile } from '@/types';
import { apiClient } from '@/services/api';
import { useProposalStore } from '@/store/proposalStore';
import {
  Avatar,
  RatingBadge,
  Button,
  Card,
  Input,
  LinkedAccountCard,
  LoadingSpinner,
} from '@/components';
import { colors, spacing, typography, radius } from '@/theme';
import { getCurrentLocation, requestLocationPermission } from '@/utils/geolocation';

type Props = NativeStackScreenProps<HomeStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { createProposal } = useProposalStore();

  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showProposeForm, setShowProposeForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.getUserProfile(userId);
        setProfile(data);
      } catch {
        Alert.alert('Error', 'Could not load this profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleSendProposal = async () => {
    setSending(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Location needed', 'Enable location to set a meeting spot.');
        return;
      }
      const location = await getCurrentLocation();
      await createProposal({
        receiverId: userId,
        message: message.trim() || undefined,
        meetingLatitude: location.latitude,
        meetingLongitude: location.longitude,
      });
      Alert.alert('Proposal sent!', `Your challenge was sent to ${profile?.username}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send proposal');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading profile..." />;
  if (!profile) return null;

  const stats = profile.stats;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Avatar photoUrl={profile.photoUrl} username={profile.username} size={80} />
        <Text style={styles.name}>{profile.fullName || profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.hasBoard && (
          <View style={styles.boardPill}>
            <Icon name="grid-on" size={14} color={colors.secondary} />
            <Text style={styles.boardPillText}>Has a board</Text>
          </View>
        )}
      </View>

      {profile.bio ? (
        <Card style={styles.section}>
          <Text style={styles.bio}>{profile.bio}</Text>
        </Card>
      ) : null}

      {(profile.fideRating || profile.chessComRating || profile.lichessRating) && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Ratings</Text>
          <View style={styles.badgeRow}>
            <RatingBadge label="FIDE" rating={profile.fideRating} />
            <RatingBadge label="Chess.com" rating={profile.chessComRating} />
            <RatingBadge label="Lichess" rating={profile.lichessRating} />
          </View>
        </Card>
      )}

      {profile.linkedAccounts?.map(account => (
        <View key={account.platform} style={styles.section}>
          <LinkedAccountCard account={account} />
        </View>
      ))}

      {stats && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>OTB Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalMatchesPlayed}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalWins}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalLosses}</Text>
              <Text style={styles.statLabel}>Losses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.winRate}%</Text>
              <Text style={styles.statLabel}>Win rate</Text>
            </View>
          </View>
        </Card>
      )}

      {showProposeForm ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Send a challenge</Text>
          <Text style={styles.helperText}>
            Your current location will be shared as the meeting spot.
          </Text>
          <Input
            placeholder="Add a message (optional)"
            value={message}
            onChangeText={setMessage}
            multiline
            style={styles.messageInput}
          />
          <Button
            title="Send Proposal"
            onPress={handleSendProposal}
            loading={sending}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => setShowProposeForm(false)}
            style={styles.cancelButton}
          />
        </Card>
      ) : (
        <View style={styles.footer}>
          <Button title="Challenge to a game" onPress={() => setShowProposeForm(true)} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  name: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md },
  username: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  boardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  boardPillText: {
    ...typography.small,
    color: colors.secondary,
    fontWeight: '700',
    marginLeft: 4,
  },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  bio: { ...typography.body, color: colors.textPrimary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  helperText: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  messageInput: { minHeight: 60, textAlignVertical: 'top' },
  cancelButton: { marginTop: spacing.sm },
  footer: { marginTop: spacing.md },
});
