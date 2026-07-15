import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export default function WardrobeScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll={false}>
      <EmptyState title={t('wardrobe.emptyTitle')} body={t('wardrobe.emptyBody')} />
    </Screen>
  );
}
