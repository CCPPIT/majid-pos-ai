/**
 * حاجز أخطاء الإنتاج (Error Boundary) — PHASE 30.
 * تعرضه expo-router عند حدوث خطأ غير ممسوك في أي شاشة: شاشة انهيار لائقة
 * (داكنة/فاتحة) مع رسالة عربية-إنجليزية وزر إعادة محاولة يعيد تحميل المسار
 * بدل شاشة بيضاء/حمراء فنية. مكتفٍ ذاتيًا (لا يعتمد على أي مزود قد يكون
 * انهار): مكوّنات react-native أساسية فقط، ألوان مضمّنة، ونمط داكن افتراضي.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

// خصائص حاجز expo-router.
export interface CrashBoundaryProps {
  error: Error; // الخطأ غير الممسوك.
  retry?: () => void; // إعادة محاولة (يعيد ضبط الحاجز ويُحمّل المسار).
  scheme?: 'dark' | 'light'; // النمط (داكن افتراضيًا لضمان العمل بعد الانهيار).
}

// لوحتا ألوان ثابتتان (لا تعتمدان على ThemeProvider لضمان العمل بعد الانهيار).
const PALETTE = {
  dark: { bg: '#0B0F14', card: '#141B24', text: '#F5F7FA', sub: '#9AA7B4', primary: '#4F8CFF' },
  light: { bg: '#F5F7FA', card: '#FFFFFF', text: '#121826', sub: '#5B6B7C', primary: '#2563EB' },
};

export function CrashBoundary({ error, retry, scheme = 'dark' }: CrashBoundaryProps) {
  // داكن افتراضيًا (يُعرض عند انهيار أي مزود، فلا اعتماد على ثيم/منصة هنا).
  const c = scheme === 'light' ? PALETTE.light : PALETTE.dark;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        {/* رمز تنبيه لطيف بدل نص الخطأ الفني */}
        <View style={[styles.iconCircle, { backgroundColor: c.card }]}>
          <Text style={[styles.glyph, { color: c.primary }]}>⚠</Text>
        </View>

        <Text style={[styles.title, { color: c.text }]}>حدث خطأ غير متوقع</Text>
        <Text style={[styles.titleEn, { color: c.sub }]}>Something went wrong</Text>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.message, { color: c.sub }]}>
            حدث خطأ أثناء عرض هذه الشاشة. بياناتك محفوظة محليًا وآمنة — حاول إعادة المحاولة.
          </Text>
          <Text style={[styles.messageEn, { color: c.sub }]}>
            An error occurred while showing this screen. Your data is saved locally and safe — please try again.
          </Text>
        </View>

        {/* زر إعادة المحاولة (يعيد ضبط الحاجز) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إعادة المحاولة / Retry"
          onPress={() => retry?.()}
          style={[styles.button, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.buttonIcon, { color: '#fff' }]}>↻</Text>
          <Text style={styles.buttonText}>إعادة المحاولة</Text>
        </Pressable>

        {/* تفاصيل تقنية في وضع التطوير فقط (للتمكين/الدعم) */}
        {__DEV__ && error?.message ? (
          <Text style={[styles.devError, { color: c.sub }]}>{error.message}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  glyph: { fontSize: 44, lineHeight: 52 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  titleEn: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  card: { borderRadius: 16, padding: 16, width: '100%', marginTop: 8, gap: 8 },
  message: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  messageEn: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  buttonIcon: { fontSize: 18, fontWeight: '900' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  devError: { fontSize: 11, marginTop: 16, textAlign: 'center', fontFamily: 'monospace' },
});
