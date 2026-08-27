import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Project, RaBillsResponse } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', PENDING_SITE_ENGINEER_REVIEW: 'With Site Engineer', PENDING_VENDOR_REVIEW: 'Pending Certification',
  REVISION_REQUESTED: 'Needs Revision', CERTIFIED: 'Certified', APPROVED: 'Approved', PAID: 'Paid',
};

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * The actual state machine, mirrored from the web app's RA Bill detail page — same
 * transitions, same role gates, same required fields, checked directly against
 * src/services/RABillService.ts rather than guessed:
 *   DRAFT --(Vendor submit)--> PENDING_SITE_ENGINEER_REVIEW
 *   --(Site Engineer forward)--> PENDING_VENDOR_REVIEW
 *   --(PMC/Consultant certify)--> CERTIFIED --(PMC approve)--> APPROVED
 *   --(Client/PMC release payment)--> PAID
 * PMC/Consultant can also send PENDING_VENDOR_REVIEW back to REVISION_REQUESTED.
 * Not ported: Site Engineer's line-item quantity editing and measurement-sheet upload,
 * certify's optional file attachment, Vendor's read-only "accept" acknowledgement — all real
 * sub-features on their own, secondary to actually moving the bill through its states.
 */
export default function RaBillDetailScreen() {
  const { projectId, raBillId } = useLocalSearchParams<{ projectId: string; raBillId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const myRole = projects?.find((p) => p.id === projectId)?.myRole;

  const { data, isLoading } = useQuery({
    queryKey: ['ra-bills', projectId],
    queryFn: () => apiFetch<RaBillsResponse>(`/api/projects/${projectId}/ra-bills`),
    enabled: !!projectId,
  });
  const bill = data?.raBills.find((b) => b.id === raBillId);

  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [deductions, setDeductions] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function runAction(path: string, body: Record<string, unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/orders/${bill!.order.id}/ra-bills/${raBillId}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await queryClient.invalidateQueries({ queryKey: ['ra-bills', projectId] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the bill. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title={bill ? `RA-${bill.billNumber}` : 'RA Bill'} />

        {isLoading || !user ? (
          <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />
        ) : !bill ? (
          <Text style={styles.error}>Bill not found.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.headerCard}>
              <Text style={styles.orderName}>{bill.order.name}</Text>
              <Text style={styles.statusValue}>{STATUS_LABEL[bill.status] ?? bill.status}</Text>
            </View>

            <View style={styles.valueGrid}>
              <ValueStat label="Submitted" value={bill.submittedValue} />
              <ValueStat label="Approved" value={bill.approvedValue} color="#38bdf8" />
              <ValueStat label="Released" value={bill.releasedValue} color="#5cba80" />
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            {/* Vendor: submit a Draft bill */}
            {myRole === 'VENDOR' && bill.status === 'DRAFT' && (
              <ActionCard title="Submit for Review" description="Sends this bill to the Site Engineer.">
                <ActionButton label="Submit" submitting={submitting} onPress={() => runAction('submit', {})} />
              </ActionCard>
            )}

            {/* Site Engineer: forward a reviewed bill to PMC */}
            {myRole === 'SITE_ENGINEER' && bill.status === 'PENDING_SITE_ENGINEER_REVIEW' && (
              <ActionCard title="Forward to PMC" description="Sends your reviewed figures onward for certification.">
                <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder="Remarks (optional)" placeholderTextColor={withAlpha(Brand.textRgb, 0.35)} />
                <ActionButton label="Forward" submitting={submitting} onPress={() => runAction('forward-to-pmc', { remarks: remarks.trim() || undefined })} />
              </ActionCard>
            )}

            {/* PMC/Consultant: certify or send back for revision */}
            {(myRole === 'PMC' || myRole === 'CONSULTANT') && bill.status === 'PENDING_VENDOR_REVIEW' && (
              <>
                <ActionCard title="Certify" description="Confirms the claimed quantities as measured/executed.">
                  <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder="Remarks (optional)" placeholderTextColor={withAlpha(Brand.textRgb, 0.35)} />
                  <ActionButton label="Certify" submitting={submitting} onPress={() => runAction('certify', { remarks: remarks.trim() || undefined })} />
                </ActionCard>
                <ActionCard title="Request Revision" description="Sends the bill back to the vendor for correction." tone="warning">
                  <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Reason (required)" placeholderTextColor={withAlpha(Brand.textRgb, 0.35)} />
                  <ActionButton label="Request Revision" submitting={submitting} disabled={!reason.trim()} tone="warning" onPress={() => runAction('revision-request', { reason: reason.trim() })} />
                </ActionCard>
              </>
            )}

            {/* PMC: approve a certified bill */}
            {myRole === 'PMC' && bill.status === 'CERTIFIED' && (
              <ActionCard title="Approve" description="Approves this bill for payment.">
                <TextInput style={styles.input} value={deductions} onChangeText={setDeductions} placeholder="Deductions (optional)" placeholderTextColor={withAlpha(Brand.textRgb, 0.35)} keyboardType="numeric" />
                <ActionButton label="Approve" submitting={submitting} onPress={() => runAction('approve', { deductions: deductions ? Number(deductions) : undefined })} />
              </ActionCard>
            )}

            {/* Client/PMC: release payment on an approved bill */}
            {(myRole === 'CLIENT' || myRole === 'PMC') && bill.status === 'APPROVED' && (
              <ActionCard title="Release Payment" description="Records that payment has been released for this bill.">
                <TextInput style={styles.input} value={paymentReference} onChangeText={setPaymentReference} placeholder="Payment reference (optional)" placeholderTextColor={withAlpha(Brand.textRgb, 0.35)} />
                <ActionButton label="Release Payment" submitting={submitting} onPress={() => runAction('release-payment', { paymentReference: paymentReference.trim() || undefined })} />
              </ActionCard>
            )}

            {bill.status === 'PAID' && <Text style={styles.doneText}>This bill has been paid — nothing more to do.</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function ValueStat({ label, value, color = Brand.text }: { label: string; value: number | null; color?: string }) {
  return (
    <View style={styles.valueStat}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={[styles.valueAmount, { color }]}>{value != null ? money(value) : '—'}</Text>
    </View>
  );
}

function ActionCard({ title, description, tone = 'default', children }: { title: string; description: string; tone?: 'default' | 'warning'; children: React.ReactNode }) {
  return (
    <View style={[styles.actionCard, tone === 'warning' && styles.actionCardWarning]}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
      <View style={{ gap: 10, marginTop: 4 }}>{children}</View>
    </View>
  );
}

function ActionButton({ label, submitting, disabled, tone = 'default', onPress }: { label: string; submitting: boolean; disabled?: boolean; tone?: 'default' | 'warning'; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.actionButton, tone === 'warning' && styles.actionButtonWarning, (submitting || disabled) && styles.actionButtonDisabled]}
      disabled={submitting || disabled}
      onPress={onPress}>
      {submitting ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.actionButtonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  scroll: { padding: 20, gap: 16 },
  headerCard: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 16, gap: 4 },
  orderName: { color: Brand.text, fontSize: 15, fontWeight: '600' },
  statusValue: { color: Brand.accent, fontSize: 13, fontWeight: '600' },
  valueGrid: { flexDirection: 'row', gap: 10 },
  valueStat: { flex: 1, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 12, gap: 4 },
  valueLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 10, fontWeight: '600' },
  valueAmount: { fontSize: 13, fontWeight: '700' },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  actionCard: { borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 16, gap: 4 },
  actionCardWarning: { borderColor: 'rgba(224,152,64,0.3)', backgroundColor: 'rgba(224,152,64,0.06)' },
  actionTitle: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  actionDescription: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12 },
  input: { height: 40, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input, paddingHorizontal: 12, fontSize: 14, color: Brand.text },
  actionButton: { height: 42, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center' },
  actionButtonWarning: { backgroundColor: '#e09840' },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
  doneText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 20 },
});
