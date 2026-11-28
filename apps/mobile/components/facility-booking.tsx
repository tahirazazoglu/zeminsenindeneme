import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { dayKey, dayLabel, endOfSlot, money, timeLabel, type Facility, type Slot } from '@zemin/pilot'
import { color, displayFont } from './theme'

const venuePhotos: Record<string, number | undefined> = {
  'halı saha': require('../assets/football-court.webp'),
  tenis: require('../assets/tennis-court.webp'),
}

const weekday = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'short' })
const month = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', month: 'short' })
const dayNumber = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric' })

export function useBookingSelection(facilities: Facility[], slots: Slot[], now: number) {
  const [facilityId, setFacilityId] = useState<string>()
  const [dayId, setDayId] = useState<string>()
  const [slotId, setSlotId] = useState<string>()
  const facility = facilities.find(item => item.id === facilityId) ?? facilities[0]
  const grouped = new Map<string, Slot[]>()

  for (const slot of slots) {
    if (slot.facility !== facility?.id || Date.parse(slot.starts_at) <= now) continue
    const key = dayKey(slot.starts_at)
    const group = grouped.get(key)
    if (group) group.push(slot)
    else grouped.set(key, [slot])
  }

  const days = Array.from(grouped.entries())
  const defaultDay = days.find(([, group]) => group.some(slot => !slot.booked)) ?? days[0]
  const currentDay = dayId && grouped.has(dayId) ? dayId : defaultDay?.[0]
  const daySlots = currentDay ? grouped.get(currentDay) ?? [] : []
  const selected = daySlots.find(slot => slot.id === slotId && !slot.booked)

  function selectFacility(id: string) {
    if (id === facility?.id) return
    setFacilityId(id)
    setDayId(undefined)
    setSlotId(undefined)
  }

  function selectDay(id: string) {
    if (id === currentDay) return
    setDayId(id)
    setSlotId(undefined)
  }

  const reset = useCallback(() => {
    setFacilityId(undefined)
    setDayId(undefined)
    setSlotId(undefined)
  }, [])

  return { facility, days, currentDay, daySlots, selected, selectFacility, selectDay, selectSlot: setSlotId, reset }
}

type Selection = ReturnType<typeof useBookingSelection>

export function FacilityBooking({ facilities, selection }: { facilities: Facility[]; selection: Selection }) {
  const { fontScale } = useWindowDimensions()
  const { facility, days, currentDay, daySlots, selected, selectFacility, selectDay, selectSlot } = selection

  if (!facility) return <Text style={styles.muted}>Rezervasyona açık tesis yok.</Text>

  const photo = venuePhotos[facility.sport.toLocaleLowerCase('tr-TR')]
  const cancelMinutes = facility.cancel_minutes
  const cutoff = cancelMinutes % 60 === 0 ? `${cancelMinutes / 60} saat` : `${cancelMinutes} dakika`
  const cancellation = cancelMinutes === 0
    ? 'Başlangıca kadar iptal edilebilir'
    : `Başlamadan ${cutoff} öncesine kadar iptal`
  const availableCount = daySlots.filter(slot => !slot.booked).length

  return <View style={styles.layout}>
    {facilities.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facilities}>
      {facilities.map(item => {
        const active = facility.id === item.id
        const uniqueSport = facilities.filter(other => other.sport === item.sport).length === 1
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.name}
          accessibilityState={{ selected: active }} onPress={() => selectFacility(item.id)}
          style={({ pressed }) => [styles.facilityOption, active && styles.facilityActive, pressed && styles.pressed]}>
          <Text style={[styles.facilityOptionText, active && styles.facilityOptionActive]}>{uniqueSport ? item.sport : item.name}</Text>
        </Pressable>
      })}
    </ScrollView>}

    <View style={styles.hero}>
      {photo && <View style={styles.heroMedia}>
        <Image source={photo} accessible={false} contentFit="cover" style={StyleSheet.absoluteFill} />
        <Text style={styles.photoLabel}>Temsili görsel</Text>
      </View>}
      <View style={styles.heroCopy}>
        <Text accessibilityRole="header" style={styles.facilityName}>{facility.name}</Text>
        <Text style={styles.heroPrice}>{money(facility.price)} <Text style={styles.heroUnit}>/ saat</Text></Text>
      </View>
    </View>
    <View style={styles.policy}>
      <Feather name="info" size={16} color={color.action} accessible={false} />
      <Text style={styles.policyText}>{cancellation}</Text>
    </View>

    {days.length === 0 ? <View style={styles.empty}>
      <Text accessibilityRole="header" style={styles.heading}>Saatler</Text>
      <Text style={styles.muted}>Bu tesis için yayımlanmış saat yok.</Text>
    </View> : <>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Gün seç</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
          {days.map(([id, group]) => {
            const active = currentDay === id
            const available = group.filter(slot => !slot.booked).length
            const start = group[0].starts_at
            return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: active }}
              accessibilityLabel={`${dayLabel(start)}, ${available} boş saat`} onPress={() => selectDay(id)}
              style={({ pressed }) => [styles.day, active && styles.dayActive, pressed && styles.pressed]}>
              <Text style={[styles.weekday, active && styles.dayOnDark]}>{weekday.format(Date.parse(start))}</Text>
              <View style={styles.dateParts}>
                <Text style={[styles.dayNumber, active && styles.dayOnDark]}>{dayNumber.format(Date.parse(start))}</Text>
                <Text style={[styles.dayCount, active && styles.dayOnDark]}>{month.format(Date.parse(start))}</Text>
              </View>
              <Text style={[styles.dayCount, active && styles.dayOnDark]}>{available} boş</Text>
            </Pressable>
          })}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.heading}>Saat seç</Text>
          <Text style={styles.muted}>{availableCount ? `${availableCount} müsait` : 'Tüm saatler dolu'}</Text>
        </View>
        <View style={styles.hours}>
          {daySlots.map(slot => {
            const active = selected?.id === slot.id
            const start = timeLabel(slot.starts_at)
            const end = timeLabel(endOfSlot(slot.starts_at))
            return <Pressable key={slot.id} accessibilityRole="radio"
              accessibilityLabel={`${start} – ${end}, ${slot.booked ? 'dolu' : 'boş'}`}
              accessibilityState={{ checked: active, disabled: slot.booked }} disabled={slot.booked}
              onPress={() => selectSlot(slot.id)}
              style={({ pressed }) => [styles.hour, fontScale > 1.25 && styles.largeHour, slot.booked && styles.booked,
                active && styles.hourActive, pressed && styles.pressed]}>
              <View style={styles.hourCopy}>
                <Text style={styles.hourStart}>{start}</Text>
                <Text style={styles.hourEnd}>{slot.booked ? 'Dolu' : `${end} bitiş`}</Text>
              </View>
              {active && <Feather name="check" size={18} color={color.ink} accessible={false} />}
            </Pressable>
          })}
        </View>
      </View>
    </>}
  </View>
}

