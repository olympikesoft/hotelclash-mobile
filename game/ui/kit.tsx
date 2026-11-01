// Shared building blocks for the native game screens (port of the web's
// components/game/ui.js), so every tab looks the same.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const C = {
  bg: '#f1f5f9',
  card: '#ffffff',
  line: '#e2e8f0',
  text: '#0f172a',
  sub: '#64748b',
  faint: '#94a3b8',
  indigo: '#4f46e5',
  indigoSoft: '#eef2ff',
  green: '#059669',
  greenSoft: '#ecfdf5',
  red: '#e11d48',
  redSoft: '#fff1f2',
  amber: '#d97706',
  amberSoft: '#fffbeb',
  sky: '#0284c7',
  skySoft: '#f0f9ff',
  violet: '#7c3aed',
  violetSoft: '#f5f3ff',
  dark: '#0f172a',
};

export const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const shortUsd = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e4 ? `${Math.round(a / 1e3)}k` : Math.round(a).toLocaleString('en-US');
  return `${v < 0 ? '−' : ''}$${s}`;
};

export function TabHeader({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <View style={s.tabHeader}>
      <Text style={s.tabTitle}>
        {icon ? `${icon} ` : ''}
        {title}
      </Text>
      {subtitle ? <Text style={s.tabSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={s.statRow}>{children}</View>;
}

export function Stat({ label, value, sub, tone = C.text }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={s.statSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function Section({ icon, title, hint, action, children }: { icon?: string; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>
          {icon ? `${icon} ` : ''}
          {title}
        </Text>
        {action}
      </View>
      {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Meter({ value, max = 5, tone }: { value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const color = tone || (pct >= 0.7 ? '#10b981' : pct >= 0.45 ? '#fbbf24' : '#f43f5e');
  return (
    <View style={s.meter}>
      <View style={[s.meterFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <Text style={s.stars} accessibilityLabel={`${value.toFixed(1)} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (value >= i - 0.5 ? '★' : '☆')).join('')}
    </Text>
  );
}

const PILL_TONES: Record<string, [string, string]> = {
  slate: ['#f1f5f9', '#475569'],
  green: ['#d1fae5', '#047857'],
  red: ['#ffe4e6', '#be123c'],
  amber: ['#fef3c7', '#b45309'],
  sky: ['#e0f2fe', '#0369a1'],
  violet: ['#ede9fe', '#6d28d9'],
  indigo: [C.indigo, '#ffffff'],
};

export function Pill({ children, tone = 'slate', onPress }: { children: React.ReactNode; tone?: keyof typeof PILL_TONES | string; onPress?: () => void }) {
  const [bg, fg] = PILL_TONES[tone] || PILL_TONES.slate;
  const body = <Text style={[s.pill, { backgroundColor: bg, color: fg }]}>{children}</Text>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

type Variant = 'primary' | 'dark' | 'ghost' | 'danger' | 'green';
const BTN: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: C.indigo, fg: '#fff' },
  dark: { bg: C.dark, fg: '#fff' },
  ghost: { bg: '#fff', fg: '#334155', border: C.line },
  danger: { bg: '#fff', fg: C.red, border: '#fecdd3' },
  green: { bg: '#10b981', fg: '#fff' },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
  big,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  /** For buttons whose text is only an emoji or symbol (e.g. ✕). */
  accessibilityLabel?: string;
}) {
  const v = BTN[variant];
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }}
      style={({ pressed }) => [
        s.btn,
        big && s.btnBig,
        { backgroundColor: off ? '#f1f5f9' : v.bg, borderColor: off ? 'transparent' : v.border || 'transparent' },
        pressed && !off && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <Text style={[s.btnText, big && s.btnTextBig, { color: off ? C.faint : v.fg }]} numberOfLines={1}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={s.chips}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={[s.chip, value === o.id && s.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: value === o.id }} hitSlop={{ top: 5, bottom: 5 }}>
          <Text style={[s.chipText, value === o.id && s.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

export const s = StyleSheet.create({
  tabHeader: { marginBottom: 12 },
  tabTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  tabSubtitle: { marginTop: 2, fontSize: 13, color: C.sub },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.line },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: C.sub },
  statValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statSub: { fontSize: 11, color: C.sub },
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  sectionHint: { fontSize: 12, color: C.sub, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.line, marginBottom: 8 },
  meter: { height: 6, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  stars: { color: '#fbbf24', fontSize: 13, letterSpacing: 1 },
  pill: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', alignSelf: 'flex-start' },
  btn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, minHeight: 44 },
  btnBig: { paddingVertical: 13, borderRadius: 12 },
  btnText: { fontSize: 13, fontWeight: '700' },
  btnTextBig: { fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 999, backgroundColor: '#f1f5f9' },
  chipOn: { backgroundColor: C.dark },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextOn: { color: '#fff' },
  empty: { backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 28, textAlign: 'center', fontSize: 13, color: C.sub },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700', color: C.text },
  small: { fontSize: 12, color: '#475569' },
  // #64748b on white is 4.8:1 (WCAG AA); the lighter #94a3b8 is only for decoration.
  tiny: { fontSize: 11, color: C.sub },
  icon: { fontSize: 18, backgroundColor: C.indigoSoft, borderRadius: 10, padding: 6, overflow: 'hidden', marginRight: 10 },
});
