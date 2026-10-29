import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ProfileStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/services/api';
import { useLocationStore, RADIUS_OPTIONS_KM } from '@/store/locationStore';
import {
  AppHeader,
  Avatar,
  RatingBadge,
  Card,
  SectionHeader,
  SegmentedControl,
  IconTile,
  Tag,
  LinkedAccountCard,
  Toggle,
} from '@/components';
import { colors, spacing, typography, radius } from '@/theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

const RADIUS_OPTIONS = RADIUS_OPTIONS_KM.map(String);

export default function ProfileScreen({ navigation }: Props) {
  const { user, updateUser } = useAuthStore();
  const { isAvailable, searchRadiusKm, setSearchRadius } = useLocationStore();
  const [savingBoard, setSavingBoard] = useState(false);

  if (!user) return null;

  const setHasBoard = async (hasBoard: boolean) => {
    setSavingBoard(true);
    // Flip it right away; the saved profile replaces it, or the old value comes back on failure
    updateUser({ ...user, hasBoard });
    try {
      updateUser(await apiClient.updateProfile({ hasBoard }));
    } catch (e: any) {
      updateUser(user);
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update your board');
    } finally {
      setSavingBoard(false);
    }
  };

  const ratings = [
    { label: 'FIDE', rating: user.fideRating, color: colors.primary },
    { label: 'Chess.com', rating: user.chessCom?.rating, color: colors.secondary },
    { label: 'Lichess', rating: user.lichess?.rating, color: colors.warning },
  ].filter(r => r.rating);

  return (
    <View style={styles.flex}>
      <AppHeader subtitle="Profile" />
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('EditProfile')}>
          <Card style={styles.profileCard}>
            <Avatar
              photoUrl={user.photoUrl}
              username={user.username}
              size={68}
              status={isAvailable ? colors.primary : colors.textTertiary}
            />
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.fullName || user.username}
                </Text>
                {user.fideId ? (
                  <Icon name="check-decagram" size={18} color={colors.primary} style={styles.verified} />
                ) : null}
              </View>
              <Text style={styles.handle}>@{user.username}</Text>
              <View style={styles.badgeRow}>
                {ratings.length > 0 ? (
                  ratings.slice(0, 2).map(r => (
                    <RatingBadge key={r.label} label={r.label} rating={r.rating} color={r.color} />
                  ))
                ) : (
                  <Tag label="Unrated" />
                )}
              </View>
            </View>
            <View style={styles.chevron}>
              <Icon name="chevron-right" size={20} color={colors.textPrimary} />
            </View>
          </Card>
        </TouchableOpacity>

        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        <View style={styles.section}>
          <SectionHeader title="Radar & Proximity Beacon" icon="radar" />
          <Card>
            <View style={styles.radiusHeader}>
              <Text style={styles.rowTitle}>Radar Ping Radius</Text>
              <Text style={styles.radiusValue}>{searchRadiusKm.toFixed(1)} km</Text>
            </View>
            <SegmentedControl
              mono
              options={RADIUS_OPTIONS.map(v => ({ value: v, label: `${v}KM` }))}
              value={String(searchRadiusKm) as (typeof RADIUS_OPTIONS)[number]}
              onChange={v => setSearchRadius(Number(v))}
              style={styles.radiusControl}
            />

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                navigation.getParent()?.navigate('HomeStack', {
                  screen: 'SetAvailability',
                  initial: false,
                })
              }>
              <View style={styles.flexFill}>
                <Text style={styles.rowTitle}>Live Beacon</Text>
                <Text style={styles.rowSub}>
                  {isAvailable
                    ? 'Nearby players can see and challenge you'
                    : 'Go live so players nearby can find you'}
                </Text>
              </View>
              <Tag
                label={isAvailable ? 'Online' : 'Offline'}
                dot
                color={isAvailable ? colors.primary : colors.textTertiary}
              />
              <Icon name="chevron-right" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Gear & Play Standards" icon="view-grid-outline" color={colors.secondary} />
          <Card>
            <View style={styles.row}>
              <IconTile
                icon="checkerboard"
                color={user.hasBoard ? colors.primary : colors.textTertiary}
              />
              <View style={styles.gearInfo}>
                <Text style={styles.rowTitle}>
                  {user.hasBoard ? 'Carries a board' : 'No board declared'}
                </Text>
                <Text style={styles.rowSub}>Declared street hardware</Text>
              </View>
              <Toggle value={user.hasBoard} onValueChange={setHasBoard} disabled={savingBoard} />
            </View>

            {ratings.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.rowTitle}>Linked Ratings</Text>
                <View style={[styles.badgeRow, styles.linkedRatings]}>
                  {ratings.map(r => (
                    <RatingBadge key={r.label} label={r.label} rating={r.rating} color={r.color} />
                  ))}
                </View>
              </>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Online Accounts" icon="link-variant" color={colors.warning} />
          {user.linkedAccounts?.length ? (
            user.linkedAccounts.map(account => (
              <View key={account.platform} style={styles.linkedAccount}>
                <LinkedAccountCard account={account} />
              </View>
            ))
          ) : (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('EditProfile')}>
              <Card style={styles.row}>
                <IconTile icon="chess-knight" color={colors.warning} />
                <View style={styles.gearInfo}>
                  <Text style={styles.rowTitle}>Link Lichess or Chess.com</Text>
                  <Text style={styles.rowSub}>Show your online ratings on your profile</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textTertiary} />
              </Card>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.gatheringsLink}
          onPress={() => navigation.getParent()?.navigate('GatheringsStack', { screen: 'GatheringsList' })}>
          <Card style={styles.row}>
            <IconTile icon="account-group-outline" color={colors.warning} />
            <View style={styles.gearInfo}>
              <Text style={styles.rowTitle}>My gatherings</Text>
              <Text style={styles.rowSub}>Meetups you're hosting or have joined</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textTertiary} />
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flexFill: { flex: 1 },
  container: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  profileInfo: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { ...typography.h2, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
  verified: { marginLeft: 6 },
  handle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  section: { marginTop: spacing.lg },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radiusValue: {
    ...typography.label,
    fontSize: 16,
    letterSpacing: 0,
    textTransform: 'none',
    color: colors.primary,
  },
  radiusControl: { marginTop: spacing.sm + 4, borderRadius: radius.md },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { ...typography.bodyBold, fontWeight: '800', color: colors.textPrimary },
  rowSub: { ...typography.small, color: colors.textSecondary, marginTop: 2, marginRight: spacing.sm },
  gearInfo: { flex: 1, marginLeft: spacing.sm + 4 },
  linkedRatings: { marginTop: spacing.sm },
  linkedAccount: { marginBottom: spacing.sm },
  gatheringsLink: { marginTop: spacing.md },
});
