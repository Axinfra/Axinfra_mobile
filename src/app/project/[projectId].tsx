import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { BarChart2, CreditCard, Flag, FolderOpen, MessageCircle, Package, Pencil, Receipt, Truck } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { classifyActivity } from '@/lib/activity-status';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Activity, CostSnapshot, Project } from '@/types';

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Today" / "Tomorrow" / "Mon" etc., plus a short date. No clock time — every form that sets
 * `plannedEnd` on the web app only ever collects a plain date, never a time of day, so there's
 * no real time to show here either. */
function weekAgenda(iso: string, today: Date): { dayLabel: string; dateLabel: string } {
  const d = new Date(iso);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dayStart.getTime() - today.getTime()) / 86_400_000);
  const dayLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : DAY_LABEL[d.getDay()];
  const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { dayLabel, dateLabel };
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ONGOING: { label: 'Ongoing', color: Brand.accent, bg: withAlpha(Brand.accentRgb, 0.1) },
  COMPLETED: { label: 'Completed', color: '#5cba80', bg: 'rgba(92,186,128,0.1)' },
};
const STATE_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.25), IN_PROGRESS: '#38bdf8', SUBMITTED: '#eab308', VERIFIED: '#5cba80', CLOSED: '#a78bfa',
};
const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft', IN_PROGRESS: 'In Progress', SUBMITTED: 'Submitted', VERIFIED: 'Verified', CLOSED: 'Closed',
};

/**
 * The project's home base — reached by tapping a project card. Same shape as the web app's
 * OverviewTab (src/app/projects/[projectId]/page.tsx): stat cards, activity progress bar,
 * recent activities, quick links to the project's other screens. Reuses three endpoints
 * already integrated elsewhere in this app (projects list, milestones, cost-overview) rather
 * than the web page's single heavier /api/projects/[projectId] call — no new backend surface.
 * The Vendor-specific PO/RA-Bill workflow from that page (order picker, Create RA Bill) isn't
 * ported — that's a real creation flow, not a read view, and a larger scope on its own.
 */
