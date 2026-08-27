import { Drawer } from 'expo-router/drawer';

import { DrawerContent } from '@/components/nav/drawer-content';
import { Brand } from '@/constants/brand';

/**
 * Left slide-out drawer, same nav surface as the web app's left sidebar minus Execution
 * Intelligence, Viseron Intelligence, and Reports — deliberately not ported (Reports removed
 * per later request; see git history for src/app/reports/ if it needs to come back). Each entry
 * here is a project-picker landing screen (src/components/nav/feature-project-picker.tsx), same
 * pattern as the web app's own top-level Architecture/Direct-Orders/Documents pages — pick a
 * project, then hand off to the real per-project screen, which lives outside this group since
 * it's reached by a route param, not a fixed nav destination. Directory is the one exception —
 * it's genuinely global, no project picker needed.
 *
 * headerShown is off here — each screen renders its own header (matching its Brand styling)
 * with a DrawerToggleButton, rather than the default React Navigation header, to avoid a
 * double header bar.
 */
export default function AppLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: Brand.surface, width: 280 },
        overlayColor: 'rgba(0,0,0,0.5)',
      }}
      drawerContent={(props) => <DrawerContent {...props} />}>
      <Drawer.Screen name="index" options={{ drawerLabel: 'Projects' }} />
      <Drawer.Screen name="vendor-onboarding" options={{ drawerLabel: 'Vendor Onboarding' }} />
      <Drawer.Screen name="architecture" options={{ drawerLabel: 'Architecture' }} />
      <Drawer.Screen name="direct-orders" options={{ drawerLabel: 'Direct Orders' }} />
      <Drawer.Screen name="documents" options={{ drawerLabel: 'Documents' }} />
      <Drawer.Screen name="directory" options={{ drawerLabel: 'Directory' }} />
    </Drawer>
  );
}
