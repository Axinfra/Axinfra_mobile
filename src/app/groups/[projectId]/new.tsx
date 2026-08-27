import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/nav/detail-header';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { apiFetch } from '@/lib/api';
import { getGroup, saveGroup, type Group } from '@/lib/groups';
import type { Conversation } from '@/types';

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a group, or edit an existing one's name/membership when opened with ?groupId= — same
 * form either way, just pre-filled. Membership is picked from the same "everyone else on this
 * project" list the 1:1 Messages tab uses. */
export default function NewGroupScreen() {
  const { projectId, groupId } = useLocalSearchParams<{ projectId: string; groupId?: string }>();
  const router = useRouter();
  const isEditing = !!groupId;

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', projectId],
    queryFn: () => apiFetch<Conversation[]>(`/api/projects/${projectId}/messages/conversations`),
    enabled: !!projectId,
  });

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadedExisting, setLoadedExisting] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || loadedExisting) return;
    getGroup(projectId!, groupId!).then((g) => {
      if (g) {
        setName(g.name);
        setSelected(new Set(g.memberIds));
      }
      setLoadedExisting(true);
    });
  }, [isEditing, loadedExisting, projectId, groupId]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the group a name.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Add members', 'Pick at least one person for this group.');
      return;
    }
    setSaving(true);
    try {
      const group: Group = {
        id: groupId ?? newId(),
        projectId: projectId!,
        name: trimmed,
        memberIds: Array.from(selected),
        createdAt: new Date().toISOString(),
      };
      await saveGroup(group);
      router.replace(`/groups/${projectId}/${group.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <DetailHeader title={isEditing ? 'Edit Group' : 'New Group'} />

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Group name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Site Team, Piling Vendors…"
            placeholderTextColor={withAlpha(Brand.textRgb, 0.35)}
          />
        </View>

        <Text style={styles.sectionLabel}>Members ({selected.size} selected)</Text>

        {(isLoading || !loadedExisting) && <ActivityIndicator color={Brand.accent} style={{ marginTop: 30 }} />}

        {conversations && loadedExisting && (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const checked = selected.has(item.userId);
              return (
                <Pressable style={styles.memberRow} onPress={() => toggle(item.userId)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberRole}>{item.role.replace(/_/g, ' ')}</Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Check size={13} color={Brand.btnText} />}
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<Text style={styles.empty}>No one else on this project yet.</Text>}
          />
        )}

        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} disabled={saving} onPress={save}>
            {saving ? <ActivityIndicator color={Brand.btnText} /> : <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Create Group'}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.base },
  flex: { flex: 1 },
  form: { paddingHorizontal: 20, paddingTop: 16 },
  fieldLabel: { color: withAlpha(Brand.textRgb, 0.5), fontSize: 11, fontWeight: '600', marginBottom: 6 },
  input: { height: 44, borderRadius: BrandRadius.input, borderWidth: 1, borderColor: Brand.inputBorder, backgroundColor: Brand.input, paddingHorizontal: 12, fontSize: 15, color: Brand.text },
  sectionLabel: { color: withAlpha(Brand.textRgb, 0.35), fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 12 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: BrandRadius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.surface, padding: 12,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(Brand.accentRgb, 0.12), alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Brand.accent, fontSize: 11, fontWeight: '700' },
  memberName: { color: Brand.text, fontSize: 14, fontWeight: '600' },
  memberRole: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 11, marginTop: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Brand.accent, borderColor: Brand.accent },
  empty: { color: withAlpha(Brand.textRgb, 0.4), fontSize: 13, textAlign: 'center', marginTop: 24 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: Brand.border },
  saveBtn: { height: 46, borderRadius: BrandRadius.btn, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Brand.btnText, fontSize: 15, fontWeight: '700' },
});
