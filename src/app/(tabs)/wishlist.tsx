import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export default function WishlistScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll={false}>
      <EmptyState title={t('wishlist.emptyTitle')} body={t('wishlist.emptyBody')} />
    </Screen>
  );
}
