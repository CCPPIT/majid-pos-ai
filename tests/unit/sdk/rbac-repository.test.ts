/**
 * تشغيل مواصفة عقد مستودع الصلاحيات على كل تنفيذاته — PHASE 31 · قسم 61.
 * التنفيذ الاختباري والتنفيذ المحلي (فوق فهرس المنصّة الحقيقي بأدواره
 * المئة) يمرّان بنفس المواصفة — فلا ينحرف قرار التفويض بتغيّر المصدر.
 */
import { createLocalRbacRepository } from '@/sdk/rbac';
import { cashierRole, createInMemoryRbacRepository, ownerRole } from '../../helpers/sdk-mocks';
import { runRbacRepositoryContract } from './rbac-repository.contract';

// (1) التنفيذ في الذاكرة المستخدم في بقية الاختبارات.
runRbacRepositoryContract({
  name: 'InMemoryRbacRepository',
  create: () => createInMemoryRbacRepository([ownerRole(), cashierRole()]),
  knownRoleCode: 'cashier',
});

// (2) التنفيذ المحلي فوق فهرس أدوار المنصّة القائم (100 دور).
runRbacRepositoryContract({
  name: 'LocalRbacRepository (فوق فهرس المنصّة)',
  create: () => createLocalRbacRepository(),
  knownRoleCode: 'cashier',
});
