/**
 * نقطة تصدير مجال التقارير (PHASE 22).
 */
export * from './types'; // أنواع التقرير.
export {
  periodRanges,
  buildSalesReport,
  reportToText,
  type BuildReportInput,
} from './logic'; // المنطق النقي.
