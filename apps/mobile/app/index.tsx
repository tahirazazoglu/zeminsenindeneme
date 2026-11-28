import 'react-native-url-polyfill/auto'
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { SafeAreaView } from 'react-native-safe-area-context'
import { randomUUID } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef } from 'react'
import { createClient, dateTime, endOfSlot, timeLabel, money, type Facility, type Listing, type Reservation, type Slot } from '@zemin/pilot'
import { usePilot } from '@zemin/pilot/react'
import { BookingDock, FacilityBooking, useBookingSelection } from '../components/facility-booking'
import { CampusNetwork, type NetworkSection } from '../components/campus-network'
import { cancellationDeadline, Reservations } from '../components/reservations'
import { Wallet } from '../components/wallet'
import { StudentSignIn } from '../components/student-sign-in'
import { Button, Card } from '../components/student-controls'
import { color, displayFont } from '../components/theme'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY
const client = url && key ? createClient(url, key, {
  auth: {
    ...(Platform.OS === 'web' ? {} : {
      storage: { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync },
    }),
    detectSessionInUrl: false,
    autoRefreshToken: true,
    persistSession: true,
  },
}) : null

const tabs = ['Tesisler', 'Rezervasyonlar', 'Kampüs Ağı', 'Cüzdan'] as const
type Tab = typeof tabs[number]
const tabIcons = {
  Tesisler: 'map-pin',
  Rezervasyonlar: 'calendar',
  'Kampüs Ağı': 'users',
  Cüzdan: 'credit-card',
} satisfies Record<Tab, ComponentProps<typeof Feather>['name']>

