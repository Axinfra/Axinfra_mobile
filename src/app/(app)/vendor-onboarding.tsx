import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DrawerToggleButton } from 'expo-router/drawer';
import { AlertTriangle, Check, Clock, Mail, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch, getAuthenticatedRequestInit } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { PhaseOption, Project, VendorRow } from '@/types';

type Mode = 'EMAIL' | 'PO';

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Project Owner', PMC: 'PMC', VENDOR: 'Vendor', CONSULTANT: 'Consultant',
  VIEWER: 'Viewer', SITE_ENGINEER: 'Site Engineer',
};

/**
 * The real "Vendor Onboarding" — invite a vendor by email, same as the web app's
 * /vendor-onboarding page (src/components/vendor/VendorOnboardingClient.tsx). Not to be
 * confused with the vendor's own profile-completion form (see vendor-profile.tsx) — that's a
 * different feature the web app doesn't put in this nav slot either.
 *
 * POST /api/admin/vendors doesn't follow this app's usual { success, data } envelope — a
 * successful invite is `{ success, invited, message }` with no `data` at all, and a role
 * conflict comes back as a 409 with `{ success:false, conflict:true, userPreferredRole,
 * error }`. apiFetch's automatic unwrapping assumes a `data` field always carries the payload,
 * so this screen calls the route directly instead, the same escape hatch the document upload
 * screen uses for its own non-standard (multipart) request.
 */