export function BookingDock({ slot, balance, busy, onContinue }: { slot: Slot; balance: number; busy: boolean; onContinue: () => void }) {
  const { fontScale, width } = useWindowDimensions()
  const insufficient = balance < slot.price
  const disabled = busy || insufficient
  return <View style={styles.dock}>
    <View style={[styles.dockRow, (fontScale > 1.25 || width < 350) && styles.dockStack]}>
      <View style={styles.dockCopy}>
        <Text style={styles.dockDate}>{dayLabel(slot.starts_at)} · {timeLabel(slot.starts_at)}</Text>
        <Text style={styles.dockPrice}>{money(slot.price)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Rezervasyonu incele"
        accessibilityState={{ disabled }} disabled={disabled} onPress={onContinue}
        style={({ pressed }) => [styles.dockButton, disabled && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.dockButtonText}>Rezervasyonu incele</Text>
        <Feather name="arrow-right" size={18} color={color.ink} accessible={false} />
      </Pressable>
    </View>
    {insufficient && <Text accessibilityRole="alert" style={styles.dockWarning}>Test bakiyeniz yetersiz. Kullanılabilir bakiye {money(balance)}.</Text>}
  </View>
}

const styles = StyleSheet.create({
  layout: { gap: 16 },
  facilities: { gap: 18, borderBottomColor: color.line, borderBottomWidth: 1 },
  facilityOption: { paddingHorizontal: 2, paddingVertical: 10, minHeight: 48, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  facilityActive: { borderBottomColor: color.action },
  facilityOptionText: { color: color.muted, fontSize: 16, fontWeight: '600' },
  facilityOptionActive: { color: color.ink, fontWeight: '800' },
  hero: { overflow: 'hidden', backgroundColor: color.forest, borderRadius: 15 },
  heroMedia: { height: 146, padding: 10, alignItems: 'flex-end' },
  photoLabel: { color: color.surface, fontSize: 10, backgroundColor: color.forest, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4 },
  heroCopy: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, padding: 13 },
  facilityName: { flexShrink: 1, color: color.surface, fontFamily: displayFont, fontSize: 27 },
  heroPrice: { color: color.accent, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroUnit: { color: color.onDark, fontWeight: '500' },
  policy: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -8 },
  policyText: { flex: 1, color: color.muted, fontSize: 13, lineHeight: 19 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 7 },
  heading: { color: color.ink, fontFamily: displayFont, fontSize: 25 },
  dayStrip: { gap: 7 },
  day: { alignItems: 'center', minWidth: 68, paddingHorizontal: 9, paddingVertical: 7, gap: 1, borderWidth: 1, borderColor: color.line, borderRadius: 10, backgroundColor: color.surface },
  dayActive: { backgroundColor: color.action, borderColor: color.action },
  weekday: { color: color.muted, fontSize: 12, fontWeight: '600' },
  dateParts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: 3 },
  dayNumber: { color: color.ink, fontSize: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dayCount: { color: color.muted, fontSize: 11 },
  dayOnDark: { color: color.surface },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  hour: { flexGrow: 1, flexBasis: '45%', maxWidth: '100%', minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5, gap: 5, borderColor: color.line, borderWidth: 1, borderRadius: 9, backgroundColor: color.surface },
  largeHour: { flexBasis: '100%' },
  hourCopy: { flexShrink: 1 },
  hourStart: { color: color.ink, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hourEnd: { color: color.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  hourActive: { backgroundColor: color.accent, borderColor: color.action },
  booked: { backgroundColor: color.booked },
  empty: { gap: 6 },
  muted: { color: color.muted, fontSize: 13 },
  pressed: { opacity: 0.73 },
  dock: { backgroundColor: color.forest, paddingHorizontal: 14, paddingVertical: 10, gap: 5 },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dockStack: { flexDirection: 'column', alignItems: 'stretch', gap: 7 },
  dockCopy: { flexShrink: 1, gap: 2 },
  dockDate: { color: color.onDark, fontSize: 12 },
  dockPrice: { color: color.surface, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dockButton: { backgroundColor: color.accent, minHeight: 48, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 8, flexShrink: 1 },
  dockButtonText: { flexShrink: 1, color: color.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  dockWarning: { color: '#ffd1ca', fontSize: 12 },
  disabled: { opacity: 0.52 },
})
