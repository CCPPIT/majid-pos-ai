/**
 * شاشة المساعد الذكي (AI Copilot) — واجهة محادثة (PHASE 24).
 * مساعد محلي صادق يجيب عن أسئلة المتجر (المبيعات/الإيراد/المخزون/الأسعار)
 * من بيانات حقيقية عبر الذكاء القواعدي على الجهاز. لا خادم ذكاء اصطناعي بعد —
 * يُذكر ذلك بوضوح. تشمل فقاعات رسائل، بطاقات أرقام، أسئلة مقترحة، ومؤشر تحميل.
 * الوصول محمي بصلاحية التقارير (بيانات تشغيلية) — إخفاء ليس أمنًا لكننا
 * نفرض الحماية عبر PermissionGuard أيضًا.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { answerCopilot } from './copilot-service';
import { SUGGESTION_KEYS, type CopilotCard, type CopilotMessage } from '@/domain/ai';

// رسالة ترحيب أولية.
function greetingMessage(now: string): CopilotMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    text: '', // يُملأ بالترجمة عند العرض.
    createdAt: now,
  };
}

export function CopilotScreen() {
  const router = useRouter(); // التنقل.
  const { t, formatCurrency, formatNumber, formatPercent } = useTranslation(); // الترجمة والمنسّقات.
  const { locale } = useLocale(); // اللغة الحالية.
  const { colors } = useTheme(); // الثيم.
  const tenancy = useTenancy(); // سياق المتجر (للعملة).
  const { state } = useBootstrap(); // الجلسة (للصلاحيات).
  const permissions = state.session?.permissions ?? []; // صلاحيات الجلسة.

  const currency = tenancy.context?.currency ?? 'YER'; // عملة العرض.
  const [messages, setMessages] = useState<CopilotMessage[]>([greetingMessage(new Date().toISOString())]);
  const [input, setInput] = useState(''); // نص السؤال.
  const [thinking, setThinking] = useState(false); // هل المساعد يفكر؟
  const listRef = useRef<FlatList<CopilotMessage>>(null); // مرجع القائمة للتمرير.

  // إرسال سؤال وتوليد الرد.
  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || thinking) return;

      const userMsg: CopilotMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setThinking(true);

      // حقن المُنسّقات للخدمة (تفادي استيراد الواجهة في طبقة الخدمة).
      const reply = await answerCopilot(
        trimmed,
        {
          t: (key, params) => t(key, params as Record<string, string | number> | undefined),
          currency,
          fmtMoney: (amount, cur) => formatCurrency(amount, cur ?? currency),
          fmtNumber: (v) => formatNumber(v),
          fmtPercent: (v) => formatPercent(v, 1),
        },
        locale,
      );

      setMessages((prev) => [...prev, reply]);
      setThinking(false);
      // تمرير لأحدث رسالة.
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    [thinking, t, currency, formatCurrency, formatNumber, formatPercent, locale],
  );

  // فقاعة رسالة واحدة.
  const renderBubble = useCallback(
    ({ item }: { item: CopilotMessage }) => {
      const isUser = item.role === 'user';
      const isWelcome = item.id === 'welcome';
      const text = isWelcome ? t('copilot.welcome') : item.text;
      return (
        <View style={[styles.bubbleRow, isUser ? styles.rowUser : styles.rowBot]}>
          {!isUser ? (
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
          ) : null}
          <View style={styles.bubbleCol}>
            <Card
              glass={!isUser}
              style={[
                styles.bubble,
                isUser
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.bubbleText, { color: isUser ? '#fff' : colors.text }]}>{text}</Text>
              {item.cards && item.cards.length > 0 ? <CardsRow cards={item.cards} /> : null}
            </Card>
          </View>
          {isUser ? (
            <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted ?? colors.surface }]}>
              <Ionicons name="person" size={16} color={colors.textSubtle} />
            </View>
          ) : null}
        </View>
      );
    },
    [t, colors],
  );

  return (
    <PermissionGuard permissions={permissions} required="reports.view">
      <Screen edges={['top']} padded={false}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* الترويسة. */}
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.primary} />
            </Pressable>
            <View style={styles.headerTitleCol}>
              <Text style={[styles.title, { color: colors.text }]}>{t('copilot.title')}</Text>
              <View style={styles.subRow}>
                <View style={[styles.dot, { backgroundColor: colors.success ?? colors.primary }]} />
                <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{t('copilot.localNote')}</Text>
              </View>
            </View>
          </View>

          {/* المحادثة. */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderBubble}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              thinking ? (
                <View style={[styles.bubbleRow, styles.rowBot]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                  </View>
                  <Card glass style={[styles.bubble, styles.thinking, { borderColor: colors.border }]}>
                    <Text style={[styles.bubbleText, { color: colors.textSubtle }]}>{t('copilot.thinking')}</Text>
                  </Card>
                </View>
              ) : (
                // أسئلة مقترحة عند بداية المحادثة فقط.
                messages.length <= 1 ? (
                  <View style={styles.suggestions}>
                    {SUGGESTION_KEYS.map((key) => (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        onPress={() => void ask(t(key))}
                        style={[styles.chip, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
                        <Text style={[styles.chipText, { color: colors.primary }]}>{t(key)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null
              )
            }
          />

          {/* صندوق الإدخال. */}
          <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.backgroundElevated }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('copilot.placeholder')}
              placeholderTextColor={colors.textSubtle}
              multiline
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              onSubmitEditing={() => void ask(input)}
              returnKeyType="send"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('copilot.send')}
              onPress={() => void ask(input)}
              disabled={!input.trim() || thinking}
              style={[styles.sendBtn, { backgroundColor: input.trim() && !thinking ? colors.primary : colors.surfaceMuted ?? colors.surface }]}
            >
              <Ionicons name="send" size={18} color={input.trim() && !thinking ? '#fff' : colors.textSubtle} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    </PermissionGuard>
  );
}

// صف بطاقات أرقام داخل الفقاعة.
function CardsRow({ cards }: { cards: CopilotCard[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cardsWrap}>
      {cards.map((card) => {
        const tone = card.tone === 'good' ? 'success' : card.tone === 'warn' ? 'warning' : card.tone === 'bad' ? 'danger' : 'neutral';
        const palette = toneColors(colors, tone);
        return (
          <View key={card.key} style={[styles.miniCard, { backgroundColor: palette.soft, borderColor: palette.strong }]}>
            <Text style={[styles.miniTitle, { color: colors.textMuted }]} numberOfLines={1}>{card.title}</Text>
            <Text style={[styles.miniValue, { color: palette.strong }]} numberOfLines={1}>{card.value}</Text>
            {card.meta ? <Text style={[styles.miniMeta, { color: colors.textSubtle }]} numberOfLines={1}>{card.meta}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitleCol: { flex: 1 },
  title: { fontSize: fontSize.xl, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subtitle: { fontSize: fontSize.xs, flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginVertical: 2 },
  rowBot: { justifyContent: 'flex-start' },
  rowUser: { justifyContent: 'flex-end' },
  bubbleCol: { flexShrink: 1, maxWidth: '82%' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  thinking: { paddingHorizontal: spacing.lg },
  bubbleText: { fontSize: fontSize.sm, lineHeight: 20 },
  cardsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  miniCard: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, gap: 2 },
  miniTitle: { fontSize: 10, fontWeight: '700' },
  miniValue: { fontSize: fontSize.md, fontWeight: '900' },
  miniMeta: { fontSize: 10, fontWeight: '700' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { fontSize: fontSize.sm, fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, textAlignVertical: 'center' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
