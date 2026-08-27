import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import type { ExecutionAnalysis, VendorAnalysis } from '@/types';

type Tab = 'execution' | 'variance' | 'schedule-risk' | 'cost' | 'vendor';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'execution', label: 'Execution Analysis' },
  { id: 'variance', label: 'Time & Money Variance' },
  { id: 'schedule-risk', label: 'Schedule Risk' },
  { id: 'cost', label: 'Cost Overview' },
  { id: 'vendor', label: 'Vendor Analysis' },
];

// Reuses /api/projects/[projectId]/analysis?tab=variance — same envelope shape documented in
// the web repo's AnalysisService.VarianceAnalysis. 'schedule-risk' is an alias for the same
// route/cache entry on the backend (src/app/api/projects/[projectId]/analysis/route.ts), so
// both tabs here read from the same `variance` payload — Time & Money Variance shows the
// headline numbers, Schedule Risk drills into which activities are behind and why.
interface VarianceData {
  schedule: {
    onTimePercent: number;
    overdueCount: number;
    totalActivities: number;
    healthBreakdown: Record<string, number>;
    atRiskActivities: Array<{ id: string; title: string; dueDate: string; expectedPercent: number; actualPercent: number; progressGapPoints: number; value: number; vendorName: string | null }>;
    overdueActivities: Array<{ id: string; title: string; dueDate: string; daysOverdue: number; severity: string }>;
  };
  bills: { totals: { totalPlannedValue: number; totalReleasedValue: number; totalVariance: number; totalVariancePercent: number } };
  overallVarianceScore: number;
}

