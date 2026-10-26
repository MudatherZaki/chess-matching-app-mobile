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
import { USE_MOCK_DATA } from '@/mocks';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login, signInWithDemo, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Errors from another auth screen shouldn't follow you here
  useFocusEffect(
    useCallback(() => {
      clearError();
    }, [clearError]),
  );

  const handleLogin = async () => {
    const errors: typeof fieldErrors = {};
    if (!validationUtils.isValidEmail(email)) errors.email = 'Enter a valid email';
    if (!password) errors.password = 'Password is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearError();
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch {
      // error is surfaced via store
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to find your next opponent</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            value={email}
            onChangeText={t => {
              setEmail(t);
              setFieldErrors(prev => ({ ...prev, email: undefined }));
            }}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Password"
            icon="lock-outline"
            placeholder="••••••••"
            value={password}
            onChangeText={t => {
              setPassword(t);
              setFieldErrors(prev => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            isPassword
            autoComplete="password"
          />

          {error && <Text style={styles.formError}>{error}</Text>}

          <Button title="Sign In" onPress={handleLogin} loading={isLoading} />

          <LichessSignInButton />

          {USE_MOCK_DATA && (
            <Button
              title="Try with demo data"
              variant="ghost"
              onPress={signInWithDemo}
              style={styles.demo}
            />
          )}

          <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.footerLink}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  demo: { marginTop: spacing.sm },
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
