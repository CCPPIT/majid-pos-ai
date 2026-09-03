/**
 * Onboarding flow (Section 18) — 8 slides, paged and animated.
 *
 * Mechanics: the FlatList pager is forced to LTR (writingDirection) so that
 * scroll offsets and programmatic paging are deterministic regardless of the
 * app language. Slide CONTENT and the footer controls remain fully RTL for
 * Arabic and LTR for English (text direction is inherited per-slide).
 *
 * Supports: animated progress bar + dots, Next / Back / Skip, smooth slide
 * transitions (scale/opacity/translate), reduced-motion friendly easing.
 */
import { useRef, useState } from 'react';
import { FlatList, type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Button, Screen, useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import { toneColors } from '@/design-system/tokens/colors';
import { LAST_SLIDE_INDEX, ONBOARDING_SLIDES, type OnboardingSlide } from './slides';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

interface OnboardingFlowProps {
  onComplete: () => void;
  onThemeToggle?: () => void;
  onLanguageToggle?: () => void;
}

export function OnboardingFlow({ onComplete, onThemeToggle, onLanguageToggle }: OnboardingFlowProps) {
  const { colors, spacing, isDark } = useTheme();
  const { t, isRTL: rtl } = useTranslation();

  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(LAST_SLIDE_INDEX, next));
    setIndex(target);
    listRef.current?.scrollToOffset({ offset: target * width, animated: true });
  };

  const onMomentumEnd = (offsetX: number) => {
    if (width > 0) setIndex(Math.round(offsetX / width));
  };

  const isLast = index === LAST_SLIDE_INDEX;
  const progress = (index + 1) / ONBOARDING_SLIDES.length;

  const renderSlide = ({ item, index: slideIndex }: { item: OnboardingSlide; index: number }) => (
    <Slide
      slide={item}
      slideIndex={slideIndex}
      width={width}
      scrollX={scrollX}
    />
  );

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      {/* Top utility row: language + theme toggles */}
      <View
        style={{
          flexDirection: rtl ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('language.label')}
          onPress={onLanguageToggle}
          style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: spacing.xs }}
          hitSlop={10}
        >
          <Ionicons name="language-outline" size={20} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>
            {rtl ? 'English' : 'العربية'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.darkMode')}
          onPress={onThemeToggle}
          hitSlop={10}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Pager — mechanics are language-independent (offsets by index), so
          direction does not affect programmatic paging; content inherits the
          app text direction inside each slide. */}
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <AnimatedFlatList
          ref={listRef as never}
          data={ONBOARDING_SLIDES as unknown as OnboardingSlide[]}
          keyExtractor={(item) => item.key}
          renderItem={renderSlide as never}
          horizontal
          pagingEnabled
          inverted={rtl}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => onMomentumEnd(e.nativeEvent.contentOffset.x)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          extraData={width}
        />
      </View>

      {/* Footer: progress + dots + controls */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.lg }}>
        <View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
            <Animated.View
              accessibilityRole="progressbar"
              accessibilityLabel={t('onboarding.slideIndicator', { current: index + 1, total: ONBOARDING_SLIDES.length })}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.primary,
                width: `${progress * 100}%`,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'center', gap: spacing.sm }}>
          {ONBOARDING_SLIDES.map((s, i) => (
            <Dot key={s.key} scrollX={scrollX} dotIndex={i} slideWidth={width} />
          ))}
        </View>

        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: spacing.md, alignItems: 'center' }}>
          {index > 0 ? (
            <Button
              label={t('onboarding.back')}
              variant="ghost"
              icon={rtl ? 'arrow-forward' : 'arrow-back'}
              onPress={() => goTo(index - 1)}
              style={{ minWidth: 110 }}
            />
          ) : (
            <View style={{ minWidth: 110 }} />
          )}

          <View style={{ flex: 1, flexDirection: rtl ? 'row-reverse' : 'row' }}>
            {!isLast ? (
              <Button
                label={t('onboarding.skip')}
                variant="ghost"
                size="sm"
                onPress={onComplete}
                accessibilityHint={t('onboarding.getStartedHint')}
              />
            ) : null}
          </View>

          {isLast ? (
            <Button
              label={t('onboarding.start')}
              icon={rtl ? 'arrow-back' : 'arrow-forward'}
              onPress={onComplete}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              label={t('onboarding.next')}
              icon={rtl ? 'arrow-back' : 'arrow-forward'}
              iconPosition={rtl ? 'leading' : 'trailing'}
              onPress={() => goTo(index + 1)}
              style={{ minWidth: 130 }}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

/** A single paged slide with parallax scale/opacity/translate on scroll. */
function Slide({
  slide,
  slideIndex,
  width,
  scrollX,
}: {
  slide: OnboardingSlide;
  slideIndex: number;
  width: number;
  scrollX: ReturnType<typeof useSharedValue<number>>;
}) {
  const { colors, spacing, textVariants } = useTheme();
  const { t, isRTL: rtl } = useTranslation();
  const { strong, soft } = toneColors(colors, slide.tone);

  const animatedStyle = useAnimatedStyle(() => {
    const input = [
      (slideIndex - 1) * (width || 1),
      slideIndex * (width || 1),
      (slideIndex + 1) * (width || 1),
    ];
    const scale = interpolate(scrollX.value, input, [0.82, 1, 0.82], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.25, 1, 0.25], Extrapolation.CLAMP);
    const translateX = interpolate(
      scrollX.value,
      input,
      [rtl ? 40 : -40, 0, rtl ? -40 : 40],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }, { translateX }] };
  });

  return (
    <View style={{ width, flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', gap: spacing.xl, width: '100%' }, animatedStyle]}>
        <View
          style={{
            width: 132,
            height: 132,
            borderRadius: 36,
            backgroundColor: soft,
            borderWidth: 1,
            borderColor: strong,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: strong,
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
            elevation: 10,
          }}
        >
          <Ionicons name={slide.icon as never} size={60} color={strong} />
        </View>
        <Text style={{ ...textVariants.display, color: colors.text, textAlign: 'center' }}>
          {t(slide.titleKey)}
        </Text>
        <Text
          style={{
            ...textVariants.body,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 26,
            fontSize: 16,
            paddingHorizontal: spacing.sm,
          }}
        >
          {t(slide.descKey)}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Animated dot that expands for the active slide. */
function Dot({
  scrollX,
  dotIndex,
  slideWidth,
}: {
  scrollX: ReturnType<typeof useSharedValue<number>>;
  dotIndex: number;
  slideWidth: number;
}) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const w = slideWidth || 1;
    const input = [(dotIndex - 1) * w, dotIndex * w, (dotIndex + 1) * w];
    const scale = interpolate(scrollX.value, input, [1, 1.5, 1], Extrapolation.CLAMP);
    const widthAnim = interpolate(scrollX.value, input, [8, 24, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, input, [0.4, 1, 0.4], Extrapolation.CLAMP);
    return { transform: [{ scale }], width: widthAnim, opacity };
  });

  return (
    <Animated.View
      accessibilityRole="text"
      style={[
        {
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
        style,
      ]}
    />
  );
}
