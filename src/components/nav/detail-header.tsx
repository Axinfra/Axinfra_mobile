import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

/** Back-button header for screens pushed from a project picker (or a project card) rather
 * than reached directly from the drawer. `right` is an optional action slot (e.g. "New Order")
 * — defaults to a same-width spacer so the title stays centered when there's nothing to show. */
export function DetailHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
        <ChevronLeft size={22} color={Brand.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    gap: 8,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', color: Brand.text, fontSize: 16, fontWeight: '600' },
  right: { minWidth: 22, alignItems: 'flex-end' },
});
