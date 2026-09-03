/**
 * عقد السلة — PHASE 32 · أقسام 06 · 29 · 31.
 *
 * السلة أصل الفاتورة: بنودها تُحوَّل إلى Sale عند الإتمام. الأوامر
 * (إضافة/إزالة/تحديث كمية) مُنسَّخة صراحةً.
 */
import { z } from 'zod';
import { contractName, domainContractVersion } from '../core';

// اسم العقد ونسخته.
export const CART_CONTRACT_NAME = contractName('cart', 'Cart');
// النسخة الحالية.
export const CART_CONTRACT_VERSION = domainContractVersion('cart');

// مخطط بند السلة.
export const cartItemSchema = z.object({
  productId: z.string().min(1), // المنتج.
  quantity: z.number().int().positive(), // الكمية (موجبة).
  unitPrice: z.number().finite().nonnegative(), // سعر الوحدة.
});

// نوع بند السلة.
export type CartItem = z.infer<typeof cartItemSchema>;

// مخطط السلة.
export const cartSchema = z.object({
  id: z.string().min(1), // المعرّف.
  storeId: z.string().min(1), // المتجر.
  items: z.array(cartItemSchema), // البنود.
  currency: z.string().trim().length(3), // العملة.
});

// نوع السلة.
export type Cart = z.infer<typeof cartSchema>;

// مخطط أمر إضافة بند (قسم 31).
export const addCartItemCommandSchema = cartItemSchema.extend({
  commandVersion: z.literal(CART_CONTRACT_VERSION), // نسخة الأمر.
});

// نوع أمر الإضافة.
export type AddCartItemCommand = z.infer<typeof addCartItemCommandSchema>;
