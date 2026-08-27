import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import type { ArchitectureOverview } from '@/types';

/** Overview stats only — same scope the web route itself gives a VENDOR (counts, no per-set
 * cost breakdown or approval actions). The full Architecture page's drawing-set/version
 * management (upload, review, approve) isn't ported — this answers "how's it going," not
 * "let me review a drawing." */
export default function ArchitectureDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['architecture', projectId],
    queryFn: () => apiFetch<ArchitectureOverview>(`/api/projects/${projectId}/architecture`),
    enabled: !!projectId,
  });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Architecture" />

        {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />}
        {isError && <Text style={styles.error}>Couldn't load architecture data.{' '}
          <Text style={styles.link} onPress={() => refetch()}>Retry</Text>
        </Text>}

        {data && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Section title="Drawing Sets">
              <View style={styles.statRow}>
                <Stat label="Total" value={data.sets.total} />
                <Stat label="Approved" value={data.sets.approved} color="#5cba80" />
                <Stat label="Paid" value={data.sets.paid} color="#5cba80" />
              </View>
            </Section>

            <Section title="Drawing Rows">
              <View style={styles.statRow}>
                <Stat label="Total" value={data.rows.total} />
                <Stat label="Pending" value={data.rows.pending} color="#eab308" />
                <Stat label="Submitted" value={data.rows.submitted} color="#38bdf8" />
              </View>
              <View style={styles.statRow}>
                <Stat label="Approved" value={data.rows.approved} color="#5cba80" />
                <Stat label="Rejected" value={data.rows.rejected} color={Brand.error} />
                <Stat label="Pending Review" value={data.pendingReview} color={data.pendingReview > 0 ? '#f97316' : '#5cba80'} />
              </View>
            </Section>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ marginTop: 10, gap: 10 }}>{children}</View>
    </View>
  );
}

function Stat({ label, value, color = Brand.text }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  link: { color: Brand.accent, fontWeight: '600' },
  scroll: { padding: 20, gap: 16 },
  section: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 16,
  },
  sectionTitle: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.base,
    padding: 12,
    gap: 4,
  },
  statLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 10, fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '700' },
});
