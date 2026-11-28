import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  applicationLabels, dayLabel, endOfSlot, money, parseMoney, timeLabel,
  type Application, type Listing, type Operations, type Reservation,
} from '@zemin/pilot'
import { Button, Card, Field, SectionTabs } from './student-controls'
import { color, displayFont } from './theme'

const sections = ['Keşfet', 'İlanlarım', 'Başvurularım'] as const
export type NetworkSection = typeof sections[number]
type ComposerState = Reservation | 'picker' | null

type Props = {
  listings: Listing[]
  applications: Application[]
  upcoming: Reservation[]
  now: number
  balance: number
  busy: boolean
  section: NetworkSection
  setSection: (section: NetworkSection) => void
  composer: ComposerState
  setComposer: (state: ComposerState) => void
  openFacilities: () => void
  apply: (listing: Listing) => void
  decide: (id: string, accepted: boolean) => Promise<boolean>
  publish: (payload: Operations['create_listing']) => Promise<boolean>
}

function schedule(startsAt: string) {
  return `${dayLabel(startsAt)} · ${timeLabel(startsAt)}–${timeLabel(endOfSlot(startsAt))}`
}

function ListingComposer({ reservation, busy, close, publish }: {
  reservation: Reservation
  busy: boolean
  close: () => void
  publish: Props['publish']
}) {
  const [places, setPlaces] = useState('1')
  const [fee, setFee] = useState('50')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    const price = parseMoney(fee)
    const capacity = Number(places)
    if (price === null || price < 500 || price > 10000000 || !Number.isInteger(capacity)
      || capacity < 1 || capacity > 30 || !description.trim() || description.trim().length > 300) {
      setError('1–30 oyuncu, 5–100.000 TL katılım tutarı ve en fazla 300 karakter açıklama girin.')
      return
    }
    setError('')
    await publish({ id: reservation.id, capacity, price, description: description.trim() })
  }

  return <View style={styles.stack}>
    <Text accessibilityRole="header" style={styles.heading}>Yeni ilan</Text>
    <View style={styles.reservationContext}>
      <Text style={styles.contextTitle}>{reservation.facility_name}</Text>
      <Text style={styles.contextMeta}>{schedule(reservation.starts_at)}</Text>
    </View>
    <Card>
      <Field label="Aranan oyuncu sayısı" value={places} change={setPlaces} mode="numeric" />
      <Field label="Kişi başı katılım (TL)" value={fee} change={setFee} mode="decimal" />
      <Field label="İlan açıklaması" value={description} change={setDescription} multiline maxLength={300} />
      <Text style={styles.muted}>Katılım tutarına 5 TL test hizmet bedeli dahildir.</Text>
      {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Button label="İlanı yayımla" disabled={busy} onPress={() => void submit()} />
        <Button label="Vazgeç" secondary disabled={busy} onPress={close} />
      </View>
    </Card>
  </View>
}

