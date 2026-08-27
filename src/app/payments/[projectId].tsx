import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Download } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch, getAuthenticatedRequestInit } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { DrawingSet, Project, RaBill, RaBillsResponse } from '@/types';

const RA_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', PENDING_SITE_ENGINEER_REVIEW: 'With Site Engineer', PENDING_VENDOR_REVIEW: 'Pending Certification',
  REVISION_REQUESTED: 'Needs Revision', CERTIFIED: 'Certified', APPROVED: 'Approved', PAID: 'Paid',
};
const RA_STATUS_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.4), PENDING_SITE_ENGINEER_REVIEW: '#a855f7', PENDING_VENDOR_REVIEW: '#eab308',
  REVISION_REQUESTED: '#f97316', CERTIFIED: '#38bdf8', APPROVED: '#5cba80', PAID: '#5cba80',
};
const SET_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED_TO_PMC: 'Submitted', REQUESTED: 'Requested', IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered', APPROVED: 'Approved', PAID: 'Fully Paid',
};
const SET_STATUS_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.4), SUBMITTED_TO_PMC: '#818cf8', REQUESTED: '#818cf8', IN_PROGRESS: Brand.accent,
  DELIVERED: Brand.accent, APPROVED: '#fb923c', PAID: '#5cba80',
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function gross(bill: RaBill) {
  return bill.lineItems.reduce((sum, l) => sum + l.thisBillAmount, 0);
}
function netPayable(bill: RaBill) {
  return bill.releasedValue ?? bill.approvedValue ?? bill.submittedValue ?? gross(bill);
}
type DrawingPayStatus = 'due' | 'approaching' | 'paid' | 'none';
function getDrawingPayStatus(row: DrawingSet['rows'][number]): DrawingPayStatus {
  if (row.paidAt) return 'paid';
  if (row.status === 'APPROVED') return 'due';
  if (row.status === 'SUBMITTED') return 'approaching';
  return 'none';
}

type Tab = 'rabills' | 'consultant';

/**
 * Payments — the main app tab, now matching the web app's Payments page exactly: same two tabs
 * ("RA Bill Payments" / "Consultant Fees"), same four-card summary row above them (RA Bills Ready
 * to Pay / RA Bills Paid / Arch Fees Due / Arch Fees Paid), same per-drawing-set fee breakdown.
 * The mobile-only "Milestones" (payment-eligibility) tab that lived here before is dropped — it
 * wasn't actually part of web's Payments page (that data belongs to the Vendor's separate "My
 * Invoices" view instead), so keeping it here was a mismatch with web, not a bonus.
 */
