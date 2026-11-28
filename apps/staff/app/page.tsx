'use client'

import { useState, type FormEvent } from 'react'
import { createClient, dateTime, dayKey, dayLabel, endOfSlot, money, parseMoney, timeLabel, type Facility } from '@zemin/pilot'
import { usePilot } from '@zemin/pilot/react'
import { SlotCalendar } from './slot-calendar'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY
const client = url && key ? createClient(url, key, { auth: { detectSessionInUrl: false } }) : null
const requestId = () => crypto.randomUUID()

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const hourOrder = [...hours.slice(18), ...hours.slice(0, 18)]
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const atHour = (day: string, hour: string) => `${day}T${hour}:00:00+03:00`

function shiftDay(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}

type RuleValues = Pick<Facility, 'price' | 'advance_days' | 'cancel_minutes'>

function RulesForm({ facility, busy, save }: { facility: Facility; busy: boolean; save: (rules: RuleValues) => Promise<boolean> }) {
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const price = parseMoney(String(fields.get('price') ?? ''))
    const advanceDays = Number(fields.get('advance_days'))
    const cancelMinutes = Number(fields.get('cancel_minutes'))
    if (price === null || price > 10000000 || !Number.isInteger(advanceDays) || advanceDays < 1 || advanceDays > 30
      || !Number.isInteger(cancelMinutes) || cancelMinutes < 0 || cancelMinutes > 1440) {
      setError('Fiyatı, rezervasyon penceresini ve iptal süresini kontrol edin.')
      return
    }
    setError('')
    setSaved(false)
    void save({ price, advance_days: advanceDays, cancel_minutes: cancelMinutes }).then(setSaved)
  }

  return <form className="card" onSubmit={submit} onInput={() => setSaved(false)}>
    <h2>Rezervasyon koşulları</h2>
    <p className="muted">{facility.name}</p>
    <label>Saatlik test ücreti (TL)<input name="price" defaultValue={facility.price / 100} inputMode="decimal" required /></label>
    <label>Rezervasyon penceresi (gün)<input name="advance_days" type="number" min="1" max="30" defaultValue={facility.advance_days} required /></label>
    <label>İptal sınırı (başlangıçtan önce, dakika)<input name="cancel_minutes" type="number" min="0" max="1440" defaultValue={facility.cancel_minutes} required /></label>
    <p className="muted">Yeni koşullar sonraki rezervasyonlara uygulanır.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {saved && <p role="status">Koşullar kaydedildi.</p>}
    <button disabled={busy}>Koşulları kaydet</button>
  </form>
}

