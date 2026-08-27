import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Receipt, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import type { RaBill, RaBillsResponse } from '@/types';

type Tab = 'ALL' | RaBill['status'];
const TAB_ORDER: Tab[] = ['ALL', 'DRAFT', 'PENDING_SITE_ENGINEER_REVIEW', 'PENDING_VENDOR_REVIEW', 'REVISION_REQUESTED', 'CERTIFIED', 'APPROVED', 'PAID'];
const STATUS_LABEL: Record<string, string> = {
  ALL: 'All', DRAFT: 'Draft', PENDING_SITE_ENGINEER_REVIEW: 'With Site Engineer', PENDING_VENDOR_REVIEW: 'Pending Certification',
  REVISION_REQUESTED: 'Needs Revision', CERTIFIED: 'Certified', APPROVED: 'Approved', PAID: 'Paid',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.4), PENDING_SITE_ENGINEER_REVIEW: '#a855f7', PENDING_VENDOR_REVIEW: '#eab308',
  REVISION_REQUESTED: '#f97316', CERTIFIED: '#38bdf8', APPROVED: '#5cba80', PAID: '#5cba80',
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
/** Sum of `thisBillAmount` — the bill's gross/"Certified Value", same computation as the web
 * app's `raBillGross()`. Used as the fallback headline figure before submittedValue exists. */
function gross(bill: RaBill) {
  return bill.lineItems.reduce((sum, l) => sum + l.thisBillAmount, 0);
}

/** RA (Running Account) Bills — same list/summary as the web app's RA Bills page, split into
 * a tab per state (matching the state machine in ra-bills/[projectId]/[raBillId].tsx) so every
 * stage is a quick glance instead of scanning one long mixed list, plus a search bar over bill
 * number / order name. Tap a bill to open its detail/action screen. Actually paying a bill
 * (Ready to Pay / Paid, Pay Now, Download) lives in the main Payments tab, not here — see
 * payments/[projectId].tsx. */
export default function RaBillsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['ra-bills', projectId],
    queryFn: () => apiFetch<RaBillsResponse>(`/api/projects/${projectId}/ra-bills`),
    enabled: !!projectId,
  });

  const [tab, setTab] = useState<Tab>('ALL');
  const [query, setQuery] = useState('');

  const byTab = useMemo(() => {
    const counts: Record<Tab, number> = { ALL: 0, DRAFT: 0, PENDING_SITE_ENGINEER_REVIEW: 0, PENDING_VENDOR_REVIEW: 0, REVISION_REQUESTED: 0, CERTIFIED: 0, APPROVED: 0, PAID: 0 };
    for (const b of data?.raBills ?? []) {
      counts.ALL++;
      counts[b.status as Tab] = (counts[b.status as Tab] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.raBills ?? [])
      .filter((b) => tab === 'ALL' || b.status === tab)
      .filter((b) => !q || `ra-${b.billNumber}`.includes(q) || b.order.name.toLowerCase().includes(q));
  }, [data, tab, query]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="RA Bills" />

        <View style={styles.searchRow}>
          <Search size={15} color={withAlpha(Brand.textRgb, 0.4)} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search bill number or order…"
            placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TAB_ORDER.map((t) => {
            const active = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{STATUS_LABEL[t]}</Text>
                <Text style={[styles.tabCount, active && styles.tabCountActive]}>{byTab[t]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}
        {isError && <Text style={styles.error}>Couldn't load RA Bills.</Text>}

        {data && (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              tab === 'ALL' && !query ? (
                <View style={styles.summaryRow}>
                  <SummaryStat label="Submitted" value={data.summary.totalSubmittedValue} />
                  <SummaryStat label="Approved" value={data.summary.totalApprovedValue} color="#38bdf8" />
                  <SummaryStat label="Released" value={data.summary.totalReleasedValue} color="#5cba80" />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Link href={`/ra-bills/${projectId}/${item.id}`} asChild>
                <Pressable><BillRow bill={item} /></Pressable>
              </Link>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={<Text style={styles.empty}>{query ? 'No matching bills.' : 'No bills in this state.'}</Text>}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function SummaryStat({ label, value, color = Brand.text }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{money(value)}</Text>
    </View>
  );
}

function BillRow({ bill }: { bill: RaBill }) {
  const value = bill.releasedValue ?? bill.approvedValue ?? bill.submittedValue ?? gross(bill);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Receipt size={16} color={Brand.accent} />
        <Text style={styles.title}>RA-{bill.billNumber}</Text>
        <Text style={[styles.statusPill, { color: STATUS_COLOR[bill.status] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
          {STATUS_LABEL[bill.status] ?? bill.status}
        </Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.footerText} numberOfLines={1}>{bill.order.name}</Text>
        <Text style={styles.value}>{money(value)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 14, height: 38,
    borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: Brand.text, fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: Brand.accent },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: Brand.btnText, fontWeight: '600' },
  tabCount: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11 },
  tabCountActive: { color: 'rgba(10,12,16,0.6)' },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  list: { padding: 20, paddingTop: 12 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryStat: { flex: 1, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 12, gap: 4 },
  summaryLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 10, fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  card: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '700' },
  statusPill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { flex: 1, color: withAlpha(Brand.textRgb, 0.45), fontSize: 12 },
  value: { color: Brand.text, fontSize: 14, fontWeight: '700' },
});