export default function VendorOnboardingScreen() {
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const adminProjects = (projects ?? []).filter((p) => p.myRole === 'CLIENT' || p.myRole === 'PMC');

  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId && adminProjects.length > 0) setProjectId(adminProjects[0].id);
  }, [adminProjects, projectId]);
  const currentProject = adminProjects.find((p) => p.id === projectId);

  const { data: vendors, isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ['admin-vendors', projectId],
    queryFn: () => apiFetch<VendorRow[]>(`/api/admin/vendors?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const { data: phases } = useQuery({
    queryKey: ['phases', projectId],
    queryFn: () => apiFetch<PhaseOption[]>(`/api/projects/${projectId}/phases`),
    enabled: !!projectId,
  });
  const unassignedPhases = (phases ?? []).filter((p) => !p.vendorUserId);

  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('EMAIL');
  const [phaseId, setPhaseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ userPreferredRole: string; message: string } | null>(null);

  function resetProject(id: string) {
    setProjectId(id);
    setFormError(null);
    setFormSuccess(null);
    setConflict(null);
    setMode('EMAIL');
    setPhaseId('');
  }

  async function submitVendor(force: boolean) {
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      const { url, headers } = await getAuthenticatedRequestInit('/api/admin/vendors');
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          projectId,
          force,
          phaseId: mode === 'PO' ? phaseId || undefined : undefined,
        }),
      });
      const body = await res.json().catch(() => null);

      if (body?.success) {
        setConflict(null);
        setFormSuccess(body.invited ? (body.message ?? `Invitation sent to ${email}.`) : `Vendor "${body.data?.name}" added to the project.`);
        setEmail('');
        setPhaseId('');
        void refetchVendors();
      } else if (body?.conflict) {
        setConflict({ userPreferredRole: body.userPreferredRole, message: body.error });
      } else {
        setFormError(body?.error ?? `Failed to add vendor (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the server. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    if (mode === 'PO' && !phaseId) {
      setFormError('Pick a Purchase Order to assign, or switch to Email Invite.');
      return;
    }
    setConflict(null);
    void submitVendor(false);
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.header}>
            <DrawerToggleButton tintColor={Brand.text} />
            <Text style={styles.headerTitle}>Vendor Onboarding</Text>
            <View style={{ width: 22 }} />
          </View>

          {adminProjects.length === 0 ? (
            <Text style={styles.empty}>You need to be an Owner or PMC on a project to invite vendors.</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.intro}>Invite vendors by email. They'll receive an invitation link to join the project.</Text>

              {adminProjects.length > 1 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Project</Text>
                  <FlatList
                    horizontal
                    data={adminProjects}
                    keyExtractor={(p) => p.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => resetProject(item.id)} style={[styles.projectChip, item.id === projectId && styles.projectChipActive]}>
                        <Text style={[styles.projectChipText, item.id === projectId && styles.projectChipTextActive]} numberOfLines={1}>{item.name}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              )}

              {/* ── Invite form ── */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Mail size={14} color={Brand.accent} />
                  <Text style={styles.cardHeaderText}>Invite Vendor</Text>
                </View>

                {conflict ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.conflictBox}>
                      <AlertTriangle size={18} color="#e09840" />
                      <Text style={styles.conflictText}>{conflict.message}</Text>
                    </View>
                    <View style={styles.conflictMeta}>
                      <Text style={styles.conflictMetaText}>Email: <Text style={styles.conflictMetaValue}>{email}</Text></Text>
                      <Text style={styles.conflictMetaText}>Registered as: <Text style={styles.conflictMetaValue}>{ROLE_LABELS[conflict.userPreferredRole] ?? conflict.userPreferredRole}</Text></Text>
                      <Text style={styles.conflictMetaText}>You're assigning: <Text style={[styles.conflictMetaValue, { color: Brand.accent }]}>Vendor</Text></Text>
                    </View>
                    <Text style={styles.conflictNote}>If you confirm, this user will receive an email explaining the change and must accept before being added to the project.</Text>
                    <View style={styles.conflictButtons}>
                      <Pressable style={styles.secondaryButton} onPress={() => setConflict(null)} disabled={submitting}>
                        <Text style={styles.secondaryButtonText}>Go Back</Text>
                      </Pressable>
                      <Pressable style={styles.submit} onPress={() => submitVendor(true)} disabled={submitting}>
                        {submitting ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.submitText}>Confirm & Invite</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 14 }}>
                    {formError && (
                      <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>
                    )}
                    {formSuccess && (
                      <View style={styles.successBox}>
                        <Check size={14} color="#5cba80" />
                        <Text style={styles.successText}>{formSuccess}</Text>
                      </View>
                    )}

                    <View style={styles.field}>
                      <Text style={styles.label}>Email Address *</Text>
                      <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="vendor@company.com"
                        placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <Text style={styles.hint}>If they're not on Axinfra yet, they'll receive an invitation link.</Text>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Onboarding</Text>
                      <View style={styles.modeRow}>
                        {(['PO', 'EMAIL'] as Mode[]).map((m) => (
                          <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeChip, mode === m && styles.modeChipActive]}>
                            <Text style={[styles.modeChipText, mode === m && styles.modeChipTextActive]}>
                              {m === 'PO' ? 'Assign to Purchase Order' : 'Email Invite Only'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {mode === 'PO' && (
                        unassignedPhases.length === 0 ? (
                          <Text style={styles.hint}>No unassigned Purchase Orders in {currentProject?.name} — create one first, or use Email Invite.</Text>
                        ) : (
                          <View style={styles.phaseList}>
                            {unassignedPhases.map((p) => (
                              <Pressable key={p.id} onPress={() => setPhaseId(p.id)} style={[styles.phaseRow, phaseId === p.id && styles.phaseRowActive]}>
                                <Text style={[styles.phaseText, phaseId === p.id && styles.phaseTextActive]}>{p.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )
                      )}
                    </View>

                    <Text style={styles.assigningTo}>
                      Assigning to: <Text style={{ color: Brand.text, fontWeight: '600' }}>{currentProject?.name}</Text> as <Text style={{ color: Brand.accent, fontWeight: '600' }}>VENDOR</Text>
                    </Text>

                    <Pressable style={[styles.submit, (!email.trim() || submitting) && styles.submitDisabled]} disabled={!email.trim() || submitting} onPress={handleSubmit}>
                      {submitting ? <ActivityIndicator color={Brand.btnText} /> : (
                        <>
                          <Mail size={14} color={Brand.btnText} />
                          <Text style={styles.submitText}>Invite Vendor</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>

              {/* ── Vendor list ── */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeaderText}>Vendors in {currentProject?.name}</Text>
                  <Text style={styles.vendorCount}>{(vendors ?? []).length}</Text>
                </View>

                {vendorsLoading ? (
                  <ActivityIndicator color={Brand.accent} style={{ marginVertical: 20 }} />
                ) : !vendors || vendors.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                    <Users size={24} color={withAlpha(Brand.textRgb, 0.25)} />
                    <Text style={styles.hint}>No vendors assigned yet</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {vendors.map((v) => (
                      <View key={v.userId ?? v.inviteId} style={styles.vendorRow}>
                        <View style={styles.vendorAvatar}>
                          {v.isPendingInvite ? <Clock size={13} color={Brand.accent} /> : (
                            <Text style={styles.vendorInitials}>{v.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.vendorName, v.isPendingInvite && styles.vendorNamePending]}>{v.isPendingInvite ? 'Pending Invite' : v.name}</Text>
                          <Text style={styles.vendorEmail}>{v.email}</Text>
                        </View>
                        <Text style={v.isPendingInvite ? styles.statusPending : styles.statusText}>
                          {v.isPendingInvite ? 'Invite sent' : formatDate(v.assignedAt)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
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
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  scroll: { padding: 20, gap: 16 },
  intro: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 13, lineHeight: 18 },
  field: { gap: 6 },
  label: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11 },
  input: {
    height: 40,
    borderRadius: BrandRadius.input,
    borderWidth: 1,
    borderColor: Brand.inputBorder,
    backgroundColor: Brand.input,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Brand.text,
  },
  projectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover, maxWidth: 200 },
  projectChipActive: { backgroundColor: Brand.accent },
  projectChipText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '500' },
  projectChipTextActive: { color: Brand.btnText, fontWeight: '600' },
  card: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeaderText: { color: Brand.text, fontSize: 14, fontWeight: '700' },
  vendorCount: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 12 },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: Brand.errorBg, borderWidth: 1, borderColor: Brand.errorBorder },
  errorText: { color: Brand.error, fontSize: 13 },
  successBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(50,200,120,0.1)', borderWidth: 1, borderColor: 'rgba(92,186,128,0.3)' },
  successText: { flex: 1, color: '#5cba80', fontSize: 13 },
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  modeChip: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover, alignItems: 'center' },
  modeChipActive: { backgroundColor: withAlpha(Brand.accentRgb, 0.15) },
  modeChipText: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 11, fontWeight: '500', textAlign: 'center' },
  modeChipTextActive: { color: Brand.accent, fontWeight: '600' },
  phaseList: { gap: 6, marginTop: 4 },
  phaseRow: { padding: 10, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.base },
  phaseRowActive: { borderColor: withAlpha(Brand.accentRgb, 0.5), backgroundColor: withAlpha(Brand.accentRgb, 0.08) },
  phaseText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13 },
  phaseTextActive: { color: Brand.accent, fontWeight: '600' },
  assigningTo: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 12 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: BrandRadius.btn,
    backgroundColor: Brand.accent,
    flex: 1,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Brand.btnText, fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: withAlpha(Brand.textRgb, 0.7), fontSize: 14, fontWeight: '500' },
  conflictBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: BrandRadius.btn, backgroundColor: 'rgba(224,152,64,0.07)', borderWidth: 1, borderColor: 'rgba(224,152,64,0.22)' },
  conflictText: { flex: 1, color: withAlpha(Brand.textRgb, 0.65), fontSize: 12, lineHeight: 17 },
  conflictMeta: { padding: 12, borderRadius: BrandRadius.btn, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.overlay, gap: 4 },
  conflictMetaText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 12 },
  conflictMetaValue: { color: Brand.text, fontWeight: '600' },
  conflictNote: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11 },
  conflictButtons: { flexDirection: 'row', gap: 10 },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vendorAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(Brand.accentRgb, 0.1), alignItems: 'center', justifyContent: 'center' },
  vendorInitials: { color: '#5cba80', fontSize: 10, fontWeight: '700' },
  vendorName: { color: Brand.text, fontSize: 13, fontWeight: '600' },
  vendorNamePending: { color: withAlpha(Brand.textRgb, 0.45), fontStyle: 'italic' },
  vendorEmail: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11, marginTop: 1 },
  statusText: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11 },
  statusPending: { color: Brand.accent, fontSize: 11, fontWeight: '600' },
});
