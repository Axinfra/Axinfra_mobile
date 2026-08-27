import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';

/** PMC only, matching RoleGuard on the web POST route. Same fields as the web create-checklist
 * modal: title, reference drawing number, and a list of item descriptions (at least one) —
 * the actual fill-in/sign/PDF workflow that follows creation isn't ported. */
export default function NewChecklistScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [referenceDrawingNo, setReferenceDrawingNo] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validItems = items.map((i) => i.trim()).filter(Boolean);
  const canSubmit = !!title.trim() && !!referenceDrawingNo.trim() && validItems.length > 0 && !submitting;

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((v, i) => (i === index ? value : v)));
  }
  function addItem() {
    setItems((prev) => [...prev, '']);
  }
  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/checklists`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          referenceDrawingNo: referenceDrawingNo.trim(),
          items: validItems.map((description) => ({ description })),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the checklist. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="New Checklist" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <View style={styles.field}>
            <Text style={styles.label}>Checklist Type / Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Pre-Concrete Pour Checklist"
              placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Reference Drawing No.</Text>
            <TextInput
              style={styles.input}
              value={referenceDrawingNo}
              onChangeText={setReferenceDrawingNo}
              placeholder="e.g. S-101 Rev C"
              placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Items</Text>
            {items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemInput]}
                  value={item}
                  onChangeText={(v) => updateItem(i, v)}
                  placeholder={`Item ${i + 1}`}
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                />
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(i)} hitSlop={8} style={styles.itemRemove}>
                    <X size={16} color={withAlpha(Brand.textRgb, 0.4)} />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable onPress={addItem} style={styles.addItem}>
              <Plus size={14} color={Brand.accent} />
              <Text style={styles.addItemText}>Add item</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} disabled={!canSubmit} onPress={handleSubmit}>
            {submitting ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.submitText}>Create Checklist</Text>}
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
