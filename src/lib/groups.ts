import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only "groups" for the Messages screen — there is no group-chat table on the backend
 * (the `Message` model is explicitly one-on-one only: "no role-wide broadcast", per its schema
 * comment), and adding one would mean a new Group/GroupMember schema, a migration on the live
 * database, and new API routes. Rather than build that, a "group" here is just a named,
 * device-local list of project members: sending "to the group" fires the same message as a real
 * 1:1 DM to each member individually (see groups/[projectId]/[groupId].tsx), and the group
 * itself — its name and membership — lives only in this device's storage, not in the project.
 * Nobody else sees that the group exists, and nobody in it sees anyone else's replies.
 */
export interface Group {
  id: string;
  projectId: string;
  name: string;
  memberIds: string[];
  createdAt: string;
}

function storageKey(projectId: string) {
  return `axinfra:groups:${projectId}`;
}

export async function listGroups(projectId: string): Promise<Group[]> {
  const raw = await AsyncStorage.getItem(storageKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Group[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getGroup(projectId: string, groupId: string): Promise<Group | null> {
  const groups = await listGroups(projectId);
  return groups.find((g) => g.id === groupId) ?? null;
}

/** Creates a new group, or overwrites an existing one when `id` matches one already saved
 * (used by the edit-members flow). */
export async function saveGroup(group: Group): Promise<void> {
  const groups = await listGroups(group.projectId);
  const next = groups.some((g) => g.id === group.id)
    ? groups.map((g) => (g.id === group.id ? group : g))
    : [...groups, group];
  await AsyncStorage.setItem(storageKey(group.projectId), JSON.stringify(next));
}

export async function deleteGroup(projectId: string, groupId: string): Promise<void> {
  const groups = await listGroups(projectId);
  await AsyncStorage.setItem(storageKey(projectId), JSON.stringify(groups.filter((g) => g.id !== groupId)));
}
