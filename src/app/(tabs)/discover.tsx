import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export default function DiscoverScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll={false}>
      <EmptyState title={t('discover.emptyTitle')} body={t('discover.emptyBody')} />
    </Screen>
  );
}
