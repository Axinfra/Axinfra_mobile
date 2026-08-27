import { useQuery } from '@tanstack/react-query';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, Plus, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { listGroups, type Group } from '@/lib/groups';
import type { Conversation } from '@/types';

type Tab = 'direct' | 'groups';

/** Messages — 1:1 conversations (same list the web app's Messages page shows) plus a "Groups"
 * tab for device-local broadcast groups (see lib/groups.ts — there's no group-chat table on the
 * backend, so this is a named list of people you message all at once, not a shared thread). */
export default function ConversationsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('direct');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['conversations', projectId],
    queryFn: () => apiFetch<Conversation[]>(`/api/projects/${projectId}/messages/conversations`),
    enabled: !!projectId,
  });

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const loadGroups = useCallback(() => {
    if (!projectId) return;
    setGroupsLoading(true);
    listGroups(projectId).then((g) => {
      setGroups(g);
      setGroupsLoading(false);
    });
  }, [projectId]);
  // Refetch every time this screen regains focus — e.g. coming back from creating/editing/
  // deleting a group, which is a local storage change React Query knows nothing about.
  useFocusEffect(useCallback(() => { loadGroups(); }, [loadGroups]));

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader
          title="Messages"
          right={
            tab === 'groups' ? (
              <Pressable hitSlop={8} onPress={() => router.push(`/groups/${projectId}/new`)}>
                <Plus size={20} color={Brand.accent} />
              </Pressable>
            ) : undefined
          }
        />

        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'direct' && styles.tabActive]} onPress={() => setTab('direct')}>
            <Text style={[styles.tabText, tab === 'direct' && styles.tabTextActive]}>Direct</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'groups' && styles.tabActive]} onPress={() => setTab('groups')}>
            <Text style={[styles.tabText, tab === 'groups' && styles.tabTextActive]}>Groups</Text>
            {groups.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{groups.length}</Text></View>}
          </Pressable>
        </View>

        {tab === 'direct' && (
          <>
            {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />}
            {isError && <Text style={styles.error}>Couldn't load messages.</Text>}

            {data && (
              <FlatList
                data={data}
                keyExtractor={(item) => item.userId}
                refreshing={isRefetching}
                onRefresh={refetch}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Link href={`/messages/${projectId}/${item.userId}`} asChild>
                    <Pressable style={styles.row}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.rowTop}>
                          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                          {item.lastMessageAt && <Text style={styles.time}>{formatDate(item.lastMessageAt)}</Text>}
                        </View>
                        <Text style={styles.preview} numberOfLines={1}>{item.lastMessageBody ?? `Start a conversation with ${item.role.toLowerCase()}`}</Text>
                      </View>
                      {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unreadCount}</Text></View>
                      )}
                    </Pressable>
                  </Link>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
                    <MessageCircle size={24} color={withAlpha(Brand.textRgb, 0.25)} />
                    <Text style={styles.empty}>No one else on this project yet.</Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {tab === 'groups' && (
          <>
            {groupsLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 60 }} />}
            {!groupsLoading && (
              <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Link href={`/groups/${projectId}/${item.id}`} asChild>
                    <Pressable style={styles.row}>
                      <View style={[styles.avatar, styles.groupAvatar]}>
                        <Users size={16} color={Brand.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.preview}>{item.memberIds.length} member{item.memberIds.length === 1 ? '' : 's'}</Text>
                      </View>
                    </Pressable>
                  </Link>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', marginTop: 40, gap: 10 }}>
                    <Users size={24} color={withAlpha(Brand.textRgb, 0.25)} />
                    <Text style={styles.empty}>No groups yet.</Text>
                    <Pressable style={styles.newGroupBtn} onPress={() => router.push(`/groups/${projectId}/new`)}>
                      <Plus size={14} color={Brand.btnText} />
                      <Text style={styles.newGroupBtnText}>New Group</Text>
                    </Pressable>
                  </View>
                }
              />
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  tabRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 14 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: BrandRadius.btn, backgroundColor: Brand.overlayHover },
  tabActive: { backgroundColor: Brand.accent },
  tabText: { color: withAlpha(Brand.textRgb, 0.6), fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: Brand.btnText },
  tabBadge: { backgroundColor: 'rgba(10,12,16,0.55)', borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: Brand.btnText, fontSize: 10, fontWeight: '700' },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  list: { padding: 20 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface,
    padding: 14,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: withAlpha(Brand.accentRgb, 0.12), alignItems: 'center', justifyContent: 'center' },
  groupAvatar: { borderRadius: 10 },
  avatarText: { color: Brand.accent, fontSize: 12, fontWeight: '700' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, color: Brand.text, fontSize: 14, fontWeight: '600' },
  time: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11 },
  preview: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 12, marginTop: 2 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: Brand.btnText, fontSize: 11, fontWeight: '700' },
  newGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent },
  newGroupBtnText: { color: Brand.btnText, fontSize: 13, fontWeight: '700' },
});
