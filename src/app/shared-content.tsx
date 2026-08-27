import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FileText, Flag, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import { setPendingShare, takePendingShare, type PendingShareFile } from '@/lib/pending-share';
import type { Project } from '@/types';

/**
 * Landing screen for content shared into the app from another app (see share-intent-gate.tsx).
 * Doesn't upload anything itself — picks a project, then hands the file off to whichever real
 * upload screen that role and project actually support, the same way picking it from the
 * device would. A role with no upload destination on the web app (Vendor, Client, Viewer) is
 * told that plainly rather than being offered a button that would just 403.
 */
export default function SharedContentScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<PendingShareFile[] | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    setFiles(takePendingShare());
  }, []);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });

  const selected = projects?.find((p) => p.id === selectedProjectId) ?? null;
  const canUploadDocument = selected?.myRole === 'PMC' || selected?.myRole === 'CONSULTANT';
  const canAttachEvidence = selected?.myRole === 'PMC' || selected?.myRole === 'SITE_ENGINEER';

  function goToDocumentUpload() {
    if (!files || !selectedProjectId) return;
    setPendingShare(files);
    router.push(`/documents/${selectedProjectId}/upload`);
  }

  function goToActivities() {
    if (!files || !selectedProjectId) return;
    setPendingShare(files);
    router.push(`/activities/${selectedProjectId}`);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Shared Content" />

        <ScrollView contentContainerStyle={styles.scroll}>
          {files && files.length > 0 && (
            <View style={styles.filesCard}>
              <Text style={styles.filesLabel}>{files.length === 1 ? '1 file shared' : `${files.length} files shared`}</Text>
              <View style={styles.filesRow}>
                {files.map((f) => (
                  <View key={f.uri} style={styles.fileThumb}>
                    {f.mimeType.startsWith('image/') ? (
                      <Image source={{ uri: f.uri }} style={styles.fileThumbImage} />
                    ) : (
                      <FileText size={20} color={Brand.accent} />
                    )}
                    <Text style={styles.fileThumbName} numberOfLines={1}>{f.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(!files || files.length === 0) && (
            <Text style={styles.empty}>No shared file found — try sharing again from the other app.</Text>
          )}

          {files && files.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Choose a project</Text>
              {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 20 }} />}
              {projects && (
                <View style={{ gap: 8 }}>
                  {projects.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.projectRow, selectedProjectId === p.id && styles.projectRowActive]}
                      onPress={() => setSelectedProjectId(p.id)}>
                      <Text style={styles.projectName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.projectRole}>{p.myRole.replace(/_/g, ' ')}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {selected && (
                <View style={styles.destinations}>
                  {canUploadDocument && (
                    <Pressable style={styles.destinationBtn} onPress={goToDocumentUpload}>
                      <FileText size={16} color={Brand.btnText} />
                      <Text style={styles.destinationBtnText}>Upload as Document</Text>
                    </Pressable>
                  )}
                  {canAttachEvidence && (
                    <Pressable style={[styles.destinationBtn, styles.destinationBtnSecondary]} onPress={goToActivities}>
                      <Flag size={16} color={Brand.accent} />
                      <Text style={[styles.destinationBtnText, styles.destinationBtnTextSecondary]}>Attach to an Activity</Text>
                    </Pressable>
                  )}
                  {!canUploadDocument && !canAttachEvidence && (
                    <View style={styles.noticeBox}>
                      <Info size={14} color={withAlpha(Brand.textRgb, 0.5)} />
                      <Text style={styles.noticeText}>
                        Your role ({selected.myRole.replace(/_/g, ' ')}) doesn't have a file-upload destination on this project — that matches the web app, which doesn't offer one either for this role.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  filesCard: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14, gap: 10 },
  filesLabel: { color: Brand.text, fontSize: 13, fontWeight: '700' },
  filesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fileThumb: { width: 72, alignItems: 'center', gap: 4 },
  fileThumbImage: { width: 56, height: 56, borderRadius: BrandRadius.btn },
  fileThumbName: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 9, textAlign: 'center' },
  sectionLabel: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  projectRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14,
  },
  projectRowActive: { borderColor: Brand.accent, backgroundColor: withAlpha(Brand.accentRgb, 0.08) },
  projectName: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '600' },
  projectRole: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11, fontWeight: '600' },
  destinations: { gap: 10, marginTop: 4 },
  destinationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent },
  destinationBtnSecondary: { backgroundColor: Brand.overlayHover, borderWidth: 1, borderColor: Brand.border },
  destinationBtnText: { color: Brand.btnText, fontSize: 14, fontWeight: '700' },
  destinationBtnTextSecondary: { color: Brand.accent },
  noticeBox: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  noticeText: { flex: 1, color: withAlpha(Brand.textRgb, 0.5), fontSize: 12, lineHeight: 17 },
});
