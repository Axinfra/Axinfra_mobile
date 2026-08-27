import { Truck } from 'lucide-react-native';

import { FeatureProjectPicker } from '@/components/nav/feature-project-picker';

export default function DirectOrdersScreen() {
  return (
    <FeatureProjectPicker
      title="Direct Orders"
      description="One-off vendor purchases outside the BOQ flow — e.g. HVAC, Electrical, Civil."
      icon={Truck}
      destination={(projectId) => `/direct-orders/${projectId}`}
    />
  );
}
