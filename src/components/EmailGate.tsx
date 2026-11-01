import React, { ComponentType } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';
import Button from './Button';

// Players who haven't confirmed their email can't meet anyone yet; the server
// answers these screens' requests with 403 EmailNotVerified
export function EmailGate({ title }: { title: string }) {
  const setVerifyEmailLater = useAuthStore(s => s.setVerifyEmailLater);

  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <Icon name="mark-email-unread" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Confirm your email first. We sent you a 6-digit code when you signed up.
      </Text>
      <Button title="Enter Code" onPress={() => setVerifyEmailLater(false)} style={styles.button} />
    </View>
  );
}

export function requireVerifiedEmail<P extends object>(Screen: ComponentType<P>, title: string) {
  return function VerifiedOnly(props: P) {
    const unverified = useAuthStore(s => s.user?.emailVerified === false);
    return unverified ? <EmailGate title={title} /> : <Screen {...props} />;
  };
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.lg,
  },
});
