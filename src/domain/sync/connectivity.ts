/**
 * منفذ الاتصال (Connectivity Port) — PHASE 23.
 * واجهة محايدة لا تستورد مكتبة شبكات: التطبيق يعمل دون اتصال أصلًا، والاتصال
 * مهم فقط لمحاولة المزامنة. التطبيق الفعلي (NetInfo) يُحقن لاحقًا في الجذر
 * دون تغيير الشاشات. الافتراضي اليوم متفائل (online) مع اشتراك لا-أدائي.
 */
import type { ConnectivityState } from './types';

// منفذ مراقبة الاتصال (قابل للاستبدال بمزوّد حقيقي لاحقًا).
export interface ConnectivityPort {
  // يجلب الحالة الحالية.
  getState(): Promise<ConnectivityState>;
  // يشترك في تغيّر الاتصال؛ يعيد دالة إلغاء الاشتراك.
  subscribe(listener: (state: ConnectivityState) => void): () => void;
}

// منفذ افتراضي: يفترض اتصالًا متاحًا (التطبيق يعمل محليًا بالكامل اليوم).
// حاوية مستقلة عن React لإتاحة قراءة الحالة من أي مكان (المحرّك) عبر دالة.
export class DefaultConnectivityPort implements ConnectivityPort {
  private listeners = new Set<(s: ConnectivityState) => void>();
  private current: ConnectivityState = 'online';

  async getState(): Promise<ConnectivityState> {
    return this.current;
  }

  subscribe(listener: (state: ConnectivityState) => void): () => void {
    this.listeners.add(listener);
    // نُعلمه بالحالة الحالية فورًا.
    Promise.resolve().then(() => listener(this.current));
    return () => {
      this.listeners.delete(listener);
    };
  }

  // يسمح لمزوّد حقيقي/اختبار بدفع حالة جديدة إلى كل المستمعين.
  set(state: ConnectivityState): void {
    this.current = state;
    for (const l of this.listeners) l(state);
  }
}