export default function PaymentsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('rabills');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const myRole = projects?.find((p) => p.id === projectId)?.myRole;

  const { data: raData, isLoading: raLoading, isError: raError } = useQuery({
    queryKey: ['ra-bills', projectId],
    queryFn: () => apiFetch<RaBillsResponse>(`/api/projects/${projectId}/ra-bills`),
    enabled: !!projectId,
  });

  const { data: setsData, isLoading: setsLoading, isError: setsError } = useQuery({
    queryKey: ['drawing-sets', projectId],
    queryFn: () => apiFetch<DrawingSet[]>(`/api/projects/${projectId}/architecture/sets`),
    enabled: !!projectId,
  });

  const [payingBill, setPayingBill] = useState<RaBill | null>(null);

  const readyToPay = (raData?.raBills ?? []).filter((b) => b.status === 'CERTIFIED' || b.status === 'APPROVED');
  const paidBills = (raData?.raBills ?? []).filter((b) => b.status === 'PAID');
  const totalReadyToPay = readyToPay.reduce((s, b) => s + netPayable(b), 0);
  const totalPaidBills = paidBills.reduce((s, b) => s + netPayable(b), 0);

  const sets = setsData ?? [];
  const totalArchFees = sets.reduce((s, set) => s + set.cost, 0);
  const archPaidFees = sets.reduce((s, set) => {
    if (set.rowStats.total === 0) return s;
    return s + (set.cost / set.rowStats.total) * set.rowStats.paid;
  }, 0);
  const archDueFees = sets.reduce((s, set) => {
    if (set.rowStats.total === 0) return s;
    const unpaidApproved = set.rowStats.approved - set.rowStats.paid;
    return s + (set.cost / set.rowStats.total) * Math.max(0, unpaidApproved);
  }, 0);

  const canApprove = myRole === 'PMC';
  const canRelease = myRole === 'CLIENT' || myRole === 'PMC';
  const isOwner = myRole === 'CLIENT';

  async function afterPaid() {
    await queryClient.invalidateQueries({ queryKey: ['ra-bills', projectId] });
    setPayingBill(null);
  }
  async function afterRowPaid() {
    await queryClient.invalidateQueries({ queryKey: ['drawing-sets', projectId] });
  }

  const loading = tab === 'rabills' ? raLoading : setsLoading;
  const hasError = tab === 'rabills' ? raError : setsError;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Payments" />
        <Text style={styles.subtitle}>RA Bill payments and architectural drawing fees</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>RA Bills Ready to Pay</Text>
            <Text style={[styles.summaryValue, { color: '#fb923c' }]}>{money(totalReadyToPay)}</Text>
            <Text style={styles.summarySub}>{readyToPay.length} awaiting payment</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>RA Bills Paid</Text>
            <Text style={[styles.summaryValue, { color: '#5cba80' }]}>{money(totalPaidBills)}</Text>
            <Text style={styles.summarySub}>{paidBills.length} paid</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Arch Fees Due</Text>
            <Text style={[styles.summaryValue, { color: '#a78bfa' }]}>{money(archDueFees)}</Text>
            <Text style={styles.summarySub}>approved drawings unpaid</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Arch Fees Paid</Text>
            <Text style={[styles.summaryValue, { color: '#5cba80' }]}>{money(archPaidFees)}</Text>
            <Text style={styles.summarySub}>of {money(totalArchFees)} total</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'rabills' && styles.tabActive]} onPress={() => setTab('rabills')}>
            <Text style={[styles.tabText, tab === 'rabills' && styles.tabTextActive]}>RA Bill Payments</Text>
            {readyToPay.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{readyToPay.length}</Text></View>}
          </Pressable>
          <Pressable style={[styles.tab, tab === 'consultant' && styles.tabActive]} onPress={() => setTab('consultant')}>
            <Text style={[styles.tabText, tab === 'consultant' && styles.tabTextActive]}>Consultant Fees</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}
        {hasError && <Text style={styles.error}>{tab === 'rabills' ? "Couldn't load RA Bills." : "Couldn't load drawing sets."}</Text>}

        {!loading && !hasError && tab === 'rabills' && raData && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionHeading}>Ready to Pay ({readyToPay.length})</Text>
            {readyToPay.length === 0 ? (
              <Text style={styles.empty}>No RA Bills certified and ready for payment right now.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {readyToPay.map((bill) => (
                  <PayRow
                    key={bill.id}
                    bill={bill}
                    projectId={projectId!}
                    canPay={(bill.status === 'CERTIFIED' && canApprove) || (bill.status === 'APPROVED' && canRelease)}
                    onPayNow={() => setPayingBill(bill)}
                  />
                ))}
              </View>
            )}

            {paidBills.length > 0 && (
              <>
                <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Paid ({paidBills.length})</Text>
                <View style={{ gap: 10 }}>
                  {paidBills.map((bill) => (
                    <PayRow key={bill.id} bill={bill} projectId={projectId!} canPay={false} onPayNow={() => {}} />
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {!loading && !hasError && tab === 'consultant' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {sets.length === 0 ? (
              <Text style={styles.empty}>No drawing sets yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {sets.map((set) => (
                  <DrawingSetCard key={set.id} projectId={projectId!} set={set} isOwner={isOwner} onRowPaid={afterRowPaid} />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {payingBill && (
          <PayNowModal projectId={projectId!} bill={payingBill} onClose={() => setPayingBill(null)} onPaid={afterPaid} />
        )}
      </SafeAreaView>
    </View>
  );
}

/** Row inside the RA Bill Payments tab — mirrors the web app's RABillPayRow: dates, status, net
 * payable, a Download button (real PDF via the same route the web app links to), and a Pay Now
 * button when the viewer's role can act on this bill's current state. */
function PayRow({ bill, projectId, canPay, onPayNow }: { bill: RaBill; projectId: string; canPay: boolean; onPayNow: () => void }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const { url, headers } = await getAuthenticatedRequestInit(`/api/projects/${projectId}/orders/${bill.order.id}/ra-bills/${bill.id}/pdf`);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Download failed (HTTP ${res.status})`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const file = new File(Paths.cache, `ra-bill-${bill.billNumber}.pdf`);
      file.create({ overwrite: true });
      file.write(bytes);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
      else Alert.alert('Downloaded', `Saved to ${file.uri}`);
    } catch (err) {
      Alert.alert('Could not download', err instanceof Error ? err.message : 'Check your connection and try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View style={styles.payRow}>
      <View style={styles.payRowTop}>
        <Text style={styles.title}>RA-{bill.billNumber}</Text>
        <Text style={styles.payOrderName} numberOfLines={1}>{bill.order.name}</Text>
        <Text style={[styles.statePill, { color: RA_STATUS_COLOR[bill.status] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
          {RA_STATUS_LABEL[bill.status] ?? bill.status}
        </Text>
      </View>
      <View style={styles.payRowMeta}>
        {bill.periodStart && bill.periodEnd && (
          <Text style={styles.footerText}>{formatDate(bill.periodStart)} – {formatDate(bill.periodEnd)}</Text>
        )}
        {bill.certifiedAt && <Text style={styles.footerText}>Certified {formatDate(bill.certifiedAt)}</Text>}
        <Text style={styles.value}>{money(netPayable(bill))}</Text>
      </View>
      <View style={styles.payRowActions}>
        <Pressable style={styles.downloadBtn} disabled={downloading} onPress={download}>
          {downloading ? <ActivityIndicator size="small" color={Brand.text} /> : <Download size={13} color={withAlpha(Brand.textRgb, 0.6)} />}
          <Text style={styles.downloadBtnText}>Download</Text>
        </Pressable>
        {canPay ? (
          <Pressable style={styles.payNowBtn} onPress={onPayNow}>
            <Text style={styles.payNowBtnText}>Pay Now</Text>
          </Pressable>
        ) : bill.status === 'CERTIFIED' ? (
          <Text style={styles.waitingText}>Awaiting PMC Approval</Text>
        ) : bill.status === 'APPROVED' ? (
          <Text style={styles.waitingText}>Approved — Awaiting Release</Text>
        ) : bill.status === 'PAID' ? (
          <Text style={styles.paidText}>Paid{bill.paymentReference ? ` · ${bill.paymentReference}` : ''}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** One drawing set's fee card in the Consultant Fees tab — mirrors the web app's collapsible set
 * row exactly: status + "N due" badge, total fee, paid-so-far/due amounts, a 3-segment progress
 * bar (paid green / due orange / submitted-approaching gold), and — tap to expand — the individual
 * drawings with a per-row pay status and a Release button for the Owner on anything due. */
function DrawingSetCard({ projectId, set, isOwner, onRowPaid }: { projectId: string; set: DrawingSet; isOwner: boolean; onRowPaid: () => void }) {
  const [open, setOpen] = useState(false);

  const perDrawing = set.rowStats.total > 0 ? set.cost / set.rowStats.total : 0;
  const paidAmount = perDrawing * set.rowStats.paid;
  const dueAmount = perDrawing * Math.max(0, set.rowStats.approved - set.rowStats.paid);
  const hasDue = set.rowStats.approved > set.rowStats.paid;
  const approachingCount = set.rowStats.submitted;

  return (
    <View style={styles.setCard}>
      <Pressable style={styles.setHeader} onPress={() => setOpen((o) => !o)}>
        <View style={styles.setHeaderTop}>
          <View style={styles.setHeaderLeft}>
            {open ? <ChevronDown size={16} color={withAlpha(Brand.textRgb, 0.4)} /> : <ChevronRight size={16} color={withAlpha(Brand.textRgb, 0.4)} />}
            <View style={{ flex: 1 }}>
              <View style={styles.setTitleRow}>
                <Text style={styles.title} numberOfLines={1}>{set.name}</Text>
                <Text style={[styles.statePill, { color: SET_STATUS_COLOR[set.status] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
                  {SET_STATUS_LABEL[set.status] ?? set.status}
                </Text>
                {hasDue && (
                  <Text style={[styles.statePill, { color: '#fb923c', backgroundColor: 'rgba(251,146,60,0.12)' }]}>
                    {set.rowStats.approved - set.rowStats.paid} due
                  </Text>
                )}
              </View>
              <Text style={styles.footerText}>
                Total fee: <Text style={{ color: Brand.text, fontWeight: '600' }}>{money(set.cost)}</Text> · {set.rowStats.total} drawings · {set.rowStats.approved} approved · {set.rowStats.paid} paid
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerText}>Paid so far</Text>
            <Text style={[styles.value, { color: '#5cba80' }]}>{money(paidAmount)}</Text>
            {dueAmount > 0 && <Text style={[styles.footerText, { color: '#fb923c', fontWeight: '600' }]}>{money(dueAmount)} due</Text>}
          </View>
        </View>

        {set.rowStats.total > 0 && (
          <View style={{ marginTop: 10 }}>
            <View style={styles.progressBar}>
              {set.rowStats.paid > 0 && <View style={{ flex: set.rowStats.paid, backgroundColor: '#5cba80' }} />}
              {Math.max(0, set.rowStats.approved - set.rowStats.paid) > 0 && <View style={{ flex: Math.max(0, set.rowStats.approved - set.rowStats.paid), backgroundColor: '#fb923c' }} />}
              {approachingCount > 0 && <View style={{ flex: approachingCount, backgroundColor: Brand.accent }} />}
              {set.rowStats.total - set.rowStats.paid - Math.max(0, set.rowStats.approved - set.rowStats.paid) - approachingCount > 0 && (
                <View style={{ flex: set.rowStats.total - set.rowStats.paid - Math.max(0, set.rowStats.approved - set.rowStats.paid) - approachingCount, backgroundColor: withAlpha(Brand.textRgb, 0.08) }} />
              )}
            </View>
          </View>
        )}
      </Pressable>

      {open && (
        <View style={styles.rowsList}>
          {set.rows.length === 0 ? (
            <Text style={[styles.empty, { marginTop: 0 }]}>No drawings added to this set yet.</Text>
          ) : (
            set.rows.map((row) => (
              <DrawingRowLine key={row.id} row={row} fee={perDrawing} projectId={projectId} isOwner={isOwner} onPaid={onRowPaid} />
            ))
          )}
          <View style={styles.setFooter}>
            <Text style={styles.footerText}>
              Set total · {money(set.cost)} · {set.rowStats.paid}/{set.rowStats.total} drawings paid
            </Text>
            {dueAmount === 0 && paidAmount === set.cost && set.rowStats.total > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={13} color="#5cba80" />
                <Text style={{ color: '#5cba80', fontSize: 12, fontWeight: '700' }}>Fully Paid</Text>
              </View>
            ) : dueAmount > 0 ? (
              <Text style={{ color: '#fb923c', fontSize: 12, fontWeight: '600' }}>Due: {money(dueAmount)}</Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

/** Releases payment for a single approved drawing — CLIENT (Owner) only, matching the web app's
 * per-row "Release" button exactly (POST .../architecture/rows/[rowId]/payment, no body). */
function DrawingRowLine({ row, fee, projectId, isOwner, onPaid }: { row: DrawingSet['rows'][number]; fee: number; projectId: string; isOwner: boolean; onPaid: () => void }) {
  const [releasing, setReleasing] = useState(false);
  const payStatus = getDrawingPayStatus(row);
  const canPay = isOwner && payStatus === 'due';

  async function release() {
    setReleasing(true);
    try {
      await apiFetch(`/api/projects/${projectId}/architecture/rows/${row.id}/payment`, { method: 'POST' });
      onPaid();
    } catch (err) {
      Alert.alert('Could not release payment', err instanceof ApiError ? err.message : 'Check your connection and try again.');
    } finally {
      setReleasing(false);
    }
  }

  return (
    <View style={styles.drawingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.drawingName} numberOfLines={1}>#{row.serialNo} · {row.name}</Text>
        <Text style={styles.footerText}>
          {row.category} · {row.floor.replace(/_/g, ' ')}
          {row.paidAt ? ` · Paid ${formatDate(row.paidAt)}` : row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ''}
        </Text>
      </View>
      <Text style={styles.drawingFee}>{money(fee)}</Text>
      {payStatus === 'paid' && (
        <View style={styles.payBadge}><CheckCircle2 size={11} color="#5cba80" /><Text style={[styles.payBadgeText, { color: '#5cba80' }]}>Paid</Text></View>
      )}
      {payStatus === 'due' && (
        <View style={[styles.payBadge, { backgroundColor: 'rgba(251,146,60,0.15)' }]}><View style={styles.duedot} /><Text style={[styles.payBadgeText, { color: '#fb923c' }]}>Due</Text></View>
      )}
      {payStatus === 'approaching' && (
        <View style={styles.payBadge}><Clock size={11} color={Brand.accent} /><Text style={[styles.payBadgeText, { color: Brand.accent }]}>Approaching</Text></View>
      )}
      {canPay && (
        <Pressable style={styles.releaseBtn} disabled={releasing} onPress={release}>
          {releasing ? <ActivityIndicator size="small" color="#a78bfa" /> : <Text style={styles.releaseBtnText}>Release</Text>}
        </Pressable>
      )}
    </View>
  );
}

/** One-click "Pay Now" — collapses whatever step(s) remain (Approve, then Release Payment) into
 * a single action, mirroring the web app's PayRABillModal exactly: PMC sees this on a CERTIFIED
 * bill and gets both steps in one tap; Client only ever sees it on an already-APPROVED bill, a
 * pure release with no amount/deduction decision left to make. */
function PayNowModal({ projectId, bill, onClose, onPaid }: { projectId: string; bill: RaBill; onClose: () => void; onPaid: () => void }) {
  const g = gross(bill);
  const [deductions, setDeductions] = useState(String(bill.deductions ?? 0));
  const [paymentReference, setPaymentReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const deductionsNum = parseFloat(deductions) || 0;
  const netAmount = bill.status === 'CERTIFIED' ? g - deductionsNum : (bill.approvedValue ?? g);

  async function handlePay() {
    setProcessing(true);
    setError('');
    try {
      const orderId = bill.order.id;
      if (bill.status === 'CERTIFIED') {
        await apiFetch(`/api/projects/${projectId}/orders/${orderId}/ra-bills/${bill.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ deductions: deductionsNum }),
        });
      }
      await apiFetch(`/api/projects/${projectId}/orders/${orderId}/ra-bills/${bill.id}/release-payment`, {
        method: 'POST',
        body: JSON.stringify({ releasedValue: netAmount, paymentReference: paymentReference.trim() || undefined }),
      });
      onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to process payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>Pay RA-{bill.billNumber}</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>{bill.order.name}</Text>
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.breakdownBox}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Certified Value</Text>
            <Text style={styles.breakdownValue}>{money(g)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Deductions</Text>
            {bill.status === 'CERTIFIED' ? (
              <TextInput style={styles.deductInput} value={deductions} onChangeText={setDeductions} keyboardType="numeric" />
            ) : (
              <Text style={styles.breakdownValue}>{money(bill.deductions ?? 0)}</Text>
            )}
          </View>
          <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
            <Text style={styles.breakdownTotalLabel}>Net Payable</Text>
            <Text style={styles.breakdownTotalValue}>{money(netAmount)}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Payment Reference (optional)</Text>
          <TextInput
            style={styles.input}
            value={paymentReference}
            onChangeText={setPaymentReference}
            placeholder="UTR / cheque number"
            placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
          />
        </View>

        <View style={styles.modalActions}>
          <Pressable style={styles.cancelBtn} onPress={onClose} disabled={processing}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.payBtn, processing && styles.payBtnDisabled]} onPress={handlePay} disabled={processing}>
            {processing ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.payBtnText}>Pay {money(netAmount)}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  subtitle: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 12, marginHorizontal: 20, marginTop: 2 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginTop: 14 },
  summaryCard: { flexBasis: '47%', flexGrow: 1, borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 12, gap: 3 },
  summaryLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 9.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryValue: { fontSize: 17, fontWeight: '800' },
  summarySub: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 10 },
  tabRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: Brand.accent },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: Brand.btnText },
  tabBadge: { backgroundColor: 'rgba(10,12,16,0.55)', borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: Brand.btnText, fontSize: 10, fontWeight: '700' },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  scroll: { padding: 20 },
  sectionHeading: { color: Brand.text, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  title: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  statePill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  footerText: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 11.5 },
  value: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  payRow: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 14, gap: 10 },
  payRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  payOrderName: { flex: 1, color: withAlpha(Brand.textRgb, 0.5), fontSize: 12 },
  payRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  payRowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border },
  downloadBtnText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 11, fontWeight: '600' },
  payNowBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: 'rgba(92,186,128,0.35)', backgroundColor: 'rgba(92,186,128,0.1)' },
  payNowBtnText: { color: '#5cba80', fontSize: 12, fontWeight: '700' },
  waitingText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11 },
  paidText: { color: '#5cba80', fontSize: 11, fontWeight: '600' },
  // Consultant Fees / drawing sets
  setCard: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, overflow: 'hidden' },
  setHeader: { padding: 14 },
  setHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  setHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  setTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  progressBar: { flexDirection: 'row', height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: withAlpha(Brand.textRgb, 0.06), gap: 1 },
  rowsList: { borderTopWidth: 1, borderTopColor: Brand.border, padding: 14, gap: 10 },
  drawingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.base, padding: 10 },
  drawingName: { color: Brand.text, fontSize: 12.5, fontWeight: '600' },
  drawingFee: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 11.5, fontWeight: '600' },
  payBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: withAlpha(Brand.textRgb, 0.06), paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  payBadgeText: { fontSize: 10, fontWeight: '700' },
  duedot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fb923c' },
  releaseBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)', backgroundColor: 'rgba(167,139,250,0.1)' },
  releaseBtnText: { color: '#a78bfa', fontSize: 10.5, fontWeight: '700' },
  setFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10 },
  // Pay Now modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 20, gap: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalTitle: { color: Brand.text, fontSize: 16, fontWeight: '700' },
  modalSubtitle: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12, marginTop: 2 },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  breakdownBox: { borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover, padding: 12, gap: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 13 },
  breakdownValue: { color: Brand.text, fontSize: 13, fontWeight: '600' },
  deductInput: { width: 110, height: 34, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input, paddingHorizontal: 10, fontSize: 13, color: Brand.text, textAlign: 'right' },
  breakdownTotalRow: { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 8 },
  breakdownTotalLabel: { color: Brand.text, fontSize: 13, fontWeight: '700' },
  breakdownTotalValue: { color: '#5cba80', fontSize: 15, fontWeight: '800' },
  fieldLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 11, fontWeight: '600', marginBottom: 6 },
  input: { height: 40, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input, paddingHorizontal: 12, fontSize: 14, color: Brand.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, height: 40, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '600' },
  payBtn: { paddingHorizontal: 18, height: 40, borderRadius: BrandRadius.btn, backgroundColor: '#5cba80', alignItems: 'center', justifyContent: 'center' },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#0a0c10', fontSize: 13, fontWeight: '700' },
});