export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const project = projects?.find((p) => p.id === projectId);

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', projectId, 'all'],
    queryFn: () => apiFetch<Activity[]>(`/api/projects/${projectId}/milestones?all=true`),
    enabled: !!projectId,
  });

  const canSeeCost = project?.myRole === 'CLIENT' || project?.myRole === 'PMC';
  const { data: cost } = useQuery({
    queryKey: ['cost-snapshot', projectId],
    queryFn: () => apiFetch<CostSnapshot>(`/api/projects/${projectId}/cost-overview`),
    enabled: !!projectId && canSeeCost,
  });

  const stats = useMemo(() => {
    const list = activities ?? [];
    return {
      total: list.length,
      draft: list.filter((m) => m.state === 'DRAFT').length,
      inProgress: list.filter((m) => m.state === 'IN_PROGRESS').length,
      submitted: list.filter((m) => m.state === 'SUBMITTED').length,
      verified: list.filter((m) => m.state === 'VERIFIED').length,
      closed: list.filter((m) => m.state === 'CLOSED').length,
    };
  }, [activities]);
  const recent = (activities ?? []).slice(0, 5);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);
  const weekEnd = useMemo(() => new Date(today.getTime() + 6 * 86_400_000), [today]);
  const thisWeek = useMemo(() => {
    return (activities ?? [])
      .filter((a) => {
        if (!a.plannedEnd) return false;
        const bucket = classifyActivity(a, today);
        if (bucket !== 'UPCOMING' && bucket !== 'DUE_TODAY') return false;
        const due = new Date(a.plannedEnd).getTime();
        return due >= today.getTime() && due <= weekEnd.getTime();
      })
      .sort((a, b) => new Date(a.plannedEnd!).getTime() - new Date(b.plannedEnd!).getTime());
  }, [activities, today, weekEnd]);

  const status = project ? STATUS_STYLE[project.status] : undefined;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title={project?.name ?? 'Project'} />

        {!project ? (
          <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.pillRow}>
              <Text style={styles.roleBadge}>{project.myRole}</Text>
              {status && <Text style={[styles.statusPill, { color: status.color, backgroundColor: status.bg }]}>{status.label}</Text>}
              {project.isExampleProject && <Text style={[styles.statusPill, { color: Brand.accent, backgroundColor: withAlpha(Brand.accentRgb, 0.1) }]}>Example</Text>}
            </View>
            {project.description && <Text style={styles.description}>{project.description}</Text>}

            {activitiesLoading ? (
              <ActivityIndicator color={Brand.accent} style={{ marginTop: 12 }} />
            ) : (
              <>
                <View style={styles.statGrid}>
                  <StatCard label="Total Activities" value={stats.total} />
                  <StatCard label="Verified" value={stats.verified} color="#5cba80" />
                  <StatCard label="In Progress" value={stats.inProgress} color="#38bdf8" />
                  {canSeeCost && cost && (
                    <StatCard label="Committed Cost" value={`${cost.currency} ${Math.round(cost.totals.committed).toLocaleString('en-IN')}`} small />
                  )}
                </View>

                {stats.total > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Progress</Text>
                    <View style={styles.progressBar}>
                      {stats.draft > 0 && <View style={{ flex: stats.draft, backgroundColor: STATE_COLOR.DRAFT }} />}
                      {stats.inProgress > 0 && <View style={{ flex: stats.inProgress, backgroundColor: STATE_COLOR.IN_PROGRESS }} />}
                      {stats.submitted > 0 && <View style={{ flex: stats.submitted, backgroundColor: STATE_COLOR.SUBMITTED }} />}
                      {stats.verified > 0 && <View style={{ flex: stats.verified, backgroundColor: STATE_COLOR.VERIFIED }} />}
                      {stats.closed > 0 && <View style={{ flex: stats.closed, backgroundColor: STATE_COLOR.CLOSED }} />}
                    </View>
                    <View style={styles.legend}>
                      {([
                        ['DRAFT', stats.draft],
                        ['IN_PROGRESS', stats.inProgress],
                        ['SUBMITTED', stats.submitted],
                        ['VERIFIED', stats.verified],
                        ['CLOSED', stats.closed],
                      ] as const).map(([s, count]) => (
                        <View key={s} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: STATE_COLOR[s] }]} />
                          <Text style={styles.legendText}>{STATE_LABEL[s]}: {count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>This Week</Text>
                <Link href={`/activities/${projectId}`} asChild>
                  <Pressable><Text style={styles.link}>View all</Text></Pressable>
                </Link>
              </View>
              {thisWeek.length === 0 ? (
                <Text style={styles.empty}>Nothing scheduled this week.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {thisWeek.map((a) => {
                    const agenda = weekAgenda(a.plannedEnd!, today);
                    const isToday = agenda.dayLabel === 'Today';
                    return (
                      <Link key={a.id} href={`/activities/${projectId}/${a.id}`} asChild>
                        <Pressable style={styles.weekRow}>
                          <View style={[styles.weekDayBadge, isToday && styles.weekDayBadgeToday]}>
                            <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>{agenda.dayLabel}</Text>
                            <Text style={[styles.weekDateLabel, isToday && styles.weekDayLabelToday]}>{agenda.dateLabel}</Text>
                          </View>
                          <View style={styles.weekInfo}>
                            <Text style={styles.weekTitle} numberOfLines={1}>{a.title}</Text>
                            <View style={styles.weekMetaRow}>
                              {a.phase?.name && <Text style={styles.weekMeta}>{a.phase.name}</Text>}
                              {a.vendorUser?.name && <Text style={styles.weekMeta}>{a.vendorUser.name}</Text>}
                            </View>
                          </View>
                          <Text style={[styles.statePill, { color: STATE_COLOR[a.state] ?? Brand.text }]}>{STATE_LABEL[a.state] ?? a.state}</Text>
                        </Pressable>
                      </Link>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions}>
                {/* Same per-role visibility as the web app's Navbar (src/components/Navbar.tsx)
                    — a role that can't open a screen there doesn't get the tile here either. */}
                <QuickAction href={`/activities/${projectId}`} icon={Flag} label="Activities" />
                <QuickAction href={`/orders/${projectId}`} icon={Package} label="Orders" />
                {(project.myRole === 'PMC' || project.myRole === 'VENDOR') && (
                  <QuickAction href={`/direct-orders/${projectId}`} icon={Truck} label="Direct Orders" />
                )}
                {(project.myRole === 'CLIENT' || project.myRole === 'PMC') && (
                  <QuickAction href={`/analysis/${projectId}`} icon={BarChart2} label="Analysis" />
                )}
                {(project.myRole === 'CLIENT' || project.myRole === 'PMC' || project.myRole === 'VENDOR') && (
                  <QuickAction href={`/payments/${projectId}`} icon={CreditCard} label={project.myRole === 'VENDOR' ? 'My Invoices' : 'Payments'} />
                )}
                {project.myRole !== 'VIEWER' && (
                  <QuickAction href={`/ra-bills/${projectId}`} icon={Receipt} label="RA Bills" />
                )}
                <QuickAction href={`/messages/${projectId}`} icon={MessageCircle} label="Messages" />
                <QuickAction href={`/documents/${projectId}`} icon={FolderOpen} label="Documents" />
                <QuickAction href={`/architecture/${projectId}`} icon={Pencil} label="Architecture" />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Activities</Text>
                <Link href={`/activities/${projectId}`} asChild>
                  <Pressable><Text style={styles.link}>View all</Text></Pressable>
                </Link>
              </View>
              {recent.length === 0 ? (
                <Text style={styles.empty}>No activities on this project yet.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {recent.map((a) => (
                    <View key={a.id} style={styles.recentRow}>
                      <Text style={styles.recentTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={[styles.statePill, { color: STATE_COLOR[a.state] ?? Brand.text }]}>{STATE_LABEL[a.state] ?? a.state}</Text>
                      <Text style={styles.recentDate}>{a.plannedEnd ? formatDate(a.plannedEnd) : '—'}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function StatCard({ label, value, color = Brand.text, small }: { label: string; value: string | number; color?: string; small?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }, small && { fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Flag; label: string }) {
  return (
    // href is built at runtime (`/activities/${projectId}`, etc.) via a prop, same reasoning
    // as feature-project-picker.tsx's cast — a plain string can't match expo-router's static
    // route-literal union once it's passed through a function boundary.
    <Link href={href as Parameters<typeof Link>[0]['href']} asChild>
      <Pressable style={styles.quickActionButton}>
        <Icon size={16} color={Brand.accent} />
        <Text style={styles.quickActionText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 18 },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  roleBadge: {
    fontSize: 10, fontWeight: '700', color: withAlpha(Brand.textRgb, 0.6),
    backgroundColor: Brand.overlayHover, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  statusPill: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  description: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 13, lineHeight: 18 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexBasis: '47%', flexGrow: 1,
    borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface,
    padding: 14, gap: 4,
  },
  statLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 11, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700' },
  section: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  link: { color: Brand.accent, fontSize: 13, fontWeight: '500' },
  progressBar: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: withAlpha(Brand.textRgb, 0.06) },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 11 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  quickActionText: { color: Brand.text, fontSize: 12, fontWeight: '500' },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  recentTitle: { flex: 1, color: Brand.text, fontSize: 13 },
  statePill: { fontSize: 10, fontWeight: '600' },
  recentDate: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11, width: 70, textAlign: 'right' },
  weekRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface,
    padding: 10,
  },
  weekDayBadge: {
    width: 44, alignItems: 'center', gap: 1, paddingVertical: 6, borderRadius: BrandRadius.btn,
    backgroundColor: Brand.overlayHover,
  },
  weekDayBadgeToday: { backgroundColor: withAlpha(Brand.accentRgb, 0.15) },
  weekDayLabel: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  weekDateLabel: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 10, fontWeight: '500' },
  weekDayLabelToday: { color: Brand.accent },
  weekInfo: { flex: 1, gap: 2 },
  weekTitle: { color: Brand.text, fontSize: 13, fontWeight: '600' },
  weekMetaRow: { flexDirection: 'row', gap: 8 },
  weekMeta: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11 },
});
