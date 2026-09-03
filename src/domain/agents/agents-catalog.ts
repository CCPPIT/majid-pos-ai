/**
 * فهرس الوكلاء السبعة الأوصاف الثابتة (PHASE 25).
 * كل وكيل له اسم/وصف/أيقونة/أدنى صلاحية لرؤية رؤاه. البيانات وصفية فقط؛
 * المنطق في محرّك القواعد (rules.ts).
 */
import type { AgentDefinition, AgentId } from './types';

// تعريفات الوكلاء السبعة.
export const AGENTS: readonly AgentDefinition[] = [
  {
    id: 'inventory',
    nameKey: 'agents.agent.inventory.name',
    descriptionKey: 'agents.agent.inventory.desc',
    icon: 'layers-outline',
    requiredPermission: 'inventory.read',
  },
  {
    id: 'sales',
    nameKey: 'agents.agent.sales.name',
    descriptionKey: 'agents.agent.sales.desc',
    icon: 'trending-up-outline',
    requiredPermission: 'reports.view',
  },
  {
    id: 'finance',
    nameKey: 'agents.agent.finance.name',
    descriptionKey: 'agents.agent.finance.desc',
    icon: 'wallet-outline',
    requiredPermission: 'finance.read',
  },
  {
    id: 'procurement',
    nameKey: 'agents.agent.procurement.name',
    descriptionKey: 'agents.agent.procurement.desc',
    icon: 'cart-outline',
    requiredPermission: 'procurement.read',
  },
  {
    id: 'crm',
    nameKey: 'agents.agent.crm.name',
    descriptionKey: 'agents.agent.crm.desc',
    icon: 'people-outline',
    requiredPermission: 'customers.read',
  },
  {
    id: 'cashier',
    nameKey: 'agents.agent.cashier.name',
    descriptionKey: 'agents.agent.cashier.desc',
    icon: 'receipt-outline',
    requiredPermission: 'orders.read',
  },
  {
    id: 'business',
    nameKey: 'agents.agent.business.name',
    descriptionKey: 'agents.agent.business.desc',
    icon: 'briefcase-outline',
    requiredPermission: 'reports.view',
  },
];

// خريطة معرف الوكيل إلى تعريفه.
export const AGENT_BY_ID: Record<AgentId, AgentDefinition> = AGENTS.reduce(
  (acc, agent) => {
    acc[agent.id] = agent;
    return acc;
  },
  {} as Record<AgentId, AgentDefinition>,
);
