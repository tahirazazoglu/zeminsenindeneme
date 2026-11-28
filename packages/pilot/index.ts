export { createClient } from '@supabase/supabase-js'
export type { SupabaseClient, SupportedStorage } from '@supabase/supabase-js'

export type Facility = { id: string; name: string; sport: string; price: number; advance_days: number; cancel_minutes: number }
export type Slot = { id: string; facility: string; facility_name: string; starts_at: string; published: boolean; booked: boolean; price: number }
export type Reservation = { id: string; facility: string; facility_name: string; starts_at: string; student_name: string; status: 'confirmed' | 'cancelled'; price: number; cancel_minutes: number; listing_id: string | null }
export type Listing = { id: string; reservation: string; facility_name: string; starts_at: string; owner_name: string; description: string; capacity: number; filled: number; price: number; mine: boolean; status: 'open' | 'cancelled' | 'settled' }
export type Application = { id: string; listing: string; student_name: string; price: number; mine: boolean; status: 'pending' | 'accepted' | 'rejected' | 'refunded' | 'expired' | 'settled' }
export type Dashboard = {
  profile: { id: string; name: string; role: 'student' | 'staff' }
  balance: number
  facilities: Facility[]
  slots: Slot[]
  reservations: Reservation[]
  listings: Listing[]
  applications: Application[]
  movements: { id: number; kind: string; amount: number; created_at: string }[]
}
export type Operations = {
  facility_rules: { id: string; price: number; advance_days: number; cancel_minutes: number }
  add_slot: { id: string; starts_at: string }
  publish_slot: { id: string; published: boolean }
  reserve: { id: string; price: number }
  cancel: { id: string }
  create_listing: { id: string; capacity: number; price: number; description: string }
  apply: { id: string }
  decide: { id: string; accepted: boolean }
}

const moneyFormat = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const dateFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' })
export const money = (amount: number) => moneyFormat.format(amount / 100)
export const dateTime = (value: string) => dateFormat.format(new Date(value))

const istanbul = 'Europe/Istanbul'
const calendarDate = new Intl.DateTimeFormat('sv-SE', { timeZone: istanbul, year: 'numeric', month: '2-digit', day: '2-digit' })
const calendarLabel = new Intl.DateTimeFormat('tr-TR', { timeZone: istanbul, weekday: 'short', day: 'numeric', month: 'short' })
const clockLabel = new Intl.DateTimeFormat('tr-TR', { timeZone: istanbul, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const dayKey = (value: string) => calendarDate.format(new Date(value))
export const dayLabel = (value: string) => calendarLabel.format(new Date(value))
export const timeLabel = (value: string) => clockLabel.format(new Date(value))
export const endOfSlot = (value: string) => new Date(Date.parse(value) + 60 * 60 * 1000).toISOString()

export function parseMoney(input: string) {
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(input.trim())) return null
  return Math.round(Number(input.trim().replace(',', '.')) * 100)
}

export const messages: Record<string, string> = {
  FORBIDDEN: 'Bu işlem için yetkiniz yok veya kayıt artık açık değil.',
  INVALID_INPUT: 'Girdiğiniz bilgileri kontrol edin.',
  INVALID_SLOT: 'Bu saat rezervasyona açık değil.',
  PRICE_CHANGED: 'Tesis ücreti değişti. Saati yenileyip tekrar seçin.',
  SLOT_TAKEN: 'Bu saat rezerve edildi.',
  INSUFFICIENT_BALANCE: 'Test bakiyeniz yetersiz.',
  CANCELLATION_CLOSED: 'İptal süresi geçti.',
  ALREADY_EXISTS: 'Bu kayıt zaten var.',
  LISTING_FULL: 'İlan kontenjanı doldu.',
  REQUEST_REUSED: 'İşlem kimliği başka bir istek için kullanıldı.',
}

export const applicationLabels = {
  pending: 'Onay bekliyor', accepted: 'Kabul edildi', rejected: 'Reddedildi',
  refunded: 'İade edildi', expired: 'Süresi doldu', settled: 'Tamamlandı',
}

export const movementLabels: Record<string, string> = {
  initial_credit: 'Başlangıç test bakiyesi', reservation_charge: 'Rezervasyon',
  reservation_refund: 'Rezervasyon iadesi', application_hold: 'Katılım blokesi',
  application_release: 'Bloke iadesi', listing_income: 'İlan geliri',
}
