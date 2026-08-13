import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Project {
  id: string;
  name: string;
}

export default function HomeScreen() {
  const { user, logout } = useAuth();

  // Placeholder read of the same /api/projects route the web app uses.
  // Swap the response type / fields once you've confirmed the exact shape
  // this route returns for the signed-in user's role.
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedView>
            <ThemedText type="subtitle">Projects</ThemedText>
            {user && (
              <ThemedText type="small" themeColor="textSecondary">
                Signed in as {user.name || user.email}
              </ThemedText>
            )}
          </ThemedView>
          <Pressable onPress={logout}>
            <ThemedText type="link" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        </ThemedView>

        {isLoading && <ActivityIndicator style={styles.centered} />}

        {isError && (
          <ThemedView type="backgroundElement" style={styles.errorBox}>
            <ThemedText type="small">
              Couldn't load projects: {error instanceof Error ? error.message : 'unknown error'}
            </ThemedText>
            <Pressable onPress={() => refetch()}>
              <ThemedText type="linkPrimary">Retry</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {data && (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.projectRow}>
                <ThemedText>{item.name}</ThemedText>
              </ThemedView>
            )}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary">
                No projects yet.
              </ThemedText>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  centered: {
    marginTop: Spacing.six,
  },
  errorBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  projectRow: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
});
