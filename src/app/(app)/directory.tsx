import { useQuery } from '@tanstack/react-query';
import { DrawerToggleButton } from 'expo-router/drawer';
import { Mail, Phone, Users as UsersIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { DirectoryEntry } from '@/types';

type RoleFilter = 'ALL' | 'VENDOR' | 'CONSULTANT';
const ROLE_TABS: RoleFilter[] = ['ALL', 'VENDOR', 'CONSULTANT'];
const ROLE_COLOR: Record<string, { bg: string; fg: string }> = {
  VENDOR: { bg: 'rgba(92,186,128,0.15)', fg: '#5cba80' },
  CONSULTANT: { bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa' },
};

/** Every vendor and consultant on the platform, across all projects — same data/scope as the
 * web app's /directory (CLIENT/PMC only; the API 403s everyone else, surfaced below). */
export default function DirectoryScreen() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['directory'],
    queryFn: () => apiFetch<DirectoryEntry[]>('/api/directory'),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((entry) => {
      if (roleFilter !== 'ALL' && !entry.roleTypes.includes(roleFilter)) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        (entry.companyName ?? '').toLowerCase().includes(q) ||
        entry.projects.some((p) => p.projectName.toLowerCase().includes(q))
      );
    });
  }, [data, search, roleFilter]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <DrawerToggleButton tintColor={Brand.text} />
          <Text style={styles.headerTitle}>Directory</Text>
          <View style={{ width: 22 }} />
        </View>

        {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}

        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error instanceof ApiError && error.status === 403
                ? "You don't have access to the directory — this is available to Client and PMC roles."
                : 'Failed to load the directory.'}
            </Text>
          </View>
        )}

        {data && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.controls}>
                <TextInput
                  style={styles.search}
                  placeholder="Search by name, company, or project…"
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                  value={search}
                  onChangeText={setSearch}
                />
                <View style={styles.tabRow}>
                  {ROLE_TABS.map((r) => (
                    <Pressable key={r} onPress={() => setRoleFilter(r)} style={[styles.tab, roleFilter === r && styles.tabActive]}>
                      <Text style={[styles.tabText, roleFilter === r && styles.tabTextActive]}>
                        {r === 'ALL' ? 'All' : r === 'VENDOR' ? 'Vendors' : 'Consultants'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => <DirectoryCard entry={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <Text style={styles.empty}>{search || roleFilter !== 'ALL' ? 'No matches found.' : 'No vendors or consultants registered yet.'}</Text>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function DirectoryCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{entry.name}</Text>
          {entry.companyName && <Text style={styles.cardCompany} numberOfLines={1}>{entry.companyName}</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {entry.roleTypes.map((r) => {
            const c = ROLE_COLOR[r] ?? { bg: withAlpha(Brand.textRgb, 0.08), fg: Brand.text };
            return (
              <Text key={r} style={[styles.roleBadge, { color: c.fg, backgroundColor: c.bg }]}>{r}</Text>
            );
          })}
        </View>
      </View>

      <Pressable onPress={() => Linking.openURL(`mailto:${entry.email}`)}>
        <View style={styles.contactRow}>
          <Mail size={13} color={Brand.accent} />
          <Text style={styles.contactText}>{entry.email}</Text>
        </View>
      </Pressable>
      {entry.mobile && (
        <Pressable onPress={() => Linking.openURL(`tel:${entry.mobile}`)}>
          <View style={styles.contactRow}>
            <Phone size={13} color={Brand.accent} />
            <Text style={styles.contactText}>{entry.mobile}</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.projectsLabel}>Projects ({entry.projects.length})</Text>
        {entry.projects.slice(0, 3).map((p, i) => (
          <View key={i} style={styles.projectRow}>
            <Text style={styles.projectName} numberOfLines={1}>{p.projectName}</Text>
            <Text style={styles.projectRole}>{p.role === 'VENDOR' ? 'Vendor' : 'Consultant'}</Text>
          </View>
        ))}
        {entry.projects.length > 3 && (
          <Text style={styles.moreText}>+{entry.projects.length - 3} more</Text>
        )}
      </View>

      <Text style={styles.memberSince}>On platform since {formatDate(entry.memberSince)}</Text>
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
  errorBox: { margin: 20, borderRadius: 8, padding: 12, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  list: { padding: 20, paddingTop: 16 },
  controls: { gap: 12, marginBottom: 16 },
  search: {
    height: 40,
    borderRadius: BrandRadius.input,
    borderWidth: 1,
    borderColor: Brand.inputBorder,
    backgroundColor: Brand.input,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Brand.text,
  },
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: Brand.accent },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: Brand.btnText, fontWeight: '600' },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  card: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardName: { color: Brand.text, fontSize: 15, fontWeight: '600' },
  cardCompany: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12, marginTop: 1 },
  roleBadge: { fontSize: 9, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { color: Brand.accent, fontSize: 12 },
  cardFooter: { paddingTop: 8, borderTopWidth: 1, borderTopColor: Brand.border, gap: 4 },
  projectsLabel: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  projectRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  projectName: { flex: 1, color: withAlpha(Brand.textRgb, 0.6), fontSize: 12 },
  projectRole: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11 },
  moreText: { color: Brand.accent, fontSize: 11, fontWeight: '500' },
  memberSince: { color: withAlpha(Brand.textRgb, 0.25), fontSize: 10 },
});