export function CampusNetwork({ listings, applications, upcoming, now, balance, busy, section, setSection, composer, setComposer, openFacilities, apply, decide, publish }: Props) {
  const eligible = upcoming.filter(item => !item.listing_id)
  const requestsByListing = new Map<string, Application[]>()
  const myRequests = new Map<string, Application>()
  for (const request of applications) {
    if (request.mine) myRequests.set(request.listing, request)
    else {
      const group = requestsByListing.get(request.listing)
      if (group) group.push(request)
      else requestsByListing.set(request.listing, [request])
    }
  }

  const open = (item: Listing) => item.status === 'open' && Date.parse(item.starts_at) > now
  const visible = listings.filter(item => {
    if (section === 'İlanlarım') return item.mine
    if (section === 'Başvurularım') return myRequests.has(item.id)
    return open(item) && !item.mine && !myRequests.has(item.id)
  })
  // The dashboard supplies chronological order. Put past decisions at the end.
  const active = visible.filter(open)
  const ordered = [...active, ...visible.filter(item => !open(item))]
  const firstPast = active.length

  if (composer === 'picker') return <View style={styles.stack}>
    <Text accessibilityRole="header" style={styles.heading}>Rezervasyon seç</Text>
    {eligible.length === 0 ? <View style={styles.empty}>
      <Text style={styles.title}>İlana açılabilecek rezervasyon yok</Text>
      <Text style={styles.muted}>İlan açmak için henüz ilana bağlanmamış, yaklaşan bir rezervasyon gerekiyor.</Text>
      <Button label="Tesisleri gör" onPress={openFacilities} />
    </View> : <View style={styles.pickerList}>
      {eligible.map(reservation => <Pressable key={reservation.id} accessibilityRole="button"
        accessibilityLabel={`${reservation.facility_name}, ${schedule(reservation.starts_at)}`}
        onPress={() => setComposer(reservation)} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
        <View style={styles.grow}>
          <Text style={styles.title}>{reservation.facility_name}</Text>
          <Text style={styles.muted}>{schedule(reservation.starts_at)}</Text>
        </View>
        <Feather name="chevron-right" color={color.action} size={20} accessible={false} />
      </Pressable>)}
    </View>}
    <Button label="Geri dön" secondary onPress={() => setComposer(null)} />
  </View>

  if (composer) return <ListingComposer key={composer.id} reservation={composer} busy={busy}
    close={() => setComposer(null)} publish={async payload => {
      const ok = await publish(payload)
      if (ok) {
        setSection('İlanlarım')
        setComposer(null)
      }
      return ok
    }} />

  const emptyLabel = section === 'Keşfet' ? 'Katılabileceğin açık ilan yok'
    : section === 'İlanlarım' ? 'Henüz ilan açmadın' : 'Henüz başvurun yok'
  const emptyCopy = section === 'Keşfet' ? 'Yaklaşan bir rezervasyonun varsa kendi ilanını açabilirsin.'
    : section === 'İlanlarım' ? 'Rezervasyonundan ilan açtığında gelen başvuruları burada yönetebilirsin.'
      : 'Bir ilana başvurduğunda sonucu burada görebilirsin.'

  return <View style={styles.stack}>
    <SectionTabs items={sections} selected={section} onSelect={setSection} />
    {section !== 'Başvurularım' && <View style={styles.actionBar}>
      <Text accessibilityRole="header" style={styles.heading}>{section === 'Keşfet' ? 'Açık ilanlar' : 'Yayımladığın ilanlar'}</Text>
      <Button label="İlan aç" disabled={busy} onPress={() => setComposer(eligible.length === 1 ? eligible[0] : 'picker')} />
    </View>}
    {ordered.length === 0 && <View style={styles.empty}>
      <Text style={styles.title}>{emptyLabel}</Text>
      <Text style={styles.muted}>{emptyCopy}</Text>
      {section === 'Başvurularım' && <Button label="Açık ilanları gör" secondary onPress={() => setSection('Keşfet')} />}
    </View>}
    {ordered.map((item, index) => {
      const request = myRequests.get(item.id)
      const incoming = requestsByListing.get(item.id) ?? []
      const isOpen = open(item)
      const remaining = Math.max(0, item.capacity - item.filled)
      return <View key={item.id} style={styles.listingGroup}>
        {index === firstPast && <Text accessibilityRole="header" style={styles.historyTitle}>
          {section === 'İlanlarım' ? 'Geçmiş ilanlar' : 'Geçmiş etkinlikler'}
        </Text>}
        <Card>
          <View style={styles.listingHead}>
            <View style={styles.grow}>
              <Text accessibilityRole="header" style={styles.title}>{item.facility_name}</Text>
              <Text style={styles.muted}>{schedule(item.starts_at)}</Text>
            </View>
            <Text style={[styles.listingStatus, !isOpen && styles.closedStatus]}>{request ? applicationLabels[request.status]
              : isOpen ? remaining ? `${remaining} boş yer` : 'Dolu'
                : item.status === 'cancelled' ? 'İptal edildi' : 'Kapalı'}</Text>
          </View>
          <Text style={styles.body}>{item.description}</Text>
          <View style={styles.listingFoot}>
            <View style={styles.grow}>
              <Text style={styles.muted}>{item.mine ? `${item.filled} / ${item.capacity} yer doldu` : item.owner_name}</Text>
              <Text style={styles.amount}>{money(request?.price ?? item.price)} <Text style={styles.muted}>/ kişi</Text></Text>
            </View>
            {!item.mine && !request && isOpen && remaining > 0 && <Button label="Başvur"
              disabled={busy || balance < item.price} onPress={() => apply(item)} />}
          </View>
          {!item.mine && !request && isOpen && remaining > 0 && balance < item.price && (
            <Text style={styles.error}>Test bakiyen bu başvuru için yetersiz.</Text>
          )}
          {item.mine && <View style={styles.incoming}>
            <Text style={styles.incomingTitle}>Gelen başvurular · {incoming.length}</Text>
            {incoming.length === 0 && <Text style={styles.muted}>Henüz başvuru yok.</Text>}
            {[...incoming.filter(entry => entry.status === 'pending'), ...incoming.filter(entry => entry.status !== 'pending')].map(entry =>
              <View key={entry.id} style={styles.request}>
                <View style={styles.requestLabel}>
                  <Text style={styles.body}>{entry.student_name}</Text>
                  <Text style={styles.muted}>{applicationLabels[entry.status]}</Text>
                </View>
                {isOpen && entry.status === 'pending' && <View style={styles.actions}>
                  <Button label="Kabul et" disabled={busy || remaining === 0} onPress={() => void decide(entry.id, true)} />
                  <Button label="Reddet" secondary disabled={busy} onPress={() => void decide(entry.id, false)} />
                </View>}
              </View>)}
          </View>}
        </Card>
      </View>
    })}
  </View>
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  heading: { color: color.ink, fontFamily: displayFont, fontSize: 26, flexShrink: 1 },
  title: { color: color.ink, fontSize: 17, fontWeight: '800' },
  muted: { color: color.muted, fontSize: 13, lineHeight: 19 },
  body: { color: color.body, fontSize: 15, lineHeight: 21 },
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  empty: { backgroundColor: color.tint, borderRadius: 12, padding: 14, gap: 7 },
  reservationContext: { backgroundColor: color.forest, borderRadius: 12, padding: 14, gap: 4 },
  contextTitle: { color: color.surface, fontSize: 17, fontWeight: '800' },
  contextMeta: { color: color.onDark, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerList: { borderTopWidth: 1, borderColor: color.line },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderColor: color.line },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.7 },
  listingGroup: { gap: 8 },
  historyTitle: { color: color.muted, fontFamily: displayFont, fontSize: 22, marginTop: 4 },
  closedStatus: { backgroundColor: color.booked, color: color.muted },
  listingHead: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
  listingStatus: { color: color.action, backgroundColor: color.tint, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
  listingFoot: { borderTopWidth: 1, borderColor: color.line, paddingTop: 9, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  amount: { color: color.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  incoming: { borderTopWidth: 1, borderColor: color.line, paddingTop: 9, gap: 7 },
  incomingTitle: { color: color.ink, fontWeight: '700' },
  request: { gap: 5, paddingVertical: 2 },
  requestLabel: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  error: { color: color.danger, fontSize: 13 },
})
