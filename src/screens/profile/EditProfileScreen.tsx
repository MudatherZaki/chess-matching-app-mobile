import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinkedPlatform, ProfileStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/services/api';
import { connectLichess, LichessAuthCancelled } from '@/services/lichessAuth';
import { Button, Input, LinkedAccountCard, SectionHeader } from '@/components';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

type AccountAction = 'connect' | 'refresh' | 'unlink';
type Busy = { platform: LinkedPlatform; action: AccountAction } | null;

const PLATFORM_NAME: Record<LinkedPlatform, string> = {
  lichess: 'Lichess',
  chesscom: 'Chess.com',
};

const ACCOUNT_API: Record<LinkedPlatform, { refresh: () => Promise<unknown>; unlink: () => Promise<void> }> = {
  lichess: { refresh: () => apiClient.refreshLichess(), unlink: () => apiClient.unlinkLichess() },
  chesscom: { refresh: () => apiClient.refreshChessCom(), unlink: () => apiClient.unlinkChessCom() },
};

export default function EditProfileScreen({ navigation }: Props) {
  const { user, updateUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [fideRating, setFideRating] = useState(user?.fideRating?.toString() || '');
  const [chessComUsername, setChessComUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const accountOf = (platform: LinkedPlatform) =>
    user?.linkedAccounts?.find(a => a.platform === platform);
  const isBusy = (platform: LinkedPlatform, action: AccountAction) =>
    busy?.platform === platform && busy.action === action;

  const runAccountAction = async (
    platform: LinkedPlatform,
    action: AccountAction,
    request: () => Promise<unknown>,
  ) => {
    setBusy({ platform, action });
    try {
      await request();
      updateUser(await apiClient.getMyProfile());
      if (platform === 'chesscom' && action === 'connect') setChessComUsername('');
    } catch (e: any) {
      if (!(e instanceof LichessAuthCancelled)) {
        Alert.alert(
          PLATFORM_NAME[platform],
          e?.response?.data?.details?.[0]?.message ||
            e?.response?.data?.message ||
            e?.message ||
            'Something went wrong',
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = (platform: LinkedPlatform) => {
    const name = PLATFORM_NAME[platform];
    Alert.alert(`Disconnect ${name}?`, `Your ${name} ratings will no longer show on your profile.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => runAccountAction(platform, 'unlink', ACCOUNT_API[platform].unlink),
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.updateProfile({
        fullName: fullName.trim() || undefined,
        bio: bio.trim() || undefined,
        fideRating: fideRating ? parseInt(fideRating, 10) : undefined,
      });
      updateUser(updated);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const renderLinked = (platform: LinkedPlatform) => {
    const account = accountOf(platform);
    if (!account) return null;
    return (
      <LinkedAccountCard
        account={account}
        footer={
          <View style={styles.accountActions}>
            <Button
              title="Refresh"
              icon="refresh"
              variant="dark"
              size="sm"
              onPress={() => runAccountAction(platform, 'refresh', ACCOUNT_API[platform].refresh)}
              loading={isBusy(platform, 'refresh')}
              disabled={!!busy}
              style={styles.accountAction}
            />
            <Button
              title="Disconnect"
              variant="ghost"
              size="sm"
              onPress={() => handleUnlink(platform)}
              loading={isBusy(platform, 'unlink')}
              disabled={!!busy}
              style={styles.accountAction}
            />
          </View>
        }
      />
    );
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Input label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        style={styles.bioInput}
        placeholder="Tell other players about yourself"
      />
      <Input
        label="FIDE rating"
        value={fideRating}
        onChangeText={setFideRating}
        keyboardType="number-pad"
      />

      <View style={styles.footer}>
        <Button title="Save Changes" onPress={handleSave} loading={saving} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Lichess" icon="chess-knight" color={colors.warning} />
        {renderLinked('lichess') ?? (
          <>
            <Text style={styles.helperText}>
              Sign in with Lichess to show your verified ratings to other players.
            </Text>
            <Button
              title="Connect Lichess"
              icon="link-variant"
              variant="dark"
              onPress={() => runAccountAction('lichess', 'connect', connectLichess)}
              loading={isBusy('lichess', 'connect')}
              disabled={!!busy}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Chess.com" icon="chess-pawn" color={colors.secondary} />
        {renderLinked('chesscom') ?? (
          <>
            <Text style={styles.helperText}>
              Add your chess.com username to show your ratings. It will be marked unverified
              until chess.com sign-in is available.
            </Text>
            <Input
              placeholder="chess.com username"
              value={chessComUsername}
              onChangeText={setChessComUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              title="Link Chess.com"
              icon="link-variant"
              variant="dark"
              onPress={() =>
                runAccountAction('chesscom', 'connect', () =>
                  apiClient.linkChessCom(chessComUsername.trim()),
                )
              }
              loading={isBusy('chesscom', 'connect')}
              disabled={!!busy || !chessComUsername.trim()}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  bioInput: { minHeight: 70, textAlignVertical: 'top' },
  footer: { marginTop: spacing.md },
  section: { marginTop: spacing.lg },
  helperText: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  accountActions: { flexDirection: 'row', marginTop: spacing.md },
  accountAction: { flex: 1, marginHorizontal: spacing.xs },
});