export default function StaffPage() {
  const { member, data, error, busy, authenticate, refresh, act, signOut } = usePilot(client, requestId)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [slotError, setSlotError] = useState('')
  const [notice, setNotice] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [selectedHour, setSelectedHour] = useState('')
  const [allDays, setAllDays] = useState(false)
  const [reservationStatus, setReservationStatus] = useState('all')
  const facility = data?.facilities.find(item => item.id === selectedId) ?? data?.facilities[0]
  const slots = data?.slots.filter(item => item.facility === facility?.id) ?? []
  const reservations = data?.reservations.filter(item => item.facility === facility?.id) ?? []
  const now = Date.now()
  const today = dayKey(new Date(now).toISOString())
  const day = slotDate || (slots[0] ? dayKey(slots[0].starts_at) : today)
  const calendarSlots = allDays ? slots : slots.filter(slot => dayKey(slot.starts_at) === day)
  const dayReservations = allDays ? reservations : reservations.filter(item => dayKey(item.starts_at) === day)
  const visibleReservations = dayReservations.filter(item => reservationStatus === 'all' || item.status === reservationStatus)
  const studentsByStart = new Map(dayReservations.filter(item => item.status === 'confirmed')
    .map(item => [Date.parse(item.starts_at), item.student_name]))
  const scheduled = new Set(slots.map(slot => Date.parse(slot.starts_at)))
  const freeHours = new Set(hourOrder.filter(hour => {
    const start = Date.parse(atHour(day, hour))
    return start > now && !scheduled.has(start)
  }))
  const slotHour = freeHours.has(selectedHour) ? selectedHour : freeHours.values().next().value ?? ''
  const slotStart = slotHour ? atHour(day, slotHour) : null
  const shortDays = Array.from(new Set(slots.map(slot => dayKey(slot.starts_at)))).slice(0, 5)

  function pickDay(value: string) {
    if (!datePattern.test(value) || !Number.isFinite(Date.parse(atHour(value, '00')))) return
    setSlotDate(value)
    setAllDays(false)
    setSlotError('')
    setNotice('')
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await authenticate(email, sent ? code : undefined) && !sent) setSent(true)
  }

  async function addSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!facility) return
    setNotice('')
    setSlotError('')
    if (!slotStart) {
      setSlotError('Geçerli bir tarih ve saat seçin.')
      return
    }
    const starts_at = slotStart
    if (await act('add_slot', { id: facility.id, starts_at })) {
      setSlotDate(day)
      setNotice(`${facility.name} · ${dateTime(starts_at)} yayımlandı.`)
    }
  }

  return <>
    <a href="#panel" className="skipLink">Ana içeriğe geç</a>
    <main id="panel">
    <header className="top">
      <div><p className="brand">Zemin Senin</p><h1>Görevli paneli</h1></div>
      {member && <div className="account"><span>{data?.profile.name}</span><button className="secondary" disabled={busy} onClick={() => {
        setSent(false); setCode(''); void signOut()
      }}>Çıkış</button></div>}
    </header>
    {error && <p role="alert" className="error">{error}</p>}
    {!client ? <section className="card"><h2>Bağlantı ayarı gerekli</h2><p>Pilot Supabase ayarlarını panelin ortam değişkenlerine ekleyin.</p></section>
      : member === undefined ? <p>Oturum kontrol ediliyor…</p>
      : !member ? <form className="card login" onSubmit={login}>
        <h2>Görevli girişi</h2>
        <label>E-posta<input name="email" type="email" spellCheck={false} autoComplete="email" required value={email} onChange={event => {
          setEmail(event.target.value); setSent(false); setCode('')
        }} /></label>
        {sent && <label>Giriş kodu<input name="code" spellCheck={false} inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} /></label>}
        <button disabled={busy}>{sent ? 'Giriş yap' : 'Kod gönder'}</button>
        {sent && <button type="button" className="secondary" disabled={busy} onClick={() => void authenticate(email)}>Yeni kod iste</button>}
      </form>
      : !data ? <section className="card"><p>Panel verileri yükleniyor.</p><button onClick={() => void refresh()}>Yenile</button></section>
      : data.profile.role !== 'staff' ? <section className="card"><h2>Öğrenci hesabı</h2><p>Bu panel tesis görevlileri içindir. Öğrenci işlemleri için mobil uygulamayı açın.</p></section>
      : !facility ? <section className="card"><h2>Tesis atanmamış</h2><p>Hesabınıza tesis atandığında yönetim seçenekleri burada görünür.</p></section>
      : <>
        <div className="toolbar">
          <label>Tesis<select value={facility.id} onChange={event => { setSelectedId(event.target.value); setSlotError(''); setNotice(''); setSlotDate(''); setSelectedHour(''); setAllDays(false); setReservationStatus('all') }}>
            {data.facilities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <div className="toolbarActions">
            <a className="jump" href="#add-slot">Saat ekle</a>
            <a className="jump" href="#reservations">Rezervasyonlar</a>
            <button className="secondary" disabled={busy} onClick={() => void refresh()}>Verileri yenile</button>
          </div>
        </div>
        <section className="dateBar" aria-label="Takvim günü">
          <div className="dateControls">
            <button type="button" className="secondary dayNav" aria-label="Önceki gün"
              onClick={() => pickDay(shiftDay(day, -1))}>‹</button>
            <label>Takvim günü<input name="calendar-day" type="date" value={day}
              onChange={event => pickDay(event.target.value)} /></label>
            <button type="button" className="secondary dayNav" aria-label="Sonraki gün"
              onClick={() => pickDay(shiftDay(day, 1))}>›</button>
            <button type="button" className="secondary" onClick={() => pickDay(today)}>Bugün</button>
            <button type="button" className={allDays ? '' : 'secondary'} aria-pressed={allDays}
              onClick={() => setAllDays(!allDays)}>Tüm günler</button>
          </div>
          {shortDays.length > 0 && <div className="dateShortcuts" aria-label="Yaklaşan günler">
            {shortDays.map(value => <button key={value} type="button"
              className={day === value && !allDays ? 'dateActive' : 'dateShortcut'} aria-pressed={day === value && !allDays}
              onClick={() => pickDay(value)}>{dayLabel(atHour(value, '12'))}</button>)}
          </div>}
        </section>
        {notice && <p role="status" className="notice">{notice}</p>}
        <div className="workspace">
          <SlotCalendar key={facility.id} facilityName={facility.name} slots={calendarSlots} showDates={allDays}
            studentsByStart={studentsByStart} busy={busy} error={error}
            changePublication={async slot => {
              setNotice('')
              const ok = await act('publish_slot', { id: slot.id, published: !slot.published })
              if (ok) setNotice(`${facility.name} · ${dateTime(slot.starts_at)} ${slot.published ? 'kapatıldı' : 'yayımlandı'}.`)
              return ok
            }} />
          <div className="sidebar">
            <form className="card" onSubmit={addSlot}>
              <h2 id="add-slot">Takvime saat ekle</h2>
              <p className="muted">{facility.name} · {dayLabel(atHour(day, '12'))}</p>
              <label>Başlangıç saati (İstanbul)<select name="hour" value={slotHour} disabled={!slotStart}
                onChange={event => setSelectedHour(event.target.value)}>
                {!slotStart && <option value="">Eklenebilecek saat yok</option>}
                {hours.map(hour =>
                  <option key={hour} value={hour} disabled={!freeHours.has(hour)}>{hour}:00</option>)}
              </select></label>
              {slotStart ? <p className="muted">{timeLabel(slotStart)} – {timeLabel(endOfSlot(slotStart))} yayımlanacak.</p>
                : <p className="muted">Yeni bir saat eklemek için başka bir gün seçin.</p>}
              {slotError && <p className="error" role="alert">{slotError}</p>}
              <button disabled={busy || !slotStart}>Saati yayımla</button>
            </form>
            <RulesForm key={facility.id} facility={facility} busy={busy} save={rules => act('facility_rules', { id: facility.id, ...rules })} />
          </div>
        </div>
        <section className="card" aria-labelledby="reservations">
          <div className="sectionTop">
            <div>
              <h2 id="reservations">Rezervasyonlar</h2>
              <p className="muted">{facility.name} · {allDays ? 'Tüm günler' : dayLabel(atHour(day, '12'))}</p>
            </div>
            <label>Rezervasyon durumu<select value={reservationStatus} onChange={event => setReservationStatus(event.target.value)}>
              <option value="all">Tümü</option>
              <option value="confirmed">Onaylandı</option>
              <option value="cancelled">İptal edildi</option>
            </select></label>
          </div>
          {visibleReservations.length === 0 ? <p className="muted">Bu görünümde rezervasyon yok.</p> : <div className="tableWrap"><table>
            <thead><tr><th scope="col">Saat</th><th scope="col">Öğrenci</th><th scope="col">Test ücreti</th><th scope="col">Durum</th></tr></thead>
            <tbody>{visibleReservations.map(item => <tr key={item.id}>
              <th scope="row">{allDays ? dateTime(item.starts_at) : timeLabel(item.starts_at)}</th>
              <td>{item.student_name}</td><td className="tableAmount">{money(item.price)}</td>
              <td><span className={`slotStatus ${item.status === 'confirmed' ? 'slotBooked' : 'slotClosed'}`}>
                {item.status === 'confirmed' ? 'Onaylandı' : 'İptal edildi'}
              </span></td>
            </tr>)}</tbody></table></div>}
        </section>
      </>}
    </main>
  </>
}
