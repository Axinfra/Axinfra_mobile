import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import type { ProjectRoleEntry } from '@/types';

/** PMC creates a Direct Order for a Vendor already on the project — same fields/validation as
 * the web app's create flow (POST /api/projects/[projectId]/direct-orders): vendor, item
 * description, value, optional remarks. */
export default function NewDirectOrderScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['project-roles', projectId],
    queryFn: () => apiFetch<ProjectRoleEntry[]>(`/api/projects/${projectId}/roles`),
    enabled: !!projectId,
  });
  const vendors = (roles ?? []).filter((r) => r.role === 'VENDOR' && !r.isPendingInvite && r.userId);

  const [vendorUserId, setVendorUserId] = useState<string | null>(null);
  const [itemDescription, setItemDescription] = useState('');
  const [value, setValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const numericValue = Number(value);
  const canSubmit = !!vendorUserId && !!itemDescription.trim() && numericValue > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/direct-orders`, {
        method: 'POST',
        body: JSON.stringify({
          vendorUserId,
          itemDescription: itemDescription.trim(),
          value: numericValue,
          remarks: remarks.trim() || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['direct-orders', projectId] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the order. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <DetailHeader title="New Direct Order" />

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Vendor</Text>
              {rolesLoading ? (
                <ActivityIndicator color={Brand.accent} style={{ marginTop: 8 }} />
              ) : vendors.length === 0 ? (
                <Text style={styles.hint}>No vendors on this project yet.</Text>
              ) : (
                <View style={styles.vendorList}>
                  {vendors.map((v) => {
                    const active = vendorUserId === v.userId;
                    return (
                      <Pressable
                        key={v.userId}
                        onPress={() => setVendorUserId(v.userId)}
                        style={[styles.vendorRow, active && styles.vendorRowActive]}>
                        <Text style={[styles.vendorName, active && styles.vendorNameActive]}>{v.name}</Text>
                        <Text style={styles.vendorEmail}>{v.email}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Item Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder="e.g. HVAC ductwork, Floors 3-5"
                placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Value</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Optional"
                placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                multiline
                numberOfLines={2}
              />
            </View>

            <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} disabled={!canSubmit} onPress={handleSubmit}>
              {submitting ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.submitText}>Create Order</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  field: { gap: 6 },
  label: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13 },
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
  inputMultiline: { height: 70, paddingTop: 10, textAlignVertical: 'top' },
  vendorList: { gap: 8 },
  vendorRow: {
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 12,
  },
  vendorRowActive: { borderColor: withAlpha(Brand.accentRgb, 0.5), backgroundColor: withAlpha(Brand.accentRgb, 0.08) },
  vendorName: { color: Brand.text, fontSize: 14, fontWeight: '500' },
  vendorNameActive: { color: Brand.accent, fontWeight: '600' },
  vendorEmail: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 12, marginTop: 2 },
  submit: { height: 44, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
});
