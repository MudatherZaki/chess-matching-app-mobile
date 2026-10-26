import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AuthStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, BrandMark, LichessSignInButton } from '@/components';
import { colors, spacing, typography } from '@/theme';
import { validationUtils } from '@/utils';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface FormState {
  email: string;
  username: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterScreen({ navigation }: Props) {
  const { register, isLoading, error, clearError } = useAuthStore();

  // Errors from another auth screen shouldn't follow you here
  useFocusEffect(
    useCallback(() => {
      clearError();
    }, [clearError]),
  );
  const [form, setForm] = useState<FormState>({
    email: '',
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const setField = (key: keyof FormState) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleRegister = async () => {
    const errors: typeof fieldErrors = {};
    if (!validationUtils.isValidEmail(form.email)) errors.email = 'Enter a valid email';
    if (!validationUtils.isValidUsername(form.username))
      errors.username = '3-20 characters';
    if (!validationUtils.isValidPassword(form.password))
      errors.password = 'At least 8 characters';
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearError();
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim() || undefined,
      });
    } catch {
      // error surfaced via store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BrandMark />
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join players near you for OTB chess</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={setField('email')}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Username"
            icon="person-outline"
            placeholder="chessmaster42"
            value={form.username}
            onChangeText={setField('username')}
            error={fieldErrors.username}
            autoComplete="username"
          />
          <Input
            label="Full name (optional)"
            icon="badge"
            placeholder="John Doe"
            value={form.fullName}
            onChangeText={setField('fullName')}
            autoCapitalize="words"
          />
          <Input
            label="Password"
            icon="lock-outline"
            placeholder="••••••••"
            value={form.password}
            onChangeText={setField('password')}
            error={fieldErrors.password}
            isPassword
          />
          <Input
            label="Confirm password"
            icon="lock-outline"
            placeholder="••••••••"
            value={form.confirmPassword}
            onChangeText={setField('confirmPassword')}
            error={fieldErrors.confirmPassword}
            isPassword
          />

          {error && <Text style={styles.formError}>{error}</Text>}

          <Button title="Create Account" onPress={handleRegister} loading={isLoading} />

          <LichessSignInButton />

          <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
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
  form: {
    width: '100%',
  },
  formError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '700',
  },
});
