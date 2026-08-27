import Slider from '@react-native-community/slider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Images, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch, getAuthenticatedRequestInit } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { takePendingShare } from '@/lib/pending-share';
import type { Activity, Project } from '@/types';

const STATE_LABEL: Record<string, string> = { DRAFT: 'Draft', IN_PROGRESS: 'In Progress', SUBMITTED: 'Submitted', VERIFIED: 'Verified', CLOSED: 'Closed' };

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  isImage: boolean;
}

// Same allow-list as the backend's progress-update route (ALLOWED_MIME_TYPES) minus video —
// recording/attaching video evidence isn't offered here, everything else it accepts is.
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Same progress-update flow as the web app's Activities page for PMC/Site Engineer: move the
 * percent-complete slider, optionally attach evidence (camera photo, gallery photo, or a PDF/
 * Word/Excel document — everything the backend accepts except video) and a remark, submit —
 * server derives state from the percentage (0% Draft, 1-99% In Progress, 100% Verified), same
 * as src/app/api/projects/[projectId]/milestones/[milestoneId]/progress-update/route.ts.
 */
export default function ActivityDetailScreen() {
  const { projectId, milestoneId } = useLocalSearchParams<{ projectId: string; milestoneId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const myRole = projects?.find((p) => p.id === projectId)?.myRole;
  const canUpdate = myRole === 'PMC' || myRole === 'SITE_ENGINEER';

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities', projectId, 'all'],
    queryFn: () => apiFetch<Activity[]>(`/api/projects/${projectId}/milestones?all=true`),
    enabled: !!projectId,
  });
  const activity = activities?.find((a) => a.id === milestoneId);

  const [percent, setPercent] = useState(activity?.percentComplete ?? 0);
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Seed the slider from the loaded activity once, without re-syncing on every refetch (which
  // would yank the slider out from under a mid-edit).
  if (activity && !initialized) {
    setPercent(Math.round(activity.percentComplete ?? 0));
    setInitialized(true);
  }

  // Arrived here from the "Shared Content" screen (WhatsApp/Files/etc. share) — pre-fill
  // whatever was shared as evidence instead of making the user pick it again.
  useEffect(() => {
    const shared = takePendingShare();
    if (shared) {
      setPhotos((prev) => [...prev, ...shared.map((f) => ({ uri: f.uri, name: f.name, mimeType: f.mimeType, isImage: f.mimeType.startsWith('image/') }))]);
    }
  }, []);

  /** Take a photo right now with the camera — the field-evidence case that matters most: proof
   * this was shot on-site today, not picked from an old camera roll. */
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to take an evidence photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    setPhotos((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `evidence-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', isImage: true })),
    ]);
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library access needed', 'Allow photo library access to attach evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    setPhotos((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `evidence-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', isImage: true })),
    ]);
  }

  /** PDF/Word/Excel — e.g. a signed vendor test-report or measurement sheet, everything the
   * backend accepts here besides photos and video (video capture isn't offered). */
  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_MIME_TYPES, multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setPhotos((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', isImage: false })),
    ]);
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function submitProgress() {
    setError(null);
    setSubmitting(true);
    try {
      const { url, headers } = await getAuthenticatedRequestInit(`/api/projects/${projectId}/milestones/${milestoneId}/progress-update`);
      const form = new FormData();
      form.append('percentComplete', String(percent));
      if (remarks.trim()) form.append('remarks', remarks.trim());
      for (const photo of photos) {
        form.append('files', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
      }

      const res = await fetch(url, { method: 'POST', headers, body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? `Update failed (${res.status})`);
      }

      await queryClient.invalidateQueries({ queryKey: ['activities', projectId, 'all'] });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update progress. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title={activity?.title ?? 'Activity'} />

        {isLoading ? (
          <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />
        ) : !activity ? (
          <Text style={styles.error}>Activity not found.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>State</Text>
                <Text style={styles.infoValue}>{STATE_LABEL[activity.state] ?? activity.state}</Text>
              </View>
              {activity.phase?.name && (
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Phase</Text><Text style={styles.infoValue}>{activity.phase.name}</Text></View>
              )}
              {activity.vendorUser?.name && (
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Vendor</Text><Text style={styles.infoValue}>{activity.vendorUser.name}</Text></View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Due Date</Text>
                <Text style={styles.infoValue}>{activity.plannedEnd ? formatDate(activity.plannedEnd) : '—'}</Text>
              </View>
            </View>

            {canUpdate && (
              <View style={styles.updateCard}>
                <Text style={styles.updateTitle}>Update Progress</Text>

                {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderLabel}>Percent Complete</Text>
                  <Text style={styles.sliderValue}>{percent}%</Text>
                </View>
                <Slider
                  value={percent}
                  onValueChange={setPercent}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  minimumTrackTintColor={Brand.accent}
                  maximumTrackTintColor={withAlpha(Brand.textRgb, 0.15)}
                  thumbTintColor={Brand.accent}
                />

                <TextInput
                  style={styles.remarksInput}
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Remarks (optional)"
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                  multiline
                  numberOfLines={2}
                />

                {photos.length > 0 && (
                  <View style={styles.photoRow}>
                    {photos.map((p) => (
                      <View key={p.uri} style={styles.photoThumbWrap}>
                        {p.isImage ? (
                          <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                        ) : (
                          <View style={[styles.photoThumb, styles.docThumb]}>
                            <FileText size={20} color={Brand.accent} />
                            <Text style={styles.docThumbText} numberOfLines={1}>{p.name}</Text>
                          </View>
                        )}
                        <Pressable style={styles.photoRemove} onPress={() => removePhoto(p.uri)}>
                          <X size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.evidenceButtonsRow}>
                  <Pressable style={styles.evidenceButton} onPress={takePhoto}>
                    <Camera size={16} color={Brand.accent} />
                    <Text style={styles.evidenceButtonText}>Camera</Text>
                  </Pressable>
                  <Pressable style={styles.evidenceButton} onPress={pickPhotos}>
                    <Images size={16} color={Brand.accent} />
                    <Text style={styles.evidenceButtonText}>Gallery</Text>
                  </Pressable>
                  <Pressable style={styles.evidenceButton} onPress={pickDocument}>
                    <FileText size={16} color={Brand.accent} />
                    <Text style={styles.evidenceButtonText}>Document</Text>
                  </Pressable>
                </View>

                <Pressable style={[styles.submit, submitting && styles.submitDisabled]} disabled={submitting} onPress={submitProgress}>
                  {submitting ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.submitText}>Save Progress</Text>}
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  scroll: { padding: 20, gap: 16 },
  infoCard: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 16, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12 },
  infoValue: { color: Brand.text, fontSize: 12, fontWeight: '600' },
  updateCard: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 16, gap: 12 },
  updateTitle: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  sliderValue: { color: Brand.accent, fontSize: 14, fontWeight: '700' },
  remarksInput: {
    height: 56, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input,
    paddingHorizontal: 12, paddingVertical: 10, color: Brand.text, fontSize: 14, textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 56, height: 56, borderRadius: BrandRadius.btn },
  docThumb: { backgroundColor: withAlpha(Brand.accentRgb, 0.1), borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 2 },
  docThumbText: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 7, textAlign: 'center' },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: Brand.error, alignItems: 'center', justifyContent: 'center' },
  evidenceButtonsRow: { flexDirection: 'row', gap: 8 },
  evidenceButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, borderStyle: 'dashed' },
  evidenceButtonText: { color: Brand.accent, fontSize: 12, fontWeight: '600' },
  submit: { height: 44, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
});
