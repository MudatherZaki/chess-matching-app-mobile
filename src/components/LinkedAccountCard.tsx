import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatDistanceToNow } from 'date-fns';
import { LinkedAccount, LinkedPlatform } from '@/types';
import { colors, spacing, typography } from '@/theme';
import Card from './Card';
import { IconTile, Tag } from './UI';

const PLATFORM: Record<LinkedPlatform, { name: string; icon: string; color: string }> = {
  lichess: { name: 'Lichess', icon: 'chess-knight', color: colors.warning },
  chesscom: { name: 'Chess.com', icon: 'chess-pawn', color: colors.secondary },
};

const CATEGORY_LABEL: Record<string, string> = {
  ultraBullet: 'UltraBullet',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical',
  correspondence: 'Daily',
  daily: 'Daily',
  chess960: 'Chess960',
};

// Verified external account: per-time-control ratings, record and a link out
export default function LinkedAccountCard({
  account,
  footer,
}: {
  account: LinkedAccount;
  // Owner-only actions (refresh / disconnect)
  footer?: React.ReactNode;
}) {
  const platform = PLATFORM[account.platform] ?? {
    name: account.platform,
    icon: 'chess-pawn',
    color: colors.secondary,
  };

  return (
    <Card accent={platform.color}>
      <View style={styles.header}>
        <IconTile icon={platform.icon} color={platform.color} size={40} />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.platformName}>{platform.name}</Text>
            {account.verified ? (
              <Icon name="check-decagram" size={16} color={colors.primary} style={styles.verified} />
            ) : (
              <Tag label="Unverified" color={colors.textTertiary} style={styles.unverified} />
            )}
          </View>
          <View style={styles.nameRow}>
            {account.title ? (
              <Tag label={account.title} color={colors.warning} filled style={styles.title} />
            ) : null}
            <Text style={styles.username} numberOfLines={1}>
              {account.username}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          hitSlop={8}
          onPress={() => Linking.openURL(account.profileUrl)}
          accessibilityLabel={`Open ${platform.name} profile`}>
          <Icon name="open-in-new" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {account.ratings.length > 0 ? (
        <View style={styles.ratingGrid}>
          {account.ratings.map(r => (
            <View key={r.category} style={styles.ratingCell}>
              <Text style={styles.ratingLabel}>{CATEGORY_LABEL[r.category] ?? r.category}</Text>
              <Text style={[styles.ratingValue, { color: platform.color }]}>
                {r.rating}
                {r.provisional ? '?' : ''}
              </Text>
              <View style={styles.ratingMeta}>
                <Text style={styles.metaText}>
                  {r.games} games{r.best && r.best > r.rating ? ` · peak ${r.best}` : ''}
                </Text>
                {r.progress ? (
                  <Text
                    style={[
                      styles.metaText,
                      styles.progress,
                      { color: r.progress > 0 ? colors.primary : colors.danger },
                    ]}>
                    {r.progress > 0 ? `+${r.progress}` : r.progress}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No rated games yet</Text>
      )}

      <View style={styles.recordRow}>
        <Record value={account.wins} label="W" color={colors.primary} />
        <Record value={account.losses} label="L" color={colors.danger} />
        <Record value={account.draws} label="D" color={colors.secondary} />
        <View style={styles.flex} />
        <Text style={styles.metaText}>
          {account.memberSince
            ? `Member since ${new Date(account.memberSince).getFullYear()}`
            : `${account.gamesPlayed} games`}
        </Text>
      </View>

      <Text style={styles.synced}>
        Synced {formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })}
      </Text>

      {footer}
    </Card>
  );
}

function Record({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Text style={styles.record}>
      <Text style={{ color }}>{value}</Text>
      <Text style={styles.recordLabel}> {label}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: spacing.sm + 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  platformName: { ...typography.bodyBold, fontWeight: '800', color: colors.textPrimary },
  verified: { marginLeft: 5 },
  unverified: { marginLeft: 6, paddingVertical: 1, paddingHorizontal: 5 },
  title: { marginRight: 6, paddingVertical: 1, paddingHorizontal: 5 },
  username: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  ratingCell: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  ratingLabel: { ...typography.label, fontSize: 10, color: colors.textTertiary },
  ratingValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  ratingMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { ...typography.small, color: colors.textSecondary },
  progress: { marginLeft: 6, fontWeight: '700' },
  empty: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.md },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  record: { ...typography.bodyBold, fontWeight: '800', marginRight: spacing.md },
  recordLabel: { ...typography.label, fontSize: 10, color: colors.textTertiary },
  synced: { ...typography.small, color: colors.textTertiary, marginTop: spacing.xs },
});
