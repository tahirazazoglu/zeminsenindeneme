import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { color } from './theme'

export function Button({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function Field({ label, value, change, mode = 'text', multiline, maxLength }: { label: string; value: string; change: (value: string) => void; mode?: 'text' | 'email' | 'numeric' | 'decimal'; multiline?: boolean; maxLength?: number }) {
  return <View style={styles.field}>
    <Text style={styles.small}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={change} inputMode={mode}
      autoCapitalize={mode === 'text' ? 'sentences' : 'none'}
      autoComplete={mode === 'email' ? 'email' : label === 'Giriş kodu' ? 'one-time-code' : 'off'}
      multiline={multiline} maxLength={maxLength} style={[styles.input, multiline && styles.multiline]} />
  </View>
}

export function SectionTabs<T extends string>({ items, selected, onSelect }: {
  items: readonly T[]
  selected: T
  onSelect: (value: T) => void
}) {
  return <View accessibilityRole="tablist" style={styles.sections}>
    {items.map(item => {
      const active = item === selected
      return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }}
        onPress={() => onSelect(item)} style={({ pressed }) => [styles.sectionTab, active && styles.sectionActive, pressed && styles.pressed]}>
        <Text style={[styles.sectionText, active && styles.sectionTextActive]}>{item}</Text>
      </Pressable>
    })}
  </View>
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: color.line, columnGap: 14 },
  sectionTab: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 6, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  sectionActive: { borderBottomColor: color.action },
  sectionText: { color: color.muted, fontSize: 14, fontWeight: '600' },
  sectionTextActive: { color: color.ink, fontWeight: '800' },
  small: { color: color.muted, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: color.surface, borderColor: color.line, borderWidth: 1, borderRadius: 13, padding: 15, gap: 8 },
  field: { gap: 4 },
  multiline: { minHeight: 94, textAlignVertical: 'top' },
  input: { borderWidth: 1, borderColor: '#a3b5a6', borderRadius: 9, padding: 10, color: color.ink, minHeight: 48, fontSize: 16 },
  button: { backgroundColor: color.action, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 9, minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  buttonText: { color: color.surface, fontSize: 13, fontWeight: '700' },
  secondary: { backgroundColor: color.tint },
  secondaryText: { color: color.ink },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
})
