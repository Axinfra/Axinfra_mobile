import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { DrawerToggleButton } from 'expo-router/drawer';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import type { Project } from '@/types';

/**
 * "Select a project" landing screen — the same pattern the web app uses for its top-level
 * Reports/Architecture/Direct Orders/Documents sidebar entries (e.g.
 * src/app/reports/page.tsx): these features are project-scoped, so the sidebar item's only
 * job is picking which project, then handing off to the real per-project screen.
 */
export function FeatureProjectPicker({
  title,
  description,
  icon: Icon,
  destination,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  destination: (projectId: string) => string;
}) {
  const router = useRouter();
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <DrawerToggleButton tintColor={Brand.text} />
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.intro}>
            <View style={styles.iconWrap}>
              <Icon size={20} color={Brand.btnText} />
            </View>
            <Text style={styles.introText}>{description}</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Brand.accent} style={{ marginTop: 24 }} />
          ) : !projects || projects.length === 0 ? (
            <Text style={styles.empty}>No projects found.</Text>
          ) : (
            <View style={styles.list}>
              <Text style={styles.listLabel}>Select a project</Text>
              {projects.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.row}
                  // destination() builds a dynamic path (e.g. `/reports/${id}`) at runtime, so
                  // it's a plain string, not one of expo-router's statically-known route
                  // literals — same reasoning as the inline template-literal Links elsewhere
                  // (e.g. index.tsx's Execution Intelligence link), just through a prop boundary
                  // that erases the literal type.
                  onPress={() => router.push(destination(p.id) as any)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.rowSubtitle}>{p.myRole} · {p.status}</Text>
                  </View>
                  <ChevronRight size={18} color={withAlpha(Brand.textRgb, 0.3)} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  headerTitle: { color: Brand.text, fontSize: 16, fontWeight: '600' },
  scroll: { padding: 20, gap: 20 },
  intro: { gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BrandRadius.btn,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 14, lineHeight: 20 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  list: { gap: 8 },
  listLabel: {
    color: withAlpha(Brand.textRgb, 0.35),
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  rowTitle: { color: Brand.text, fontSize: 14, fontWeight: '500' },
  rowSubtitle: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 12, marginTop: 2 },
});
