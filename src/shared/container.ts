/**
 * حاوية التركيب (Composition Container) — PHASE 10.
 * مستودعات تُنشأ مرة واحدة وتُشارك بين الجذر (_layout) والشاشات التي تحتاج
 * حقن مستودع مباشرة (شاشة لوحة التحكم). المصادر المحلية اليوم تُستبدل بـ API
 * لاحقًا من هذا المكان فقط — دون لمس الشاشات.
 */
import { MockDashboardSource } from '@/data/sources/dashboard.source';
import { AppDashboardRepository, type DashboardRepository } from '@/data/repositories/dashboard.repository';
import { LocalCatalogSource } from '@/data/sources/local-catalog.source';
import { AppProductsRepository, type ProductsRepository } from '@/data/repositories/products.repository';
import { AsyncStoragePreferencesSource } from '@/data/sources/preferences.source';
import { LocalOrdersSource } from '@/data/sources/orders.source';
import { AppOrdersRepository, type OrdersRepository } from '@/data/repositories/orders.repository';
import { LocalPaymentsSource } from '@/data/sources/payments.source';
import { AppPaymentsRepository, type PaymentsRepository } from '@/data/repositories/payments.repository';
import { SimulatedPaymentProvider } from '@/domain/payments/provider';
import { LocalInventoryMovementsSource } from '@/data/sources/inventory.source';
import { AppInventoryRepository, type InventoryRepository } from '@/data/repositories/inventory.repository';
import { LocalSuppliersSource, LocalPurchaseOrdersSource } from '@/data/sources/procurement.source';
import { AppProcurementRepository, type ProcurementRepository } from '@/data/repositories/procurement.repository';
import { LocalCustomersSource } from '@/data/sources/customers.source';
import { AppCustomersRepository, type CustomersRepository } from '@/data/repositories/customers.repository';
import { LocalExpensesSource } from '@/data/sources/expenses.source';
import { AppFinanceRepository, type FinanceRepository } from '@/data/repositories/finance.repository';
import { LocalHrSource } from '@/data/sources/hr.source';
import { AppHrRepository, type HrRepository } from '@/data/repositories/hr.repository';
import { AppReportsRepository, type ReportsRepository } from '@/data/repositories/reports.repository';
import { LocalSyncQueueSource } from '@/data/sources/sync.source';
import { AppSyncRepository, type SyncRepository } from '@/data/repositories/sync.repository';
import { LocalAuditLogSource } from '@/data/sources/audit.source';
import { AppAuditRepository, type AuditRepository } from '@/data/repositories/audit.repository';
import { DefaultConnectivityPort, LocalSimulatedSyncAdapter } from '@/domain/sync';

// مصدر التفضيلات المشترك (تخزين نصي على الجهاز).
const sharedPreferencesSource = new AsyncStoragePreferencesSource();

// مستودع اللوحة الوحيد عبر التطبيق (مصدر تجريبي حاليًا).
export const dashboardRepository: DashboardRepository = new AppDashboardRepository(new MockDashboardSource());

// مستودع كتالوج المنتجات (PHASE 11 قراءة · PHASE 16 إدارة) — دائم محليًا، API غدًا.
export const productsRepository: ProductsRepository = new AppProductsRepository(
  new LocalCatalogSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
);

// مصدر الطلبات المشترك (يستخدمه مستودع الطلبات ومستودع المدفوعات لتحديث الحالة).
const ordersSource = new LocalOrdersSource({
  getString: (key) => sharedPreferencesSource.getString(key),
  setString: (key, value) => sharedPreferencesSource.setString(key, value),
});

// مستودع طلبات البيع (PHASE 13) — مخزّن محليًا (Offline-First)، يُزامن لاحقًا.
export const ordersRepository: OrdersRepository = new AppOrdersRepository(ordersSource);

// مستودع المدفوعات (PHASE 14) — مزود محاكى اليوم، بوابة حقيقية لاحقًا.
export const paymentsRepository: PaymentsRepository = new AppPaymentsRepository(
  new SimulatedPaymentProvider(),
  new LocalPaymentsSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
  ordersSource,
);

// مستودع المخزون (PHASE 17) — سجل حركات محلي + مستودع المنتجات للرصيد.
export const inventoryRepository: InventoryRepository = new AppInventoryRepository(
  new LocalInventoryMovementsSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
  productsRepository,
);

// مستودع المشتريات (PHASE 18) — مورّدون + أوامر شراء، الاستلام يحدّث المخزون.
export const procurementRepository: ProcurementRepository = new AppProcurementRepository(
  new LocalSuppliersSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
  new LocalPurchaseOrdersSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
  inventoryRepository,
);

// مستودع العملاء وCRM والولاء (PHASE 19) — محلي اليوم، مزامنة API غدًا.
export const customersRepository: CustomersRepository = new AppCustomersRepository(
  new LocalCustomersSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
);

// مستودع المالية والمحاسبة (PHASE 20) — قيود مشتقة من مبيعات/مشتريات/مصاريف.
export const financeRepository: FinanceRepository = new AppFinanceRepository(
  new LocalExpensesSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
  ordersRepository,
  procurementRepository,
);

// مستودع الموارد البشرية (PHASE 21) — موظفون + حضور/دوام محلي اليوم.
export const hrRepository: HrRepository = new AppHrRepository(
  new LocalHrSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
);

// مستودع التقارير (PHASE 22) — قراءة فقط، يشتق الأرقام من الطلبات والمدفوعات.
export const reportsRepository: ReportsRepository = new AppReportsRepository(ordersRepository, paymentsRepository);

// منفذ الاتصال (PHASE 23) — افتراضي اليوم، يُحقن محوّل NetInfo الحقيقي لاحقًا.
export const connectivityPort = new DefaultConnectivityPort();

// مستودع المزامنة (PHASE 23) — طابور صادر دائم؛ المحوّل محاكي محلي حتى يتوفر الخادم.
export const syncRepository: SyncRepository = new AppSyncRepository(
  new LocalSyncQueueSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
  new LocalSimulatedSyncAdapter(),
  connectivityPort,
);

// مستودع سجل التدقيق (PHASE 27) — سجل append-only على نفس التخزين المحلي.
export const auditRepository: AuditRepository = new AppAuditRepository(
  new LocalAuditLogSource({
    getString: (key) => sharedPreferencesSource.getString(key),
    setString: (key, value) => sharedPreferencesSource.setString(key, value),
  }),
);
