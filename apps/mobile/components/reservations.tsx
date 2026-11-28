import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { dateTime, dayLabel, endOfSlot, money, timeLabel, type Reservation } from '@zemin/pilot'
import { Button, Card, SectionTabs } from './student-controls'
import { color, displayFont } from './theme'

const sections = ['Yaklaşan', 'Geçmiş'] as const

export function cancellationDeadline(startsAt: string, minutes: number) {
  return new Date(Date.parse(startsAt) - minutes * 60000).toISOString()
}

export function Reservations({ upcoming, history, now, busy, openFacilities, createListing, openListings, cancel }: {
  upcoming: Reservation[]
  history: Reservation[]
  now: number
  busy: boolean
  openFacilities: () => void
  createListing: (item: Reservation) => void
  openListings: () => void
  cancel: (item: Reservation) => void
}) {
  const [section, setSection] = useState<typeof sections[number]>('Yaklaşan')
  const active = section === 'Yaklaşan'
  const records = active ? upcoming : history

  return <View style={styles.stack}>
    <SectionTabs items={sections} selected={section} onSelect={setSection} />
    {records.length === 0 && <View style={styles.empty}>
      <Text style={styles.title}>{active ? 'Yaklaşan rezervasyon yok' : 'Geçmiş rezervasyon yok'}</Text>
      {active && <>
        <Text style={styles.muted}>Yeni bir rezervasyon için tesis ve saat seç.</Text>
        <Button label="Tesisleri gör" onPress={openFacilities} />
      </>}
    </View>}
    {records.map((item, index) => {
      const hours = `${timeLabel(item.starts_at)}–${timeLabel(endOfSlot(item.starts_at))}`
      const deadline = cancellationDeadline(item.starts_at, item.cancel_minutes)
      const canCancel = now <= Date.parse(deadline)
      return <View key={item.id} style={styles.stack}>
        {active && index === 0 && <Text accessibilityRole="header" style={styles.heading}>Sıradaki rezervasyon</Text>}
        <Card>
          <View style={styles.top}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{item.facility_name}</Text>
              <Text style={styles.muted}>{dayLabel(item.starts_at)} · {hours}</Text>
            </View>
            <Text style={[styles.status, active && styles.activeStatus]}>
              {active ? 'Onaylandı' : item.status === 'cancelled' ? 'İptal edildi' : 'Süresi geçti'}
            </Text>
          </View>
          {!active && <Text style={styles.amount}>{money(item.price)}</Text>}
          {active && <>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.muted}>Test bakiyesinden ödendi</Text>
                <Text style={styles.amount}>{money(item.price)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.muted}>Son iptal zamanı</Text>
                <Text style={[styles.amount, !canCancel && styles.warning]}>{canCancel ? dateTime(deadline) : 'İptal süresi geçti'}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              {item.listing_id
                ? <Button label="İlanlarımı gör" disabled={busy} onPress={openListings} />
                : <Button label="İlan aç" disabled={busy} onPress={() => createListing(item)} />}
              {canCancel && <Button label="Rezervasyonu iptal et" secondary disabled={busy} onPress={() => cancel(item)} />}
            </View>
          </>}
        </Card>
      </View>
    })}
  </View>
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  heading: { color: color.ink, fontFamily: displayFont, fontSize: 25 },
  title: { color: color.ink, fontSize: 17, fontWeight: '800' },
  titleBlock: { flexGrow: 1, flexShrink: 1, minWidth: 130, gap: 4 },
  muted: { color: color.muted, fontSize: 13, lineHeight: 19 },
  top: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  status: { color: color.muted, backgroundColor: color.booked, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 5, fontSize: 12, fontWeight: '700' },
  activeStatus: { color: color.action, backgroundColor: color.tint },
  facts: { flexDirection: 'row', flexWrap: 'wrap', borderTopColor: color.line, borderTopWidth: 1, paddingTop: 10, gap: 8 },
  fact: { flexGrow: 1, minWidth: 125, flexBasis: '45%', gap: 2 },
  amount: { color: color.ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  warning: { color: color.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  empty: { backgroundColor: color.tint, padding: 15, borderRadius: 12, gap: 8 },
})
