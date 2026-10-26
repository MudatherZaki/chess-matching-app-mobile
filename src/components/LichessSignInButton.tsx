import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';
import Button from './Button';

/**
 * "or" divider plus "Continue with Lichess", for the sign-in and sign-up
 * screens. Lichess sign-in creates the account on first use, so both screens
 * show the same button. Failures surface through the auth store's error.
 */
export default function LichessSignInButton() {
  const loginWithLichess = useAuthStore(s => s.loginWithLichess);
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    setBusy(true);
    try {
      await loginWithLichess();
    } catch {
      // shown via the store's error
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>
      <Button
        title="Continue with Lichess"
        icon="chess-knight"
        variant="dark"
        onPress={handlePress}
        loading={busy}
      />
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: {
    ...typography.caption,
    color: colors.textSecondary,
    marginHorizontal: spacing.sm,
  },
});
