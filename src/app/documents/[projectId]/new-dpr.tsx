import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * SITE_ENGINEER only, matching RoleGuard on the web POST route — this is filed by whoever's
 * actually on-site. Covers the required field (reportDate) and Highlights, the simplest of the
 * three row types the full DPR supports; Procurement and Manpower rows are structured grids
 * entered on the web app's DPR detail page after creation and aren't ported here (the create
 * schema defaults both to `[]`, so omitting them is a valid, complete DPR, just a lighter one).
 */
export default function NewDprScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [reportDate, setReportDate] = useState(todayIso());
  const [highlights, setHighlights] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validHighlights = highlights.map((h) => h.trim()).filter(Boolean);
  const canSubmit = /^\d{4}-\d{2}-\d{2}$/.test(reportDate) && !submitting;

  function updateHighlight(index: number, value: string) {
    setHighlights((prev) => prev.map((v, i) => (i === index ? value : v)));
  }
  function addHighlight() {
    setHighlights((prev) => [...prev, '']);
  }
  function removeHighlight(index: number) {
    setHighlights((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/dpr`, {
        method: 'POST',
        body: JSON.stringify({
          reportDate,
          procurementRows: [],
          manpowerRows: [],
          highlights: validHighlights.map((description) => ({ description })),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['dprs', projectId] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the DPR. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="New Daily Progress Report" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <Text style={styles.note}>Procurement and manpower rows aren't available in the app yet — add those on the web app after creating this report.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Report Date</Text>
            <TextInput
              style={styles.input}
              value={reportDate}
              onChangeText={setReportDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Highlights</Text>
            {highlights.map((h, i) => (
              <View key={i} style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemInput]}
                  value={h}
                  onChangeText={(v) => updateHighlight(i, v)}
                  placeholder={`Highlight ${i + 1} (optional)`}
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                />
                {highlights.length > 1 && (
                  <Pressable onPress={() => removeHighlight(i)} hitSlop={8} style={styles.itemRemove}>
                    <X size={16} color={withAlpha(Brand.textRgb, 0.4)} />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable onPress={addHighlight} style={styles.addItem}>
              <Plus size={14} color={Brand.accent} />
              <Text style={styles.addItemText}>Add highlight</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} disabled={!canSubmit} onPress={handleSubmit}>
            {submitting ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.submitText}>Create DPR</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  note: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11, lineHeight: 16 },
  field: { gap: 8 },
  label: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
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
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemInput: { flex: 1 },
  itemRemove: { padding: 4 },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addItemText: { color: Brand.accent, fontSize: 13, fontWeight: '500' },
  submit: { height: 44, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
});
