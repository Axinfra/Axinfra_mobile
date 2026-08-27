import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { DetailHeader } from '@/components/nav/detail-header';
import { AxinfraLogo } from '@/components/brand/axinfra-logo';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import type { VendorProfile } from '@/types';

/**
 * The vendor's own one-time step (same as the web app's src/app/vendor/complete-profile/
 * page.tsx — reads/writes the same /api/vendor/profile route) — NOT the same feature as the
 * drawer's "Vendor Onboarding" item (that's the PMC/Client-side invite-a-vendor screen at
 * (app)/vendor-onboarding.tsx). This screen is reached only from the Home banner shown when
 * isVendor && !isProfileComplete, matching how the web app only surfaces it right after an
 * invite is accepted — not a persistent nav destination on either platform.
 */
export default function VendorProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: () => apiFetch<VendorProfile>('/api/vendor/profile'),
  });

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Prefill once the existing profile loads — mirrors the web form's useEffect.
  useEffect(() => {
    if (!profile) return;
    setCompanyName(profile.companyName ?? '');
    setContactPerson(profile.contactPerson ?? profile.name ?? '');
    setMobile(profile.mobile ?? '');
    setGstNumber(profile.gstNumber ?? '');
    setAddress(profile.address ?? '');
  }, [profile]);

  async function handleSubmit() {
    if (!companyName.trim() || !mobile.trim()) {
      setError('Company name and mobile number are required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/api/vendor/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          mobile: mobile.trim(),
          gstNumber: gstNumber.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      // Home's vendor-onboarding banner reads the cached ['profile'] query — without this,
      // it'd keep showing "Complete your vendor profile" after a successful save because the
      // stale isProfileComplete:false response would still be sitting in the cache.
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['vendor-profile'] });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your details. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <DetailHeader title="Complete Your Profile" />

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <AxinfraLogo size="md" />

            {isLoading ? (
              <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.eyebrowRow}>
                    <Building2 size={14} color={Brand.accent} />
                    <Text style={styles.eyebrow}>One last step</Text>
                  </View>
                  <Text style={styles.heading}>Complete your profile</Text>
                  <Text style={styles.subheading}>
                    Add your company and contact details so the project team knows who they&apos;re working with.
                  </Text>
                </View>

                <View style={styles.form}>
                  {error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <Field label="Company Name" required value={companyName} onChangeText={setCompanyName}
                    placeholder="e.g. Vanbros Construction Pvt. Ltd." autoFocus />
                  <Field label="Contact Person" value={contactPerson} onChangeText={setContactPerson}
                    placeholder="Who should we reach out to?" />
                  <Field label="Mobile Number" required value={mobile} onChangeText={setMobile}
                    placeholder="e.g. +91 98765 43210" keyboardType="phone-pad" />
                  <Field label="GST Number" value={gstNumber} onChangeText={setGstNumber} placeholder="Optional" />
                  <Field label="Address" value={address} onChangeText={setAddress} placeholder="Optional" multiline />

                  <Pressable
                    style={[styles.submit, (saving || !companyName || !mobile) && styles.submitDisabled]}
                    disabled={saving || !companyName || !mobile}
                    onPress={handleSubmit}>
                    {saving ? (
                      <ActivityIndicator color={Brand.btnText} />
                    ) : (
                      <Text style={styles.submitText}>Continue to Project</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  required,
  multiline,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
        multiline={multiline}
        numberOfLines={multiline ? 2 : undefined}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, gap: 24 },
  card: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    gap: 4,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    color: withAlpha(Brand.textRgb, 0.4),
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heading: { color: Brand.text, fontSize: 19, fontWeight: '700' },
  subheading: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 13, lineHeight: 18 },
  form: { paddingHorizontal: 20, paddingVertical: 18, gap: 14 },
  field: { gap: 6 },
  label: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  required: { color: Brand.error },
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
  inputMultiline: { height: 60, paddingTop: 10, textAlignVertical: 'top' },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  submit: {
    height: 44,
    borderRadius: BrandRadius.btn,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
});