export default function StudentApp() {
  const { member, data, error, busy, authenticate, refresh, act, signOut } = usePilot(client, randomUUID)
  const [tab, setTab] = useState<Tab>('Tesisler')
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const [confirmation, setConfirmation] = useState<{ title?: string; label: string; actionLabel?: string; details?: { label: string; value: string }[]; run: () => Promise<boolean> } | null>(null)
  const [networkSection, setNetworkSection] = useState<NetworkSection>('Keşfet')
  const [composer, setComposer] = useState<Reservation | 'picker' | null>(null)
  const now = Date.now()
  const booking = useBookingSelection(data?.facilities ?? [], data?.slots ?? [], now)
  const resetBooking = booking.reset

  useEffect(() => {
    if (!member) {
      setConfirmation(null)
      setComposer(null)
      setNetworkSection('Keşfet')
      setTab('Tesisler')
      resetBooking()
    }
  }, [member, resetBooking])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void client?.auth.startAutoRefresh()
        void refresh()
      } else void client?.auth.stopAutoRefresh()
    })
    return () => subscription.remove()
  }, [refresh])

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }) }, [tab])

  function reviewApplication(listing: Listing) {
    setConfirmation({
      title: listing.facility_name,
      label: `${dateTime(listing.starts_at)} – ${timeLabel(endOfSlot(listing.starts_at))}`,
      actionLabel: 'Başvuruyu gönder',
      details: [{ label: 'Test bakiyesinde bloke edilecek', value: money(listing.price) }],
      run: () => act('apply', { id: listing.id }),
    })
  }

  function reviewReservation(slot: Slot, facility: Facility) {
    const deadline = cancellationDeadline(slot.starts_at, facility.cancel_minutes)
    setConfirmation({
      title: facility.name,
      actionLabel: 'Rezervasyonu onayla',
      label: `${dateTime(slot.starts_at)} – ${timeLabel(endOfSlot(slot.starts_at))}`,
      details: [
        { label: 'Test bakiyesinden düşülecek', value: money(slot.price) },
        { label: 'İptal sınırı', value: Date.parse(deadline) > Date.now() ? dateTime(deadline) : 'İptal süresi geçti' },
      ],
      run: async () => {
        const success = await act('reserve', { id: slot.id, price: slot.price })
        if (success) setTab('Rezervasyonlar')
        return success
      },
    })
  }

  function reviewCancellation(item: Reservation) {
    setConfirmation({
      title: 'Rezervasyonu iptal et',
      label: `${item.facility_name} · ${dateTime(item.starts_at)}`,
      actionLabel: 'İptali onayla',
      details: [
        { label: 'Test bakiyesine iade', value: money(item.price) },
        ...(item.listing_id ? [{ label: 'Kampüs Ağı', value: 'Bağlı ilan kapanır, açık başvuru blokeleri iade edilir.' }] : []),
      ],
      run: () => act('cancel', { id: item.id }),
    })
  }

  function openNetwork(section: NetworkSection) {
    setComposer(null)
    setNetworkSection(section)
    setTab('Kampüs Ağı')
  }

  const upcoming = data?.reservations
    .filter(item => item.status === 'confirmed' && Date.parse(item.starts_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)) ?? []
  const history = data?.reservations.filter(item => item.status === 'cancelled' || Date.parse(item.starts_at) <= now) ?? []

  if (client && member === null) return <StudentSignIn busy={busy} error={error} authenticate={authenticate} />

  return <SafeAreaView style={styles.screen}>
    <View style={styles.shell}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no">
            <Feather name="activity" size={22} color={color.accent} />
          </View>
          <View style={styles.headerTitle}>
            <Text style={styles.brand}>Zemin Senin</Text>
            <Text style={styles.headerNote}>{data?.profile.name ?? 'Kampüs sporları'}</Text>
          </View>
          {member && <Pressable accessibilityRole="button" accessibilityLabel="Çıkış yap" accessibilityState={{ disabled: busy }}
            disabled={busy} onPress={() => void signOut()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Feather name="log-out" size={19} color={color.muted} accessible={false} />
          </Pressable>}
        </View>
        {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!client ? <Card><Text style={styles.title}>Bağlantı ayarı gerekli</Text><Text style={styles.body}>Pilot ortamını bağlamak için uygulamanın Supabase ayarlarını girin.</Text></Card>
          : member === undefined ? <Text style={styles.body}>Oturum kontrol ediliyor…</Text>
          : !data ? <Card><Text style={styles.body}>Pilot verileri yükleniyor.</Text><Button secondary label="Yenile" onPress={() => void refresh()} /></Card>
          : data.profile.role !== 'student' ? <Card><Text style={styles.title}>Görevli hesabı</Text><Text style={styles.body}>Tesisleri yönetmek için görevli web panelini açın.</Text></Card>
          : <>
            <View style={styles.toolbar}>
              <Text accessibilityRole="header" style={styles.pageTitle}>{tab === 'Tesisler' ? 'Tesis rezervasyonu' : tab}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Yenile" accessibilityState={{ disabled: busy }}
                disabled={busy} onPress={() => void refresh()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Feather name="refresh-cw" size={19} color={color.action} accessible={false} />
              </Pressable>
            </View>
            {confirmation && <Modal visible transparent animationType="none" onRequestClose={() => { if (!busy) setConfirmation(null) }}>
              <View style={styles.overlay}>
                <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={styles.dialog}>
                  <ScrollView bounces={false} contentContainerStyle={styles.dialogContent}>
                    <Text accessibilityRole="header" style={styles.dialogTitle}>{confirmation.title ?? 'İşlemi onayla'}</Text>
                    <Text style={styles.body}>{confirmation.label}</Text>
                    {confirmation.details?.map(detail => <View key={detail.label} style={styles.detail}>
                      <Text style={styles.small}>{detail.label}</Text>
                      <Text style={styles.detailValue}>{detail.value}</Text>
                    </View>)}
                    {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                    <View style={styles.dialogActions}>
                      <Button label={confirmation.actionLabel ?? 'Onayla'} disabled={busy}
                        onPress={() => void confirmation.run().then(ok => { if (ok) setConfirmation(null) })} />
                      <Button label="Vazgeç" secondary disabled={busy} onPress={() => setConfirmation(null)} />
                    </View>
                  </ScrollView>
                </SafeAreaView>
              </View>
            </Modal>}

            {tab === 'Tesisler' && <FacilityBooking facilities={data.facilities} selection={booking} />}

            {tab === 'Rezervasyonlar' && <Reservations upcoming={upcoming} history={history} now={now}
              busy={busy || !!confirmation} openFacilities={() => setTab('Tesisler')}
              createListing={item => { setComposer(item); setTab('Kampüs Ağı') }}
              openListings={() => openNetwork('İlanlarım')} cancel={reviewCancellation} />}

            {tab === 'Kampüs Ağı' && <CampusNetwork listings={data.listings} applications={data.applications}
              upcoming={upcoming} now={now} balance={data.balance} busy={busy || !!confirmation}
              section={networkSection} setSection={setNetworkSection} composer={composer} setComposer={setComposer} openFacilities={() => { setComposer(null); setTab('Tesisler') }}
              apply={reviewApplication}
              decide={(id, accepted) => act('decide', { id, accepted })}
              publish={payload => act('create_listing', payload)} />}

            {tab === 'Cüzdan' && <Wallet data={data} openApplications={() => openNetwork('Başvurularım')} />}
          </>}
      </ScrollView>
      {data?.profile.role === 'student' && tab === 'Tesisler' && booking.selected && booking.facility && (
        <BookingDock slot={booking.selected} balance={data.balance} busy={busy || !!confirmation}
          onContinue={() => {
            if (booking.selected && booking.facility) reviewReservation(booking.selected, booking.facility)
          }} />
      )}
      {data?.profile.role === 'student' && <View accessibilityRole="tablist" style={styles.nav}>
        {tabs.map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }}
          onPress={() => { setTab(label); setConfirmation(null); setComposer(null) }} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <View style={[styles.tabIcon, tab === label && styles.activeIcon]} accessibilityElementsHidden importantForAccessibility="no">
            <Feather name={tabIcons[label]} color={tab === label ? color.forest : color.muted} size={19} />
          </View>
          <Text style={[styles.tabLabel, tab === label && styles.activeLabel]}>{label}</Text>
        </Pressable>)}
      </View>}
    </View>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  shell: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  content: { paddingHorizontal: 17, paddingBottom: 20, gap: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 2 },
  iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  brandMark: { width: 37, height: 37, borderRadius: 9, backgroundColor: color.forest, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },
  brand: { color: color.ink, fontFamily: displayFont, fontSize: 27 },
  headerNote: { color: color.muted, fontSize: 13 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageTitle: { color: color.ink, flexShrink: 1, fontFamily: displayFont, fontSize: 34 },
  title: { color: color.ink, fontSize: 19, fontWeight: '700' },
  body: { color: color.body, fontSize: 15, lineHeight: 22 },
  small: { color: color.muted, fontSize: 13, lineHeight: 19 },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#10241da8' },
  dialog: { width: '100%', maxWidth: 680, maxHeight: '85%', backgroundColor: color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  dialogContent: { padding: 20, gap: 12 },
  dialogTitle: { color: color.ink, fontFamily: displayFont, fontSize: 32 },
  dialogActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 5 },
  detail: { borderTopColor: color.line, borderTopWidth: 1, paddingTop: 8, gap: 3 },
  detailValue: { color: color.ink, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.76 },
  error: { color: color.danger, backgroundColor: color.dangerTint, padding: 10, borderRadius: 8 },
  nav: { backgroundColor: color.paper, borderTopWidth: 1, borderColor: color.line, flexDirection: 'row', padding: 4, gap: 2 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 53, gap: 3 },
  tabIcon: { alignItems: 'center', justifyContent: 'center', minWidth: 42, minHeight: 25, borderRadius: 9 },
  activeIcon: { backgroundColor: color.accent },
  tabLabel: { color: color.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  activeLabel: { color: color.ink, fontWeight: '800' },
})
