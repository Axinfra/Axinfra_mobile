import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { DirectOrder, DirectOrdersResponse, Project } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  ORDERED: '#94a3b8', IN_PROGRESS: '#3b82f6', IN_DELIVERY: '#f5a623',
  DELIVERED: '#22c55e', QTY_VARIANCE: '#f97316', PAID: '#22c55e',
};

// Matches VENDOR_SETTABLE_STATUSES in the web repo's DirectOrderService — a Vendor can move
// their own order between these; PMC can set any of the six, including PAID.
const ALL_STATUSES = ['ORDERED', 'IN_PROGRESS', 'IN_DELIVERY', 'DELIVERED', 'QTY_VARIANCE', 'PAID'];
const VENDOR_SETTABLE_STATUSES = ['IN_PROGRESS', 'IN_DELIVERY', 'DELIVERED', 'QTY_VARIANCE'];

/** PMC/VENDOR only, matching RoleGuard on the web route — CLIENT gets a 403, shown below
 * rather than silently empty. PMC additionally gets "New Order" and can set any status; a
 * Vendor can update status on their own orders only, and only to a fulfillment-progress
 * status — same rule the PATCH route enforces server-side, mirrored here just to avoid
 * offering an action that would 403. */
export default function DirectOrdersDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const myRole = projects?.find((p) => p.id === projectId)?.myRole;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['direct-orders', projectId],
    queryFn: () => apiFetch<DirectOrdersResponse>(`/api/projects/${projectId}/direct-orders`),
    enabled: !!projectId,
  });
  // The direct-orders route doesn't return the project's currency (unlike cost-overview),
  // so this defaults to INR rather than fetching the project separately just for a symbol.
  const currency = 'INR';

  async function updateStatus(orderId: string, status: string) {
    try {
      await apiFetch(`/api/projects/${projectId}/direct-orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await queryClient.invalidateQueries({ queryKey: ['direct-orders', projectId] });
    } catch (err) {
      Alert.alert('Could not update status', err instanceof ApiError ? err.message : 'Check your connection and try again.');
    }
  }

  function handlePressOrder(order: DirectOrder) {
    if (myRole !== 'PMC' && myRole !== 'VENDOR') return;
    if (myRole === 'VENDOR' && order.vendorUserId !== user?.id) return;
    if (order.status === 'PAID') return; // terminal state, matches the PATCH route's own guard

    const settable = myRole === 'PMC' ? ALL_STATUSES : VENDOR_SETTABLE_STATUSES;
    const options = settable.filter((s) => s !== order.status);
    if (options.length === 0) return;

    Alert.alert(
      order.doNumber,
      'Update status to:',
      [
        ...options.map((s) => ({ text: s.replace(/_/g, ' '), onPress: () => updateStatus(order.id, s) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader
          title="Direct Orders"
          right={
            myRole === 'PMC' ? (
              <Link href={`/direct-orders/${projectId}/new`} asChild>
                <Pressable hitSlop={8}>
                  <Plus size={22} color={Brand.accent} />
                </Pressable>
              </Link>
            ) : undefined
          }
        />

        {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />}

        {isError && (
          <Text style={styles.error}>
            {error instanceof ApiError && error.status === 403
              ? "You don't have access to Direct Orders on this project."
              : "Couldn't load Direct Orders."}
          </Text>
        )}

        {data && (
          <FlatList
            data={data.directOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.summaryRow}>
                <SummaryStat label="Ordered" value={data.summary.totalOrdered} />
                <SummaryStat label="Paid" value={data.summary.paid} color="#5cba80" />
                <SummaryStat label="Outstanding" value={data.summary.outstanding} color={data.summary.outstanding > 0 ? '#f97316' : '#5cba80'} />
              </View>
            }
            renderItem={({ item }) => (
              <OrderRow
                order={item}
                currency={currency}
                editable={
                  (myRole === 'PMC' || (myRole === 'VENDOR' && item.vendorUserId === user?.id)) && item.status !== 'PAID'
                }
                onPress={() => handlePressOrder(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={<Text style={styles.empty}>No Direct Orders on this project.</Text>}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function money(n: number, currency: string) {
  return `${currency} ${Math.round(n).toLocaleString('en-IN')}`;
}

function SummaryStat({ label, value, color = Brand.text }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{money(value, 'INR')}</Text>
    </View>
  );
}

function OrderRow({ order, currency, editable, onPress }: { order: DirectOrder; currency: string; editable: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={editable ? onPress : undefined}>
      <View style={styles.cardTop}>
        <Text style={styles.doNumber}>{order.doNumber}</Text>
        <Text style={[styles.statusPill, { color: STATUS_COLOR[order.status] ?? '#94a3b8', backgroundColor: `${STATUS_COLOR[order.status] ?? '#94a3b8'}22` }]}>
          {order.status.replace(/_/g, ' ')}
        </Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>{order.itemDescription}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>{order.vendorName}</Text>
        <Text style={styles.footerText}>{money(order.value, currency)}</Text>
      </View>
      <View style={styles.cardBottomRow}>
        <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
        {editable && <Text style={styles.editHint}>Tap to update status</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  list: { padding: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryStat: {
    flex: 1,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 12,
    gap: 4,
  },
  summaryLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 10, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  card: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doNumber: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  statusPill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  description: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 12 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: withAlpha(Brand.textRgb, 0.3), fontSize: 11 },
  editHint: { color: Brand.accent, fontSize: 11, fontWeight: '500' },
});
