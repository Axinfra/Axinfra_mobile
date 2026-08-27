import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Package, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import type { PurchaseOrder } from '@/types';

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Purchase Orders — one per Phase, same list the web app's Orders page shows. Tap one to see
 * its Vendor, BOQ(s), Work Order, and RA Bills — see orders/[projectId]/[orderId].tsx. */
export default function OrdersScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['phases', projectId],
    queryFn: () => apiFetch<PurchaseOrder[]>(`/api/projects/${projectId}/phases`),
    enabled: !!projectId,
  });

  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Orders" />

        <View style={styles.searchRow}>
          <Search size={15} color={withAlpha(Brand.textRgb, 0.4)} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search orders…"
            placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
          />
        </View>

        {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}
        {isError && <Text style={styles.error}>Couldn't load orders.</Text>}

        {data && (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const boqCount = item.boqs.length;
              const approvedCount = item.boqs.filter((b) => b.status === 'APPROVED').length;
              return (
                <Link href={`/orders/${projectId}/${item.id}`} asChild>
                  <Pressable style={styles.card}>
                    <View style={styles.cardTop}>
                      <Package size={16} color={Brand.accent} />
                      <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <View style={styles.cardFooter}>
                      <Text style={styles.footerText}>
                        {boqCount === 0 ? 'No BOQ yet' : `${approvedCount}/${boqCount} BOQ${boqCount === 1 ? '' : 's'} approved`}
                      </Text>
                      {item.estimatedCost != null && <Text style={styles.value}>{money(item.estimatedCost)}</Text>}
                    </View>
                  </Pressable>
                </Link>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={<Text style={styles.empty}>{query ? 'No matching orders.' : 'No Purchase Orders on this project yet.'}</Text>}
          />
        )}
      </SafeAreaView>
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
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  list: { padding: 20, paddingTop: 12 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  card: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 12 },
  value: { color: Brand.text, fontSize: 14, fontWeight: '700' },
});
