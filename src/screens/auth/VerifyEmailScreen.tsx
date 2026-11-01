import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { errorMessage } from '@services/api';
import { Button, Input, BrandMark } from '@/components';
import { colors, spacing, typography } from '@/theme';

const RESEND_COOLDOWN_SECONDS = 60;

const secondsLeft = (sentAt: number | null) =>
  sentAt == null
    ? 0
    : Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - (Date.now() - sentAt) / 1000));

// Shown after signing up (and on later launches) until the player enters the
// 6-digit code we emailed them
export default function VerifyEmailScreen() {
  const {
    user,
    verificationCodeSentAt,
    verifyEmail,
    resendVerificationCode,
    setVerifyEmailLater,
    logout,
  } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(() => secondsLeft(verificationCodeSentAt));

  // Count down to when "send a new code" works again
  useEffect(() => {
    setWait(secondsLeft(verificationCodeSentAt));
    const timer = setInterval(() => setWait(secondsLeft(verificationCodeSentAt)), 1000);
    return () => clearInterval(timer);
  }, [verificationCodeSentAt]);

  const resend = async (quiet = false) => {
    setSending(true);
    setError(null);
    try {
      await resendVerificationCode();
      if (!quiet) setNotice('We sent you a new code.');
    } catch (e: any) {
      // Already sent one in the last minute: the countdown covers it
      if (e?.response?.status !== 429 && !quiet) {
        setError(errorMessage(e, "We couldn't send the email. Please try again."));
      }
    } finally {
      setSending(false);
    }
  };

  // Coming back to the app later: the old code has probably expired, so send
  // a fresh one (right after signing up the server has just sent it)
  const sentOnOpen = useRef(false);
  useEffect(() => {
    if (sentOnOpen.current) return;
    sentOnOpen.current = true;
    if (verificationCodeSentAt == null) resend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value = code) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      await verifyEmail(digits);
      // The navigator switches to the app once the profile says verified
    } catch (e: any) {
      setError(errorMessage(e, "That code didn't work. Please try again."));
      setVerifying(false);
    }
  };

  const onChangeCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError(null);
    // Pasted or autofilled codes go straight through
    if (digits.length === 6 && !verifying) submit(digits);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BrandMark />
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.email}>{user?.email}</Text>
          </Text>
        </View>

        <Input
          label="Code"
          icon="mark-email-read"
          placeholder="123456"
          value={code}
          onChangeText={onChangeCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          error={error ?? undefined}
          style={styles.codeInput}
        />
        {notice && !error && <Text style={styles.notice}>{notice}</Text>}

        <Button
          title="Confirm Email"
          onPress={() => submit()}
          loading={verifying}
          disabled={verifying}
        />

        <TouchableOpacity
          style={styles.link}
          onPress={() => resend()}
          disabled={wait > 0 || sending}
        >
          <Text style={[styles.linkText, (wait > 0 || sending) && styles.linkDisabled]}>
            {wait > 0 ? `Send a new code in ${wait}s` : sending ? 'Sending…' : 'Send a new code'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.why}>
          BlitzMate is about meeting people in person, so you need a confirmed email to see players
          nearby and join gatherings. You can set up your profile in the meantime.
        </Text>

        <Button title="Do This Later" variant="ghost" onPress={() => setVerifyEmailLater(true)} />
        <TouchableOpacity style={styles.link} onPress={logout}>
          <Text style={styles.footerText}>
            Wrong email? <Text style={styles.linkText}>Sign out</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  email: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 8,
  },
  notice: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  link: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  linkDisabled: {
    color: colors.textTertiary,
  },
  why: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