const RISK_COLOR: Record<string, string> = { LOW: '#5cba80', MEDIUM: '#eab308', HIGH: Brand.error };
const HEALTH_LABEL: Record<string, string> = {
  ON_TRACK: 'On Track', AT_RISK: 'At Risk', DELAYED: 'Delayed', COMPLETED_LATE: 'Completed Late', COMPLETED_ON_TIME: 'Completed On Time',
};
const HEALTH_COLOR: Record<string, string> = {
  ON_TRACK: '#5cba80', AT_RISK: '#eab308', DELAYED: Brand.error, COMPLETED_LATE: '#f97316', COMPLETED_ON_TIME: '#38bdf8',
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * CLIENT/PMC only, matching RoleGuard on the web route. 5 of the web Analysis page's 7 tabs —
 * Execution, Time & Money Variance, Schedule Risk, Cost Overview, Vendor — the headline numbers
 * from each rather than every drill-down table. Delay & Risk and Compliance aren't ported.
 * Cost Overview is the one tab that doesn't go through the analysis endpoint — it hits
 * /api/projects/[projectId]/cost-overview directly, same as the web Analysis page does for the
 * same reason (that route already reuses AnalysisService itself, so a second hop through the
 * generic analysis endpoint would be redundant).
 */
export default function AnalysisScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [tab, setTab] = useState<Tab>('execution');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analysis', projectId, tab],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/projects/${projectId}/analysis?tab=${tab}`),
    enabled: !!projectId && tab !== 'cost',
  });

  const { data: cost, isLoading: costLoading, isError: costError, error: costErrorObj } = useQuery({
    queryKey: ['cost-snapshot-full', projectId],
    queryFn: () => apiFetch<CostOverviewData>(`/api/projects/${projectId}/cost-overview`),
    enabled: !!projectId && tab === 'cost',
  });

  const loading = tab === 'cost' ? costLoading : isLoading;
  const hasError = tab === 'cost' ? costError : isError;
  const activeError = tab === 'cost' ? costErrorObj : error;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Analysis" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}
        {hasError && (
          <Text style={styles.error}>
            {activeError instanceof ApiError && activeError.status === 403 ? "Analysis is available to Client and PMC only." : "Couldn't load analysis."}
          </Text>
        )}

        {!loading && !hasError && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {tab === 'execution' && data && <ExecutionTab data={data.execution as ExecutionAnalysis} />}
            {tab === 'variance' && data && <VarianceTab data={data.variance as VarianceData} />}
            {tab === 'schedule-risk' && data && <ScheduleRiskTab data={(data.variance as VarianceData).schedule} />}
            {tab === 'cost' && cost && <CostOverviewTab data={cost} />}
            {tab === 'vendor' && data && <VendorTab data={data.vendor as VendorAnalysis} />}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function ExecutionTab({ data }: { data: ExecutionAnalysis }) {
  const o = data.overview;
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.statGrid}>
        <StatCard label="Verified" value={`${o.verifiedPercent}%`} color="#5cba80" />
        <StatCard label="Due Soon" value={o.approachingCount} color="#eab308" />
        <StatCard label="Avg Days In Progress" value={o.avgDaysInProgress} />
        <StatCard label="Avg Days Awaiting Review" value={o.avgDaysInSubmitted} color={o.avgDaysInSubmitted > 7 ? Brand.error : Brand.text} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>State Distribution</Text>
        <View style={{ gap: 10, marginTop: 10 }}>
          {data.stateBreakdown.map((s) => (
            <View key={s.state} style={{ gap: 4 }}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>{s.state}</Text>
                <Text style={styles.barLabel}>{s.count} ({Math.round(s.percent)}%)</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${s.percent}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function VarianceTab({ data }: { data: VarianceData }) {
  const { schedule, bills, overallVarianceScore } = data;
  const scoreColor = overallVarianceScore > 50 ? Brand.error : overallVarianceScore > 25 ? '#eab308' : '#5cba80';
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.scoreCard}>
        <Text style={styles.sectionTitle}>Overall Variance Score</Text>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{overallVarianceScore}</Text>
      </View>
      <View style={styles.statGrid}>
        <StatCard label="On-Time" value={`${schedule.onTimePercent}%`} color={schedule.onTimePercent >= 80 ? '#5cba80' : '#eab308'} />
        <StatCard label="Overdue Activities" value={schedule.overdueCount} color={schedule.overdueCount > 0 ? Brand.error : '#5cba80'} />
        <StatCard label="Order Planned Value" value={money(bills.totals.totalPlannedValue)} small />
        <StatCard label="Released Value" value={money(bills.totals.totalReleasedValue)} color="#5cba80" small />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill Variance</Text>
        <Text style={[styles.scoreValue, { fontSize: 20, marginTop: 6, color: Math.abs(bills.totals.totalVariancePercent) > 20 ? Brand.error : Brand.text }]}>
          {money(bills.totals.totalVariance)}
        </Text>
        <Text style={styles.metaText}>{bills.totals.totalVariancePercent > 0 ? '+' : ''}{bills.totals.totalVariancePercent}% of planned</Text>
      </View>
    </View>
  );
}

function ScheduleRiskTab({ data }: { data: VarianceData['schedule'] }) {
  const healthTotal = Object.values(data.healthBreakdown ?? {}).reduce((s, n) => s + n, 0) || 1;
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.statGrid}>
        <StatCard label="On Time" value={`${data.onTimePercent}%`} color={data.onTimePercent >= 80 ? '#5cba80' : '#eab308'} />
        <StatCard label="At Risk" value={data.atRiskActivities.length} color={data.atRiskActivities.length > 0 ? '#eab308' : '#5cba80'} />
        <StatCard label="Already Overdue" value={data.overdueActivities.length} color={data.overdueActivities.length > 0 ? Brand.error : '#5cba80'} />
        <StatCard label="Total Activities" value={data.totalActivities} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule Health</Text>
        <View style={styles.healthBar}>
          {Object.entries(data.healthBreakdown ?? {}).map(([k, count]) => count > 0 && (
            <View key={k} style={{ flex: count, backgroundColor: HEALTH_COLOR[k] ?? Brand.accent }} />
          ))}
        </View>
        <View style={styles.legend}>
          {Object.entries(data.healthBreakdown ?? {}).map(([k, count]) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: HEALTH_COLOR[k] ?? Brand.accent }]} />
              <Text style={styles.legendText}>{HEALTH_LABEL[k] ?? k}: {count}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, { borderColor: 'rgba(234,179,8,0.3)' }]}>
        <Text style={[styles.sectionTitle, { color: '#eab308' }]}>At Risk — May Cause Delay ({data.atRiskActivities.length})</Text>
        <Text style={styles.metaText}>Not overdue yet, but running behind the pace needed to finish on time</Text>
        {data.atRiskActivities.length === 0 ? (
          <Text style={[styles.emptyText, { marginTop: 8 }]}>Nothing quietly falling behind right now.</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {data.atRiskActivities.map((a) => (
              <View key={a.id} style={styles.riskRow}>
                <Text style={styles.riskTitle} numberOfLines={1}>{a.title}</Text>
                <View style={styles.riskMetaRow}>
                  <Text style={styles.metaText}>{a.vendorName ?? '—'} · Expected {a.expectedPercent}%, actual {a.actualPercent}%</Text>
                  <Text style={styles.riskGap}>{a.progressGapPoints}pt behind</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {data.overdueActivities.length > 0 && (
        <View style={[styles.section, { borderColor: 'rgba(224,96,80,0.3)' }]}>
          <Text style={[styles.sectionTitle, { color: Brand.error }]}>Already Overdue ({data.overdueActivities.length})</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {data.overdueActivities.slice(0, 10).map((a) => (
              <View key={a.id} style={styles.riskRow}>
                <Text style={styles.riskTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.riskGap}>{a.daysOverdue}d overdue · {a.severity}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// GET /api/projects/[projectId]/cost-overview — src/app/api/projects/[projectId]/cost-overview/
// route.ts. Consolidates BOQ+Direct Orders+Consultant fees+Architecture fees into one
// committed/paid/outstanding picture; delayCost is a separate risk projection, not folded into
// "committed" (matches the web route's own comment on why).
interface CostOverviewData {
  currency: string;
  totals: { committed: number; paidToDate: number; outstanding: number };
  boq: { planned: number; submitted: number; approved: number; released: number; variance: number; variancePercent: number; orderCount: number };
  directOrders: {
    ordered: number; delivered: number; paid: number; outstanding: number; variance: number;
    orders: Array<{ id: string; doNumber: string; description: string; ordered: number; billed: number | null; status: string }>;
  };
  consultantFees: { total: number; byPerson: Array<{ userId: string; name: string; fee: number }> };
  architectureFees: { total: number; paid: number; due: number; setCount: number };
  delayCost: { overheadCost: number; penaltyCost: number; opportunityCost: number; totalEstimatedCost: number; totalOverrunDays: number; isConfigured: boolean };
}

function CostOverviewTab({ data }: { data: CostOverviewData }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.statGrid}>
        <StatCard label="Total Committed" value={money(data.totals.committed)} small />
        <StatCard label="Paid to Date" value={money(data.totals.paidToDate)} color="#5cba80" small />
        <StatCard label="Outstanding" value={money(data.totals.outstanding)} color={data.totals.outstanding > 0 ? '#f97316' : '#5cba80'} small />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BOQ (Purchase Orders)</Text>
        <Text style={styles.metaText}>{data.boq.orderCount} order(s) with BOQ items</Text>
        <View style={styles.statGrid}>
          <MiniStat label="Planned" value={money(data.boq.planned)} />
          <MiniStat label="Submitted" value={money(data.boq.submitted)} />
          <MiniStat label="Approved" value={money(data.boq.approved)} />
          <MiniStat label="Released" value={money(data.boq.released)} color="#5cba80" />
          <MiniStat label="Variance" value={`${money(data.boq.variance)} (${data.boq.variancePercent > 0 ? '+' : ''}${data.boq.variancePercent}%)`} color={data.boq.variance < 0 ? '#f97316' : Brand.text} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Direct Orders</Text>
        <Text style={styles.metaText}>One-off vendor purchases outside the BOQ flow</Text>
        <View style={styles.statGrid}>
          <MiniStat label="Ordered" value={money(data.directOrders.ordered)} />
          <MiniStat label="Delivered" value={money(data.directOrders.delivered)} />
          <MiniStat label="Paid" value={money(data.directOrders.paid)} color="#5cba80" />
          <MiniStat label="Variance" value={money(data.directOrders.variance)} color={data.directOrders.variance < 0 ? '#f97316' : Brand.text} />
        </View>
        {data.directOrders.orders.length > 0 && (
          <View style={{ gap: 6, marginTop: 12 }}>
            {data.directOrders.orders.map((o) => (
              <View key={o.id} style={styles.doRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doNumber}>{o.doNumber}</Text>
                  <Text style={styles.metaText} numberOfLines={1}>{o.description}</Text>
                </View>
                <Text style={styles.doValue}>{money(o.billed ?? o.ordered)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Consultant Fees</Text>
        {data.consultantFees.byPerson.length === 0 ? (
          <Text style={[styles.emptyText, { marginTop: 8 }]}>No consultant fees set on the Roles page.</Text>
        ) : (
          <View style={{ gap: 6, marginTop: 10 }}>
            {data.consultantFees.byPerson.map((c) => (
              <View key={c.userId} style={styles.rowLine}>
                <Text style={styles.metaText}>{c.name}</Text>
                <Text style={styles.rowValue}>{money(c.fee)}</Text>
              </View>
            ))}
            <View style={[styles.rowLine, { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 6, marginTop: 2 }]}>
              <Text style={[styles.metaText, { fontWeight: '700', color: Brand.text }]}>Total</Text>
              <Text style={styles.rowValue}>{money(data.consultantFees.total)}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Architecture Fees</Text>
        <Text style={styles.metaText}>{data.architectureFees.setCount} drawing set(s)</Text>
        <View style={styles.statGrid}>
          <MiniStat label="Total" value={money(data.architectureFees.total)} />
          <MiniStat label="Paid" value={money(data.architectureFees.paid)} color="#5cba80" />
          <MiniStat label="Due" value={money(data.architectureFees.due)} color={data.architectureFees.due > 0 ? '#f97316' : '#5cba80'} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delay Cost Estimate</Text>
        <Text style={styles.metaText}>A risk projection — not a committed cost</Text>
        {!data.delayCost.isConfigured ? (
          <Text style={[styles.emptyText, { marginTop: 8 }]}>Not configured — set rates on the web app's Execution Intelligence tab.</Text>
        ) : (
          <View style={{ gap: 6, marginTop: 10 }}>
            <View style={styles.rowLine}><Text style={styles.metaText}>Overhead Cost</Text><Text style={styles.rowValue}>{money(data.delayCost.overheadCost)}</Text></View>
            <View style={styles.rowLine}><Text style={styles.metaText}>Penalty Cost</Text><Text style={styles.rowValue}>{money(data.delayCost.penaltyCost)}</Text></View>
            <View style={styles.rowLine}><Text style={styles.metaText}>Opportunity Cost</Text><Text style={styles.rowValue}>{money(data.delayCost.opportunityCost)}</Text></View>
            <View style={[styles.rowLine, { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 6, marginTop: 2 }]}>
              <Text style={[styles.metaText, { fontWeight: '700', color: Brand.text }]}>Total ({data.delayCost.totalOverrunDays} overrun days)</Text>
              <Text style={styles.rowValue}>{money(data.delayCost.totalEstimatedCost)}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function VendorTab({ data }: { data: VendorAnalysis }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.statGrid}>
        <StatCard label="Total Vendors" value={data.totals.totalVendors} />
        <StatCard label="High Risk" value={data.totals.highRiskCount} color={data.totals.highRiskCount > 0 ? Brand.error : '#5cba80'} />
      </View>
      <View style={{ gap: 10 }}>
        {data.vendors.map((v) => (
          <View key={v.vendorId} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.title} numberOfLines={1}>{v.vendorName}</Text>
              <Text style={[styles.riskPill, { color: RISK_COLOR[v.riskLevel], backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>{v.riskLevel}</Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>{v.milestonesVerified}/{v.milestonesTotal} verified</Text>
              <Text style={[styles.metaText, v.overrunPercent > 10 && { color: Brand.error, fontWeight: '600' }]}>
                {v.overrunPercent > 0 ? '+' : ''}{v.overrunPercent}% overrun
              </Text>
            </View>
          </View>
        ))}
      </View>
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

function MiniStat({ label, value, color = Brand.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, gap: 2 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: Brand.accent },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: Brand.btnText, fontWeight: '600' },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  scroll: { padding: 20 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  statCard: { flexBasis: '47%', flexGrow: 1, borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14, gap: 4 },
  statLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 11, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700' },
  miniStatValue: { fontSize: 13, fontWeight: '700' },
  section: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 16 },
  sectionTitle: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 12 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 12 },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: withAlpha(Brand.textRgb, 0.08), overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: Brand.accent },
  healthBar: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: withAlpha(Brand.textRgb, 0.06), marginTop: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 11 },
  riskRow: { borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.base, padding: 10, gap: 4 },
  riskTitle: { color: Brand.text, fontSize: 13, fontWeight: '600' },
  riskMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  riskGap: { color: '#eab308', fontSize: 11, fontWeight: '700' },
  scoreCard: { alignItems: 'center', borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 20, gap: 6 },
  scoreValue: { fontSize: 40, fontWeight: '800' },
  metaText: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 12 },
  card: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '600' },
  riskPill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  doRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.base, padding: 10 },
  doNumber: { color: Brand.text, fontSize: 12, fontWeight: '700' },
  doValue: { color: Brand.text, fontSize: 13, fontWeight: '700' },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowValue: { color: Brand.text, fontSize: 13, fontWeight: '600' },
});
