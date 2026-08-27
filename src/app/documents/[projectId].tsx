import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { CheckSquare, ClipboardList, FileText, Plus, Search, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ChecklistSummary, DprSummary, Project, ProjectDocument, SearchResult } from '@/types';

type DocTab = 'SPEC' | 'OTHER' | 'CHECKLISTS' | 'DPR';
const TAB_LABEL: Record<DocTab, string> = { SPEC: 'Specs', OTHER: 'Other Docs', CHECKLISTS: 'Checklists', DPR: 'DPR' };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Same 4 tabs as the web app's Documents page (src/app/projects/[projectId]/documents/
 * page.tsx) — Specs / Other Docs / Checklists / DPR, with Checklists and DPR hidden for
 * Vendor, matching that page's own `tabs` array exactly. A search bar at the top hits the
 * same cross-entity search endpoint the web page's search box uses.
 */
export default function DocumentsDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });
  const myRole = projects?.find((p) => p.id === projectId)?.myRole;
  const canUpload = myRole === 'PMC' || myRole === 'CONSULTANT';
  const canCreateChecklist = myRole === 'PMC';
  const canCreateDpr = myRole === 'SITE_ENGINEER';

  const tabs: DocTab[] = myRole === 'VENDOR' ? ['SPEC', 'OTHER'] : ['SPEC', 'OTHER', 'CHECKLISTS', 'DPR'];
  const [activeTab, setActiveTab] = useState<DocTab>('SPEC');
  const [query, setQuery] = useState('');

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['documents-search', projectId, query],
    queryFn: () => apiFetch<SearchResult[]>(`/api/projects/${projectId}/documents/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => apiFetch<ProjectDocument[]>(`/api/projects/${projectId}/documents`),
    enabled: (activeTab === 'SPEC' || activeTab === 'OTHER') && query.trim().length === 0,
  });
  const filteredDocs = useMemo(
    () => (docs ?? []).filter((d) => d.category === activeTab),
    [docs, activeTab],
  );

  const { data: checklists, isLoading: checklistsLoading } = useQuery({
    queryKey: ['checklists', projectId],
    queryFn: () => apiFetch<ChecklistSummary[]>(`/api/projects/${projectId}/checklists`),
    enabled: activeTab === 'CHECKLISTS' && query.trim().length === 0,
  });

  const { data: dprs, isLoading: dprsLoading } = useQuery({
    queryKey: ['dprs', projectId],
    queryFn: () => apiFetch<DprSummary[]>(`/api/projects/${projectId}/dpr`),
    enabled: activeTab === 'DPR' && query.trim().length === 0,
  });

  const headerAction =
    query.trim().length > 0 ? undefined :
    (activeTab === 'SPEC' || activeTab === 'OTHER') && canUpload ? (
      <Link href={`/documents/${projectId}/upload`} asChild>
        <Pressable hitSlop={8}><Upload size={20} color={Brand.accent} /></Pressable>
      </Link>
    ) : activeTab === 'CHECKLISTS' && canCreateChecklist ? (
      <Link href={`/documents/${projectId}/new-checklist`} asChild>
        <Pressable hitSlop={8}><Plus size={22} color={Brand.accent} /></Pressable>
      </Link>
    ) : activeTab === 'DPR' && canCreateDpr ? (
      <Link href={`/documents/${projectId}/new-dpr`} asChild>
        <Pressable hitSlop={8}><Plus size={22} color={Brand.accent} /></Pressable>
      </Link>
    ) : undefined;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title="Documents" right={headerAction} />

        <View style={styles.searchRow}>
          <Search size={15} color={withAlpha(Brand.textRgb, 0.4)} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search drawings, docs, checklists, DPR…"
            placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
          />
        </View>

        {query.trim().length > 0 ? (
          searchLoading ? (
            <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={searchResults ?? []}
              keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => <SearchResultRow result={item} />}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListEmptyComponent={<Text style={styles.empty}>No matches for "{query}".</Text>}
            />
          )
        ) : (
          <>
            <View style={styles.tabRow}>
              {tabs.map((t) => (
                <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tab, activeTab === t && styles.tabActive]}>
                  <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{TAB_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>

            {(activeTab === 'SPEC' || activeTab === 'OTHER') && (
              docsLoading ? <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} /> : (
                <FlatList
                  data={filteredDocs}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  renderItem={({ item }) => <DocumentRow doc={item} />}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  ListEmptyComponent={<Text style={styles.empty}>No {TAB_LABEL[activeTab].toLowerCase()} uploaded yet.</Text>}
                />
              )
            )}

            {activeTab === 'CHECKLISTS' && (
              checklistsLoading ? <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} /> : (
                <FlatList
                  data={checklists ?? []}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  renderItem={({ item }) => <ChecklistRow checklist={item} />}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  ListEmptyComponent={<Text style={styles.empty}>No checklists yet.</Text>}
                />
              )
            )}

            {activeTab === 'DPR' && (
              dprsLoading ? <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} /> : (
                <FlatList
                  data={dprs ?? []}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  renderItem={({ item }) => <DprRow dpr={item} />}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  ListEmptyComponent={<Text style={styles.empty}>No Daily Progress Reports yet.</Text>}
                />
              )
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const SEARCH_TYPE_LABEL: Record<SearchResult['type'], string> = {
  DRAWING: 'Drawing', SPEC: 'Spec', OTHER: 'Document', CHECKLIST: 'Checklist', DPR: 'DPR', MEASUREMENT_SHEET: 'Measurement Sheet',
};

function SearchResultRow({ result }: { result: SearchResult }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={1}>{result.title}</Text>
        <Text style={styles.category}>{SEARCH_TYPE_LABEL[result.type]}</Text>
      </View>
      {result.subtitle && <Text style={styles.description} numberOfLines={2}>{result.subtitle}</Text>}
    </View>
  );
}

function DocumentRow({ doc }: { doc: ProjectDocument }) {
  const totalSize = doc.files.reduce((s, f) => s + f.size, 0);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <FileText size={16} color={Brand.accent} />
        <Text style={styles.title} numberOfLines={1}>{doc.title}</Text>
      </View>
      {doc.description && <Text style={styles.description} numberOfLines={2}>{doc.description}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>{doc.uploadedByName} · {formatDate(doc.createdAt)}</Text>
        <Text style={styles.footerText}>{doc.files.length} file{doc.files.length === 1 ? '' : 's'} · {formatBytes(totalSize)}</Text>
      </View>
    </View>
  );
}

function ChecklistRow({ checklist }: { checklist: ChecklistSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <CheckSquare size={16} color={Brand.accent} />
        <Text style={styles.title} numberOfLines={1}>{checklist.docRefNo} · {checklist.title}</Text>
        <Text style={styles.category}>{checklist.status.replace(/_/g, ' ')}</Text>
      </View>
      <Text style={styles.description}>Drawing {checklist.referenceDrawingNo}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>{checklist.filledCount}/{checklist.itemCount} items filled</Text>
        <Text style={styles.footerText}>{formatDate(checklist.createdAt)}</Text>
      </View>
    </View>
  );
}

function DprRow({ dpr }: { dpr: DprSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <ClipboardList size={16} color={Brand.accent} />
        <Text style={styles.title} numberOfLines={1}>{dpr.docRefNo} · {dpr.reportDate}</Text>
        <Text style={styles.category}>{dpr.status.replace(/_/g, ' ')}</Text>
      </View>
      <Text style={styles.footerText}>By {dpr.createdByName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    height: 38,
    borderRadius: BrandRadius.input,
    borderWidth: 1,
    borderColor: Brand.inputBorder,
    backgroundColor: Brand.input,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: Brand.text, fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: Brand.accent },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: Brand.btnText, fontWeight: '600' },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  list: { padding: 20, paddingTop: 12 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  card: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '600' },
  category: {
    fontSize: 10,
    fontWeight: '600',
    color: withAlpha(Brand.textRgb, 0.5),
    backgroundColor: Brand.overlayHover,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  description: { color: withAlpha(Brand.textRgb, 0.55), fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  footerText: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11 },
});
