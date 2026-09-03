import { PlaceholderScreen } from '@/shared/ui/PlaceholderScreen';
import { useTranslation } from '@/i18n/LocaleProvider';

export default function CustomersTab() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('customers.title')}
      phase="PHASE 19"
      description={t('customers.description')}
      icon="people-outline"
    />
  );
}
