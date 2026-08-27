import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { usePathname, useRouter } from 'expo-router';
import { FileText, Folder, LogOut, Pencil, Truck, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AxinfraLogo } from '@/components/brand/axinfra-logo';
import { Brand, BrandRadius, withAlpha } from '@/constants/brand';
import { useAuth } from '@/lib/auth';

// Same destinations declared as Drawer.Screen entries in (app)/_layout.tsx — kept in sync
// there, not derived, since the drawer needs to know the route name and this needs the href.
// Same relative order as the web sidebar, minus Execution Intelligence (project-scoped, reached
// from a project card instead), Viseron Intelligence (not ported), and Reports (removed).
const ITEMS = [
  { href: '/', label: 'Projects', icon: Folder },
  { href: '/vendor-onboarding', label: 'Vendor Onboarding', icon: Users },
  { href: '/architecture', label: 'Architecture', icon: Pencil },
  { href: '/direct-orders', label: 'Direct Orders', icon: Truck },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/directory', label: 'Directory', icon: Users },
] as const;

/** Same layout as the web app's left sidebar — logo, "MENU" label, nav list with a gold
 * highlight on the active item — rebuilt for a slide-out drawer instead of a fixed column. */
export function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <DrawerContentScrollView {...props} style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.logoWrap}>
        <AxinfraLogo size="sm" />
      </View>

      <Text style={styles.menuLabel}>Menu</Text>

      {ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Pressable
            key={item.href}
            onPress={() => {
              router.push(item.href);
              props.navigation.closeDrawer();
            }}
            style={[styles.item, active && styles.itemActive]}>
            <Icon size={18} color={active ? Brand.accent : withAlpha(Brand.textRgb, 0.6)} />
            <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}

      <View style={styles.spacer} />

      <Pressable onPress={logout} style={styles.item}>
        <LogOut size={18} color={withAlpha(Brand.textRgb, 0.55)} />
        <Text style={styles.itemText}>Sign out</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Brand.surface },
  content: { paddingHorizontal: 16, paddingTop: 8, flexGrow: 1 },
  logoWrap: { paddingVertical: 20, paddingHorizontal: 4 },
  menuLabel: {
    color: withAlpha(Brand.textRgb, 0.35),
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BrandRadius.btn,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  itemActive: {
    borderColor: withAlpha(Brand.accentRgb, 0.5),
    backgroundColor: withAlpha(Brand.accentRgb, 0.08),
  },
  itemText: { color: withAlpha(Brand.textRgb, 0.7), fontSize: 14, fontWeight: '500' },
  itemTextActive: { color: Brand.accent, fontWeight: '600' },
  spacer: { flex: 1, minHeight: 24 },
});
