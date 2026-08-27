import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { type ActivityBucket, groupActivitiesByStatus } from '@/lib/activity-status';
import { apiFetch } from '@/lib/api';
import { daysFromToday, formatDate } from '@/lib/format';
import type { Activity } from '@/types';

type Tab = ActivityBucket | 'ALL';
const TAB_ORDER: Tab[] = ['DUE_TODAY', 'OVERDUE', 'UPCOMING', 'COMPLETED', 'ALL'];
const TAB_CONFIG: Record<Tab, { label: string; icon: typeof CalendarClock; color: string; empty: string }> = {
  DUE_TODAY: { label: 'Today', icon: CalendarClock, color: '#f97316', empty: 'Nothing due today.' },
  OVERDUE: { label: 'Overdue', icon: AlertTriangle, color: Brand.error, empty: 'Nothing overdue — nice work.' },
  UPCOMING: { label: 'Upcoming', icon: Clock, color: '#eab308', empty: 'Nothing scheduled next.' },
  COMPLETED: { label: 'Completed', icon: CheckCircle2, color: '#5cba80', empty: 'Nothing completed yet.' },
  ALL: { label: 'All', icon: CalendarClock, color: Brand.accent, empty: 'No activities on this project yet.' },
};

const STATE_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.4),
  IN_PROGRESS: '#38bdf8',
  SUBMITTED: '#eab308',
  VERIFIED: '#5cba80',
  CLOSED: '#a78bfa',
};
const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft', IN_PROGRESS: 'In Progress', SUBMITTED: 'Submitted', VERIFIED: 'Verified', CLOSED: 'Closed',
};

/**
 * Same Today/Overdue/Upcoming/Completed classification as the web app's Activities page
 * (src/lib/activityStatus.ts, ported in src/lib/activity-status.ts) — this app's one dedicated
 * activities list, reachable from a project's detail screen. Doesn't port that page's Health
 * badge, dependency filter, or sort controls — read + classify covers "what's outstanding on
 * this project," the question this screen exists to answer.
 */
export default function ActivitiesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('DUE_TODAY');

  const { data: activities, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['activities', projectId, 'all'],
    queryFn: () => apiFetch<Activity[]>(`/api/projects/${projectId}/milestones?all=true`),
    enabled: !!projectId,
  });

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);
  const grouped = useMemo(() => groupActivitiesByStatus(activities ?? [], today), [activities, today]);
  const tabCount = (t: Tab) => (t === 'ALL' ? (activities ?? []).length : grouped[t].length);
  const items = activeTab === 'ALL' ? (activities ?? []) : grouped[activeTab];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Activities" />

        <View style={styles.tabRow}>
          {TAB_ORDER.map((t) => {
            const cfg = TAB_CONFIG[t];
            const active = activeTab === t;
            return (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tab, active && styles.tabActive]}>
                <View style={[styles.tabDot, { backgroundColor: cfg.color }]} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{cfg.label}</Text>
                <Text style={styles.tabCount}>{tabCount(t)}</Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}
        {isError && <Text style={styles.error}>Couldn't load activities.</Text>}

        {activities && (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Link href={`/activities/${projectId}/${item.id}`} asChild>
                <Pressable><ActivityRow activity={item} /></Pressable>
              </Link>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={<Text style={styles.empty}>{TAB_CONFIG[activeTab].empty}</Text>}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const days = daysFromToday(activity.plannedEnd);
  const overdue = days !== null && days < 0 && activity.state !== 'VERIFIED' && activity.state !== 'CLOSED';
  const pct = Math.round(activity.percentComplete ?? 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={2}>{activity.title}</Text>
        <Text style={[styles.statePill, { color: STATE_COLOR[activity.state] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
          {STATE_LABEL[activity.state] ?? activity.state}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        {activity.phase?.name && <Text style={styles.metaText}>{activity.phase.name}</Text>}
        {activity.vendorUser?.name && <Text style={styles.metaText}>{activity.vendorUser.name}</Text>}
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.dueText, overdue && styles.dueTextOverdue]}>
          {activity.plannedEnd
            ? overdue ? `${Math.abs(days!)}d overdue` : days === 0 ? 'Due today' : days! > 0 ? `Due in ${days}d` : formatDate(activity.plannedEnd)
            : 'No due date'}
        </Text>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? '#5cba80' : Brand.accent }]} />
          </View>
          <Text style={styles.progressText}>{pct}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: withAlpha(Brand.accentRgb, 0.15) },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: Brand.accent, fontWeight: '700' },
  tabCount: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  list: { padding: 20, paddingTop: 12 },
  card: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '600' },
  statePill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardMeta: { flexDirection: 'row', gap: 10 },
  metaText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  dueText: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12 },
  dueTextOverdue: { color: Brand.error, fontWeight: '600' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, maxWidth: 100 },
  progressTrack: { flex: 1, height: 4, borderRadius: 999, backgroundColor: withAlpha(Brand.textRgb, 0.08), overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 999 },
  progressText: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 11, width: 30, textAlign: 'right' },
});
