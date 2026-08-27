import { FileText } from 'lucide-react-native';

import { FeatureProjectPicker } from '@/components/nav/feature-project-picker';

export default function DocumentsScreen() {
  return (
    <FeatureProjectPicker
      title="Documents"
      description="Specs and other project files, uploaded by the team."
      icon={FileText}
      destination={(projectId) => `/documents/${projectId}`}
    />
  );
}
