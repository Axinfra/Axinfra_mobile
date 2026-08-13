import { Link } from 'expo-router';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AxinfraLogo } from '@/components/brand/axinfra-logo';
import { GoogleIcon } from '@/components/brand/google-icon';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, useAuth, type SignupRole } from '@/lib/auth';

// Same roles as the web register page's ROLES array — see
// src/app/auth/register/page.tsx in the web repo.
const ROLES: { id: SignupRole; label: string; icon: string; desc: string }[] = [
  { id: 'CLIENT', label: 'Client', icon: '🏢', desc: 'Project owner' },
  { id: 'PMC', label: 'PMC', icon: '📋', desc: 'Project manager' },
  { id: 'VENDOR', label: 'Vendor', icon: '🔧', desc: 'Contractor' },
  { id: 'CONSULTANT', label: 'Consultant', icon: '💡', desc: 'Specialist' },
  { id: 'SITE_ENGINEER', label: 'Site Engineer', icon: '👷', desc: 'Read-only site view' },
];

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
];

export default function RegisterScreen() {
  const { signup } = useAuth();
  const [selectedRole, setSelectedRole] = useState<SignupRole | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordOk = PASSWORD_RULES.every((r) => r.test(password));
  const canSubmit = !submitting && !!name && !!email && passwordOk && !!selectedRole;

  async function handleSubmit() {
    if (!selectedRole) {
      setError('Please select your role to continue.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password, selectedRole);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <AxinfraLogo size="md" />

            <View style={styles.headingBlock}>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.subheading}>Join Axinfra and start managing your projects.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>I am joining as</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((role) => {
                  const active = selectedRole === role.id;
                  return (
                    <Pressable
                      key={role.id}
                      onPress={() => setSelectedRole(role.id)}
                      style={[styles.roleCard, active && styles.roleCardActive]}>
                      <Text style={styles.roleIcon}>{role.icon}</Text>
                      <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{role.label}</Text>
                      <Text style={[styles.roleDesc, active && styles.roleDescActive]}>{role.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              style={styles.googleButton}
              onPress={() => {
                if (!selectedRole) {
                  setError('Please select your role first.');
                  return;
                }
                Alert.alert('Google sign-in', 'Not available in the app yet — use the form below.');
              }}>
              <GoogleIcon />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color={Brand.error} style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                  autoComplete="name"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Work email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@company.com"
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                    secureTextEntry={!showPassword}
                    autoComplete="password-new"
                  />
                  <Pressable style={styles.eyeToggle} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                    {showPassword ? (
                      <EyeOff size={16} color={withAlpha(Brand.textRgb, 0.5)} />
                    ) : (
                      <Eye size={16} color={withAlpha(Brand.textRgb, 0.5)} />
                    )}
                  </Pressable>
                </View>

                {password.length > 0 && (
                  <View style={styles.ruleList}>
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <View key={rule.label} style={styles.ruleRow}>
                          <CheckCircle2 size={12} color={ok ? Brand.success : withAlpha(Brand.textRgb, 0.2)} />
                          <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{rule.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <Pressable
                style={[styles.submit, !canSubmit && styles.submitDisabled]}
                disabled={!canSubmit}
                onPress={handleSubmit}>
                {submitting ? (
                  <ActivityIndicator color={Brand.btnText} />
                ) : (
                  <Text style={styles.submitText}>Create account</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Already have an account? </Text>
              <Link href="/login">
                <Text style={styles.link}>Sign in</Text>
              </Link>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.base,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },
  headingBlock: {
    gap: 4,
  },
  heading: {
    color: Brand.text,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subheading: {
    color: withAlpha(Brand.textRgb, 0.5),
    fontSize: 14,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleCard: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.overlay,
  },
  roleCardActive: {
    borderColor: withAlpha(Brand.accentRgb, 0.55),
    backgroundColor: withAlpha(Brand.accentRgb, 0.1),
  },
  roleIcon: {
    fontSize: 18,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: withAlpha(Brand.textRgb, 0.45),
    textAlign: 'center',
  },
  roleLabelActive: {
    color: Brand.accent,
  },
  roleDesc: {
    fontSize: 9,
    color: withAlpha(Brand.textRgb, 0.25),
    textAlign: 'center',
  },
  roleDescActive: {
    color: withAlpha(Brand.accentRgb, 0.7),
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 44,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.overlay,
  },
  googleButtonText: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.overlayHover,
  },
  dividerText: {
    color: withAlpha(Brand.textRgb, 0.3),
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Brand.errorBg,
    borderWidth: 1,
    borderColor: Brand.errorBorder,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorText: {
    flex: 1,
    color: Brand.error,
    fontSize: 13,
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    color: withAlpha(Brand.textRgb, 0.55),
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 40,
    borderRadius: BrandRadius.input,
    borderWidth: 1,
    borderColor: Brand.inputBorder,
    backgroundColor: Brand.input,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Brand.text,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeToggle: {
    position: 'absolute',
    right: 12,
  },
  ruleList: {
    gap: 4,
    paddingTop: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    fontSize: 11,
    color: withAlpha(Brand.textRgb, 0.3),
  },
  ruleTextOk: {
    color: withAlpha(Brand.textRgb, 0.6),
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: BrandRadius.btn,
    backgroundColor: Brand.accent,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Brand.btnText,
    fontSize: 14,
    fontWeight: '600',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  signupText: {
    color: withAlpha(Brand.textRgb, 0.4),
    fontSize: 14,
  },
  link: {
    color: Brand.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
