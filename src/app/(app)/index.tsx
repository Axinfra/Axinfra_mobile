import { useQuery } from '@tanstack/react-query';
import { DrawerToggleButton } from 'expo-router/drawer';
import { Link } from 'expo-router';
import { Building2, ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysFromToday, formatDate } from '@/lib/format';
import type { Activity, Profile, Project } from '@/types';

const SLIDER_CARD_WIDTH = Math.min(260, Dimensions.get('window').width - 72);

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ONGOING: { label: 'Ongoing', color: Brand.accent, bg: withAlpha(Brand.accentRgb, 0.1) },
  COMPLETED: { label: 'Completed', color: '#5cba80', bg: 'rgba(92,186,128,0.1)' },
};

export default function HomeScreen() {
  const { user, logout } = useAuth();

  const { data: projects, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });

  // Powers the "complete your vendor profile" banner below (→ /vendor-profile) — same
  // isVendor/isProfileComplete fields the web app's post-invite redirect uses
  // (src/app/api/profile/route.ts).
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<Profile>('/api/profile'),
  });
  const needsVendorOnboarding = !!profile && profile.isVendor && !profile.isProfileComplete;

  // Site Engineer activity slider — SITE_ENGINEER is a per-project role, so scope to whichever
  // project the user holds that role on (the first one, if more than one).
  const siteEngineerProject = projects?.find((p) => p.myRole === 'SITE_ENGINEER');
  const { data: activities } = useQuery({
    queryKey: ['activities', siteEngineerProject?.id],
    queryFn: () => apiFetch<Activity[]>(`/api/projects/${siteEngineerProject!.id}/milestones?all=true`),
    enabled: !!siteEngineerProject,
  });
  const upcomingActivities = (activities ?? [])
    .filter((a) => a.plannedEnd && a.state !== 'VERIFIED' && a.state !== 'CLOSED')
    .sort((a, b) => (a.plannedEnd ?? '').localeCompare(b.plannedEnd ?? ''))
    .slice(0, 8);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <DrawerToggleButton tintColor={Brand.text} />
            <View>
              <Text style={styles.heading}>Projects</Text>
              {user && <Text style={styles.subheading}>Signed in as {user.name || user.email}</Text>}
            </View>
          </View>
          <Pressable onPress={logout}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>

        {isLoading && <ActivityIndicator color={Brand.accent} style={styles.centered} />}

        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Couldn't load projects: {error instanceof Error ? error.message : 'unknown error'}
            </Text>
            <Pressable onPress={() => refetch()}>
              <Text style={styles.link}>Retry</Text>
            </Pressable>
          </View>
        )}

        {projects && (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {needsVendorOnboarding && (
                  <Link href="/vendor-profile" asChild>
                    <Pressable style={styles.vendorBanner}>
                      <View style={styles.vendorBannerIcon}>
                        <Building2 size={18} color={Brand.accent} />
                      </View>
                      <View style={styles.vendorBannerText}>
                        <Text style={styles.vendorBannerTitle}>Complete your vendor profile</Text>
                        <Text style={styles.vendorBannerSubtitle}>
                          Add your company details so the project team knows who they're working with.
                        </Text>
                      </View>
                      <ChevronRight size={18} color={withAlpha(Brand.textRgb, 0.35)} />
                    </Pressable>
                  </Link>
                )}

                {siteEngineerProject && upcomingActivities.length > 0 && (
                  <View style={styles.sliderSection}>
                    <Text style={styles.sectionTitle}>Upcoming Activities</Text>
                    <Text style={styles.sectionSubtitle}>{siteEngineerProject.name}</Text>
                    <FlatList
                      horizontal
                      data={upcomingActivities}
                      keyExtractor={(item) => item.id}
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={SLIDER_CARD_WIDTH + 12}
                      decelerationRate="fast"
                      contentContainerStyle={styles.sliderList}
                      renderItem={({ item }) => <ActivitySliderCard activity={item} />}
                    />
                  </View>
                )}

                {projects.length > 0 && <Text style={styles.sectionTitle}>All Projects</Text>}
              </View>
            }
            renderItem={({ item }) => <ProjectCard project={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={<Text style={styles.subheading}>No projects yet.</Text>}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function ActivitySliderCard({ activity }: { activity: Activity }) {
  const days = daysFromToday(activity.plannedEnd);
  const overdue = days !== null && days < 0;
  return (
    <View style={[styles.sliderCard, { width: SLIDER_CARD_WIDTH }]}>
      <Text style={styles.sliderCardTitle} numberOfLines={2}>{activity.title}</Text>
      {activity.phase?.name && <Text style={styles.sliderCardPhase}>{activity.phase.name}</Text>}
      <View style={styles.sliderCardFooter}>
        <Text style={[styles.dueDaysPill, overdue ? styles.dueDaysPillOverdue : styles.dueDaysPillUpcoming]}>
          {days === null ? 'No due date' : overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
        </Text>
        <Text style={styles.sliderCardPercent}>{Math.round(activity.percentComplete ?? 0)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, activity.percentComplete ?? 0)}%` }]} />
      </View>
    </View>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const status = STATUS_STYLE[project.status];
  return (
    <Link href={`/project/${project.id}`} asChild>
      <Pressable style={styles.projectCard}>
        <View style={styles.projectCardTop}>
          <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
          <Text style={styles.roleBadge}>{project.myRole}</Text>
        </View>

        <View style={styles.pillRow}>
          {project.isExampleProject && <Text style={[styles.statusPill, { color: Brand.accent, backgroundColor: withAlpha(Brand.accentRgb, 0.1) }]}>Example</Text>}
          {status && <Text style={[styles.statusPill, { color: status.color, backgroundColor: status.bg }]}>{status.label}</Text>}
        </View>

        {project.description && (
          <Text style={styles.projectDescription} numberOfLines={2}>{project.description}</Text>
        )}

        <View style={styles.projectFooter}>
          <Text style={styles.projectFooterText}>{project.milestoneCount} milestones</Text>
          <Text style={styles.projectFooterText}>{formatDate(project.createdAt)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heading: { color: Brand.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  subheading: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 13, marginTop: 2 },
  link: { color: Brand.accent, fontSize: 14, fontWeight: '500' },
  centered: { marginTop: 60 },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: Brand.errorBg,
    borderWidth: 1,
    borderColor: Brand.errorBorder,
  },
  errorText: { color: Brand.error, fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16 },
  listHeader: { gap: 20, marginBottom: 12 },

  vendorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: withAlpha(Brand.accentRgb, 0.3),
    backgroundColor: withAlpha(Brand.accentRgb, 0.06),
  },
  vendorBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(Brand.accentRgb, 0.12),
  },
  vendorBannerText: { flex: 1, gap: 2 },
  vendorBannerTitle: { color: Brand.text, fontSize: 14, fontWeight: '600' },
  vendorBannerSubtitle: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12, lineHeight: 16 },

  sectionTitle: { color: Brand.text, fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 12, marginTop: -14, marginBottom: 4 },
  sliderSection: { gap: 8 },
  sliderList: { gap: 12, paddingRight: 20, paddingTop: 4 },
  sliderCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 14,
    gap: 8,
  },
  sliderCardTitle: { color: Brand.text, fontSize: 14, fontWeight: '600', minHeight: 36 },
  sliderCardPhase: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11 },
  sliderCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderCardPercent: { color: Brand.text, fontSize: 12, fontWeight: '600' },
  dueDaysPill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  dueDaysPillUpcoming: { color: '#eab308', backgroundColor: 'rgba(234,179,8,0.14)' },
  dueDaysPillOverdue: { color: Brand.error, backgroundColor: Brand.errorBg },
  progressTrack: { height: 4, borderRadius: 999, backgroundColor: withAlpha(Brand.textRgb, 0.08), overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 999, backgroundColor: Brand.accent },

  projectCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 16,
    gap: 8,
  },
  projectCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  projectName: { flex: 1, color: Brand.text, fontSize: 16, fontWeight: '600' },
  roleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: withAlpha(Brand.textRgb, 0.6),
    backgroundColor: Brand.overlayHover,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillRow: { flexDirection: 'row', gap: 6 },
  statusPill: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  projectDescription: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 13, lineHeight: 18 },
  projectFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  projectFooterText: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 12 },
});
