import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Pencil, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deleteGroup, getGroup, type Group } from '@/lib/groups';
import type { ChatMessage, Conversation } from '@/types';

/**
 * Group thread — merges each member's 1:1 conversation with you into one chronological view and
 * fans a sent message out to all of them as individual DMs (see lib/groups.ts for why: there's
 * no group-chat table on the backend). The banner below isn't boilerplate — it's the one thing
 * this screen absolutely cannot let the UI imply on its own: nobody in the group sees anyone
 * else's reply to you, because there is no shared thread, only your own parallel 1:1s with each
 * of them merged for your view.
 */
export default function GroupThreadScreen() {
  const { projectId, groupId } = useLocalSearchParams<{ projectId: string; groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<MergedMessage>>(null);

  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  useEffect(() => {
    getGroup(projectId!, groupId!).then(setGroup);
  }, [projectId, groupId]);

  const { data: conversations } = useQuery({
    queryKey: ['conversations', projectId],
    queryFn: () => apiFetch<Conversation[]>(`/api/projects/${projectId}/messages/conversations`),
    enabled: !!projectId,
  });
  const members = (group?.memberIds ?? [])
    .map((id) => conversations?.find((c) => c.userId === id))
    .filter((c): c is Conversation => !!c);

  const threadQueries = useQueries({
    queries: (group?.memberIds ?? []).map((memberId) => ({
      queryKey: ['thread', projectId, memberId],
      queryFn: () => apiFetch<ChatMessage[]>(`/api/projects/${projectId}/messages/${memberId}`),
      enabled: !!projectId && !!group,
      refetchInterval: 8000,
    })),
  });
  const threadsLoading = group === undefined || (group !== null && threadQueries.some((q) => q.isLoading));
  const merged: MergedMessage[] = threadQueries
    .flatMap((q) => q.data ?? [])
    .map((m) => ({ ...m, senderName: m.senderId === user?.id ? 'You' : members.find((mm) => mm.userId === m.senderId)?.name ?? 'Unknown' }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = draft.trim();
    if (!body || sending || !group) return;
    setError(null);
    setSending(true);
    try {
      const results = await Promise.allSettled(
        group.memberIds.map((memberId) =>
          apiFetch(`/api/projects/${projectId}/messages/${memberId}`, { method: 'POST', body: JSON.stringify({ body }) }),
        ),
      );
      const failedNames = results
        .map((r, i) => (r.status === 'rejected' ? members[i]?.name ?? 'someone' : null))
        .filter((n): n is string => !!n);
      setDraft('');
      await Promise.all(group.memberIds.map((id) => queryClient.invalidateQueries({ queryKey: ['thread', projectId, id] })));
      await queryClient.invalidateQueries({ queryKey: ['conversations', projectId] });
      if (failedNames.length > 0) {
        setError(`Didn't reach: ${failedNames.join(', ')}. The rest received it.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Check your connection.');
    } finally {
      setSending(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete group', `Remove "${group?.name}"? This only removes the group on your device — nothing already sent is affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteGroup(projectId!, groupId!);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <SafeAreaView style={styles.flex}>
          <DetailHeader
            title={group?.name ?? 'Group'}
            right={
              group ? (
                <View style={styles.headerActions}>
                  <Pressable hitSlop={8} onPress={() => router.push(`/groups/${projectId}/new?groupId=${groupId}`)}>
                    <Pencil size={17} color={withAlpha(Brand.textRgb, 0.6)} />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={confirmDelete}>
                    <Trash2 size={17} color={Brand.error} />
                  </Pressable>
                </View>
              ) : undefined
            }
          />

          {group === undefined && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}
          {group === null && <Text style={styles.error}>Group not found on this device.</Text>}

          {group && (
            <>
              <View style={styles.banner}>
                <AlertTriangle size={13} color={Brand.accent} />
                <Text style={styles.bannerText}>
                  Broadcast group — sends as separate messages to each of {members.length} member{members.length === 1 ? '' : 's'}. No one sees anyone else's replies.
                </Text>
              </View>

              {threadsLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 20 }} />}

              {!threadsLoading && (
                <FlatList
                  ref={listRef}
                  data={merged}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                  renderItem={({ item }) => <Bubble message={item} mine={item.senderId === user?.id} />}
                  ListEmptyComponent={<Text style={styles.empty}>No messages yet — say hello to the group.</Text>}
                />
              )}

              {error && <Text style={styles.errorInline}>{error}</Text>}

              <View style={styles.composer}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={`Message ${members.length} member${members.length === 1 ? '' : 's'}…`}
                  placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
                  multiline
                />
                <Pressable style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]} disabled={!draft.trim() || sending} onPress={send}>
                  {sending ? <ActivityIndicator color={Brand.btnText} size="small" /> : <Send size={16} color={Brand.btnText} />}
                </Pressable>
              </View>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface MergedMessage extends ChatMessage {
  senderName: string;
}

function Bubble({ message, mine }: { message: MergedMessage; mine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!mine && <Text style={styles.bubbleSender}>{message.senderName}</Text>}
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 16 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, padding: 10,
    borderRadius: BrandRadius.btn, backgroundColor: withAlpha(Brand.accentRgb, 0.08), borderWidth: 1, borderColor: withAlpha(Brand.accentRgb, 0.25),
  },
  bannerText: { flex: 1, color: withAlpha(Brand.textRgb, 0.6), fontSize: 11, lineHeight: 15 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  errorInline: { color: Brand.error, fontSize: 12, textAlign: 'center', paddingBottom: 4, paddingHorizontal: 16 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: BrandRadius.card, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleTheirs: { backgroundColor: Brand.surface, borderWidth: 1, borderColor: Brand.border },
  bubbleMine: { backgroundColor: Brand.accent },
  bubbleSender: { color: Brand.accent, fontSize: 10.5, fontWeight: '700', marginBottom: 1 },
  bubbleText: { color: Brand.text, fontSize: 14 },
  bubbleTextMine: { color: Brand.btnText },
  bubbleTime: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 10, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(10,12,16,0.55)' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Brand.border,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder,
    backgroundColor: Brand.input, paddingHorizontal: 12, paddingVertical: 8, color: Brand.text, fontSize: 14,
  },
  sendButton: { width: 40, height: 40, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
