import { Pencil } from 'lucide-react-native';

import { FeatureProjectPicker } from '@/components/nav/feature-project-picker';

export default function ArchitectureScreen() {
  return (
    <FeatureProjectPicker
      title="Architecture"
      description="Drawing sets and versions — approval status and payment progress, at a glance."
      icon={Pencil}
      destination={(projectId) => `/architecture/${projectId}`}
    />
  );
}
