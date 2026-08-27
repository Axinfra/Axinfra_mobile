import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { Briefcase, ClipboardList, Mail, Phone, Receipt } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Boq, Project, PurchaseOrderDetail, RaBill, RaBillsResponse, WorkOrderDetail } from '@/types';

const WO_ACCEPTANCE_LABEL: Record<string, string> = { PENDING: 'Awaiting vendor', ACCEPTED: 'Accepted', REJECTED: 'Rejected' };
const WO_ACCEPTANCE_COLOR: Record<string, string> = { PENDING: '#eab308', ACCEPTED: '#5cba80', REJECTED: Brand.error };

const BOQ_STATUS_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.4), PENDING_APPROVAL: '#eab308', REVISED: '#f97316', APPROVED: '#5cba80',
};
const RA_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', PENDING_SITE_ENGINEER_REVIEW: 'With Site Engineer', PENDING_VENDOR_REVIEW: 'Pending Certification',
  REVISION_REQUESTED: 'Needs Revision', CERTIFIED: 'Certified', APPROVED: 'Approved', PAID: 'Paid',
};
const RA_STATUS_COLOR: Record<string, string> = {
  DRAFT: withAlpha(Brand.textRgb, 0.4), PENDING_SITE_ENGINEER_REVIEW: '#a855f7', PENDING_VENDOR_REVIEW: '#eab308',
  REVISION_REQUESTED: '#f97316', CERTIFIED: '#38bdf8', APPROVED: '#5cba80', PAID: '#5cba80',
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * One Purchase Order — same 4 sections as the web app's PO detail page
 * (src/app/projects/[projectId]/orders/[orderId]/page.tsx): VendorCard, BOQList, WorkOrderCard,
 * RABillList. BOQ submit/approve/reject are real actions here, checked directly against
 * src/app/api/projects/[projectId]/boq/[boqId]/{submit,approve,reject}/route.ts — PMC submits
 * for approval, Client approves or rejects with a reason. Work Order accept/revise (its own
 * multi-step flow with PDF revisions) isn't ported — status is shown read-only.
 */
export default function OrderDetailScreen() {
  const { projectId, orderId } = useLocalSearchParams<{ projectId: string; orderId: string }>();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const myRole = projects?.find((p) => p.id === projectId)?.myRole;

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['phase-detail', projectId, orderId],
    queryFn: () => apiFetch<PurchaseOrderDetail>(`/api/projects/${projectId}/phases/${orderId}`),
    enabled: !!projectId && !!orderId,
  });

  const { data: boqData, isLoading: boqLoading } = useQuery({
    queryKey: ['boq-for-order', projectId, orderId],
    queryFn: () => apiFetch<{ boqs: Boq[] }>(`/api/projects/${projectId}/boq?orderId=${orderId}`),
    enabled: !!projectId && !!orderId,
  });

  const { data: raData } = useQuery({
    queryKey: ['ra-bills-for-order', projectId, orderId],
    queryFn: () => apiFetch<RaBillsResponse>(`/api/projects/${projectId}/ra-bills?orderId=${orderId}`),
    enabled: !!projectId && !!orderId,
  });

  const { data: workOrder } = useQuery({
    queryKey: ['work-order', projectId, orderId],
    queryFn: () => apiFetch<WorkOrderDetail | null>(`/api/projects/${projectId}/orders/${orderId}/work-order`),
    enabled: !!projectId && !!orderId,
  });
  const currentRevision = workOrder?.revisions.find((r) => r.revisionNumber === workOrder.currentRevisionNumber);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshAfterBoqAction() {
    await queryClient.invalidateQueries({ queryKey: ['boq-for-order', projectId, orderId] });
    await queryClient.invalidateQueries({ queryKey: ['phase-detail', projectId, orderId] });
    await queryClient.invalidateQueries({ queryKey: ['phases', projectId] });
  }

  async function submitBoq(boqId: string) {
    setError(null);
    setBusyId(boqId);
    try {
      await apiFetch(`/api/projects/${projectId}/boq/${boqId}/submit`, { method: 'POST' });
      await refreshAfterBoqAction();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit for approval.');
    } finally {
      setBusyId(null);
    }
  }

  async function approveBoq(boqId: string) {
    setError(null);
    setBusyId(boqId);
    try {
      await apiFetch(`/api/projects/${projectId}/boq/${boqId}/approve`, { method: 'POST' });
      await refreshAfterBoqAction();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve.');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectBoq(boqId: string) {
    if (!reason.trim()) return;
    setError(null);
    setBusyId(boqId);
    try {
      await apiFetch(`/api/projects/${projectId}/boq/${boqId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setRejectingId(null);
      setReason('');
      await refreshAfterBoqAction();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send back for revision.');
    } finally {
      setBusyId(null);
    }
  }

  const loading = orderLoading || boqLoading;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title={order?.name ?? 'Order'} />

        {loading ? (
          <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />
        ) : !order ? (
          <Text style={styles.error}>Order not found.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {order.description && <Text style={styles.description}>{order.description}</Text>}
            {(order.plannedStart || order.plannedEnd) && (
              <Text style={styles.dates}>
                {order.plannedStart ? formatDate(order.plannedStart) : '—'} → {order.plannedEnd ? formatDate(order.plannedEnd) : '—'}
              </Text>
            )}

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            {/* ── Vendor ── */}
            <Section title="Vendor" icon={Briefcase}>
              {!order.vendor ? (
                <Text style={styles.emptyText}>No vendor assigned yet.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  <Text style={styles.vendorName}>{order.vendor.companyName || order.vendor.name}</Text>
                  {order.vendor.contactPerson && <Text style={styles.metaText}>Contact: {order.vendor.contactPerson}</Text>}
                  <View style={styles.contactRow}>
                    <Mail size={12} color={Brand.accent} />
                    <Text style={styles.contactText}>{order.vendor.email}</Text>
                  </View>
                  {order.vendor.mobile && (
                    <View style={styles.contactRow}>
                      <Phone size={12} color={Brand.accent} />
                      <Text style={styles.contactText}>{order.vendor.mobile}</Text>
                    </View>
                  )}
                  {order.vendor.gstNumber && <Text style={styles.metaText}>GST: {order.vendor.gstNumber}</Text>}
                </View>
              )}
            </Section>

            {/* ── BOQ(s) ── */}
            <Section title="BOQ" icon={ClipboardList}>
              {!boqData || boqData.boqs.length === 0 ? (
                <Text style={styles.emptyText}>No BOQ created yet.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {boqData.boqs.map((boq) => {
                    const total = boq.items.reduce((s, i) => s + i.plannedValue, 0);
                    const busy = busyId === boq.id;
                    return (
                      <View key={boq.id} style={styles.boqCard}>
                        <View style={styles.boqTop}>
                          <Text style={[styles.statusPill, { color: BOQ_STATUS_COLOR[boq.status] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
                            {boq.status.replace(/_/g, ' ')}
                          </Text>
                          <Text style={styles.boqTotal}>{money(total)}</Text>
                        </View>
                        {boq.items.length === 0 ? (
                          <Text style={styles.metaText}>No items yet.</Text>
                        ) : (
                          <View style={styles.itemList}>
                            {boq.items.map((item) => (
                              <View key={item.id} style={styles.itemRow}>
                                <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
                                <View style={styles.itemMetaRow}>
                                  <Text style={styles.itemMeta}>{item.plannedQty} {item.unit} @ {money(item.rate)}</Text>
                                  <Text style={styles.itemValue}>{money(item.plannedValue)}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {(boq.status === 'DRAFT' || boq.status === 'REVISED') && myRole === 'PMC' && (
                          <ActionButton label="Submit for Approval" busy={busy} onPress={() => submitBoq(boq.id)} />
                        )}

                        {boq.status === 'PENDING_APPROVAL' && myRole === 'CLIENT' && (
                          rejectingId === boq.id ? (
                            <View style={{ gap: 8 }}>
                              <TextInput
                                style={styles.input}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="Reason for sending back (required)"
                                placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                              />
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Pressable style={styles.secondaryButton} onPress={() => { setRejectingId(null); setReason(''); }}>
                                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                                </Pressable>
                                <ActionButton label="Send Back" busy={busy} tone="warning" disabled={!reason.trim()} onPress={() => rejectBoq(boq.id)} style={{ flex: 1 }} />
                              </View>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Pressable style={styles.secondaryButton} onPress={() => setRejectingId(boq.id)}>
                                <Text style={styles.secondaryButtonText}>Send Back</Text>
                              </Pressable>
                              <ActionButton label="Approve" busy={busy} onPress={() => approveBoq(boq.id)} style={{ flex: 1 }} />
                            </View>
                          )
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Section>

            {/* ── Work Order ── */}
            {order.workOrder && (
              <Section title="Work Order" icon={ClipboardList}>
                <View style={styles.workOrderRow}>
                  <Text style={styles.vendorName}>{order.workOrder.number}</Text>
                  <Text style={styles.metaText}>Rev {order.workOrder.currentRevisionNumber}</Text>
                </View>
                <Text style={styles.metaText}>{order.workOrder.status.replace(/_/g, ' ')}</Text>

                {currentRevision && (
                  <View style={styles.woDetail}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Issued</Text>
                      <Text style={styles.infoValue}>{formatDate(currentRevision.issueDate)} by {currentRevision.createdBy.name}</Text>
                    </View>
                    {(currentRevision.plannedStart || currentRevision.plannedEnd) && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Duration</Text>
                        <Text style={styles.infoValue}>
                          {currentRevision.plannedStart ? formatDate(currentRevision.plannedStart) : '—'} → {currentRevision.plannedEnd ? formatDate(currentRevision.plannedEnd) : '—'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Vendor Acceptance</Text>
                      <Text style={[styles.statusPill, { color: WO_ACCEPTANCE_COLOR[currentRevision.vendorAcceptanceStatus] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
                        {WO_ACCEPTANCE_LABEL[currentRevision.vendorAcceptanceStatus] ?? currentRevision.vendorAcceptanceStatus}
                      </Text>
                    </View>
                    {currentRevision.vendorRemarks && <Text style={styles.metaText}>Vendor remarks: {currentRevision.vendorRemarks}</Text>}
                    {currentRevision.reason && <Text style={styles.metaText}>Revision reason: {currentRevision.reason}</Text>}
                    <Text style={styles.metaText}>File: {currentRevision.fileName}</Text>
                  </View>
                )}
              </Section>
            )}

            {/* ── RA Bills for this order ── */}
            <Section title="RA Bills" icon={Receipt}>
              {!raData || raData.raBills.length === 0 ? (
                <Text style={styles.emptyText}>No RA Bills for this order yet.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {raData.raBills.map((bill: RaBill) => (
                    <Link key={bill.id} href={`/ra-bills/${projectId}/${bill.id}`} asChild>
                      <Pressable style={styles.raCard}>
                        <View style={styles.raTop}>
                          <Text style={styles.raBillNumber}>RA-{bill.billNumber}</Text>
                          <Text style={[styles.statusPill, { color: RA_STATUS_COLOR[bill.status] ?? Brand.text, backgroundColor: withAlpha(Brand.textRgb, 0.06) }]}>
                            {RA_STATUS_LABEL[bill.status] ?? bill.status}
                          </Text>
                        </View>
                        {(bill.periodStart || bill.periodEnd) && (
                          <Text style={styles.metaText}>
                            {bill.periodStart ? formatDate(bill.periodStart) : '—'} → {bill.periodEnd ? formatDate(bill.periodEnd) : '—'}
                          </Text>
                        )}
                        <View style={styles.raValueRow}>
                          {bill.submittedValue != null && <RaValueChip label="Submitted" value={bill.submittedValue} />}
                          {bill.approvedValue != null && <RaValueChip label="Approved" value={bill.approvedValue} color="#38bdf8" />}
                          {bill.releasedValue != null && <RaValueChip label="Released" value={bill.releasedValue} color="#5cba80" />}
                        </View>
                        {bill.deductions > 0 && <Text style={styles.metaText}>Deductions: {money(bill.deductions)}</Text>}
                      </Pressable>
                    </Link>
                  ))}
                </View>
              )}
            </Section>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Briefcase; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon size={14} color={Brand.accent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function RaValueChip({ label, value, color = Brand.text }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.raChip}>
      <Text style={styles.raChipLabel}>{label}</Text>
      <Text style={[styles.raChipValue, { color }]}>{money(value)}</Text>
    </View>
  );
}

function ActionButton({ label, busy, disabled, tone = 'default', onPress, style }: { label: string; busy: boolean; disabled?: boolean; tone?: 'default' | 'warning'; onPress: () => void; style?: object }) {
  return (
    <Pressable
      style={[styles.actionButton, tone === 'warning' && styles.actionButtonWarning, (busy || disabled) && styles.actionButtonDisabled, style]}
      disabled={busy || disabled}
      onPress={onPress}>
      {busy ? <ActivityIndicator color={Brand.btnText} size="small" /> : <Text style={styles.actionButtonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  scroll: { padding: 20, gap: 16 },
  description: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 13, marginTop: -8 },
  dates: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 12, marginTop: -8 },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  section: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 16, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 12 },
  vendorName: { color: Brand.text, fontSize: 14, fontWeight: '600' },
  metaText: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { color: Brand.accent, fontSize: 12 },
  boqCard: { borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.base, padding: 12, gap: 8 },
  boqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boqTotal: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  statusPill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  input: { height: 38, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input, paddingHorizontal: 12, fontSize: 13, color: Brand.text },
  actionButton: { height: 38, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center' },
  actionButtonWarning: { backgroundColor: '#e09840' },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { color: Brand.btnText, fontSize: 13, fontWeight: '600' },
  secondaryButton: { flex: 1, height: 38, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: withAlpha(Brand.textRgb, 0.7), fontSize: 13, fontWeight: '500' },
  workOrderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  woDetail: { gap: 6, paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: Brand.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12 },
  infoValue: { color: Brand.text, fontSize: 12, fontWeight: '500' },
  itemList: { gap: 6 },
  itemRow: { gap: 2 },
  itemDescription: { color: Brand.text, fontSize: 12, fontWeight: '500' },
  itemMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemMeta: { color: withAlpha(Brand.textRgb, 0.45), fontSize: 11 },
  itemValue: { color: Brand.text, fontSize: 12, fontWeight: '600' },
  raCard: { borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.base, padding: 10, gap: 6 },
  raTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  raBillNumber: { color: Brand.text, fontSize: 13, fontWeight: '600' },
  raValueRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  raChip: { gap: 1 },
  raChipLabel: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 10 },
  raChipValue: { fontSize: 12, fontWeight: '700' },
});
