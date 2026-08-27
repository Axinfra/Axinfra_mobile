import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileUp } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { getAuthenticatedRequestInit } from '@/lib/api';
import { takePendingShare } from '@/lib/pending-share';

type Category = 'SPEC' | 'OTHER';
const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'SPEC', label: 'Spec' },
  { value: 'OTHER', label: 'Other' },
];

// Same allow-list as the web route's ALLOWED_MIME_TYPES (src/app/api/projects/[projectId]/
// documents/route.ts) — passed to the picker so users aren't offered files the server will
// reject anyway.
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

/** PMC/CONSULTANT only, matching RoleGuard on the web route. Uploads straight to
 * POST /api/projects/[projectId]/documents as multipart/form-data — same fields (category,
 * title, description, file) the web upload form sends. */
export default function UploadDocumentScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<Category>('SPEC');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Arrived here from the "Shared Content" screen (WhatsApp/Files/etc. share) — pre-fill the
  // shared file instead of making the user pick it again. Only the first file is used; this
  // screen (like the web upload form it mirrors) only ever attaches one.
  useEffect(() => {
    const shared = takePendingShare();
    if (shared && shared[0]) {
      setFile({ uri: shared[0].uri, name: shared[0].name, mimeType: shared[0].mimeType, size: 0 });
    }
  }, []);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
    });
  }

  const canSubmit = !!title.trim() && !!file && !uploading;

  async function handleSubmit() {
    if (!canSubmit || !file) return;
    setError(null);
    setUploading(true);
    try {
      const { url, headers } = await getAuthenticatedRequestInit(`/api/projects/${projectId}/documents`);

      const form = new FormData();
      form.append('category', category);
      form.append('title', title.trim());
      if (description.trim()) form.append('description', description.trim());
      // React Native's FormData accepts this {uri, name, type} shape for a file part — it
      // streams the file at `uri` rather than reading it into memory first.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

      const res = await fetch(url, { method: 'POST', headers, body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? `Upload failed (${res.status})`);
      }

      await queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the document. Check your connection.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Upload Document" />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <Pressable key={c.value} onPress={() => setCategory(c.value)} style={[styles.categoryChip, active && styles.categoryChipActive]}>
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Structural Spec Rev 3"
              placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>File</Text>
            <Pressable style={styles.filePicker} onPress={pickFile}>
              <FileUp size={16} color={Brand.accent} />
              <Text style={styles.filePickerText} numberOfLines={1}>
                {file ? file.name : 'Choose a file — image, PDF, Word, or Excel'}
              </Text>
            </Pressable>
          </View>

          <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} disabled={!canSubmit} onPress={handleSubmit}>
            {uploading ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.submitText}>Upload</Text>}
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
  field: { gap: 6 },
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
  inputMultiline: { height: 60, paddingTop: 10, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  categoryChipActive: { backgroundColor: Brand.accent },
  categoryText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '500' },
  categoryTextActive: { color: Brand.btnText, fontWeight: '600' },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    borderRadius: BrandRadius.input,
    borderWidth: 1,
    borderColor: Brand.inputBorder,
    backgroundColor: Brand.input,
    paddingHorizontal: 12,
  },
  filePickerText: { flex: 1, color: withAlpha(Brand.textRgb, 0.6), fontSize: 13 },
  submit: { height: 44, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
});
