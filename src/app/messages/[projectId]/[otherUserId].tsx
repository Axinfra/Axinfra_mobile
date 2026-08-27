import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import type { ChatMessage, Conversation } from '@/types';

/** 1:1 thread with another project member — text only (the web route also accepts a file
 * attachment via multipart; not ported here, matching the same scope decision as the rest of
 * this app's messaging-adjacent screens). Polls every 8s rather than a live socket, same
 * "good enough, no new infra" tradeoff as the web app's own unread-count badge. */
export default function ThreadScreen() {
  const { projectId, otherUserId } = useLocalSearchParams<{ projectId: string; otherUserId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations', projectId],
    queryFn: () => apiFetch<Conversation[]>(`/api/projects/${projectId}/messages/conversations`),
  });
  const other = conversations?.find((c) => c.userId === otherUserId);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['thread', projectId, otherUserId],
    queryFn: () => apiFetch<ChatMessage[]>(`/api/projects/${projectId}/messages/${otherUserId}`),
    enabled: !!projectId && !!otherUserId,
    refetchInterval: 8000,
  });

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);
    setSending(true);
    try {
      await apiFetch(`/api/projects/${projectId}/messages/${otherUserId}`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['thread', projectId, otherUserId] });
      await queryClient.invalidateQueries({ queryKey: ['conversations', projectId] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Check your connection.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <SafeAreaView style={styles.flex}>
          <DetailHeader title={other?.name ?? 'Message'} />

          {isLoading && <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />}

          {messages && (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => <Bubble message={item} mine={item.senderId === user?.id} />}
              ListEmptyComponent={<Text style={styles.empty}>No messages yet — say hello.</Text>}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
              multiline
            />
            <Pressable style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]} disabled={!draft.trim() || sending} onPress={send}>
              {sending ? <ActivityIndicator color={Brand.btnText} size="small" /> : <Send size={16} color={Brand.btnText} />}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  error: { color: Brand.error, fontSize: 12, textAlign: 'center', paddingBottom: 4 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: BrandRadius.card, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleTheirs: { backgroundColor: Brand.surface, borderWidth: 1, borderColor: Brand.border },
  bubbleMine: { backgroundColor: Brand.accent },
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
