'use client'

import { useEffect, useRef, useState } from 'react'
import { dateTime, dayKey, dayLabel, endOfSlot, timeLabel, type Slot } from '@zemin/pilot'

type Props = {
  facilityName: string
  slots: Slot[]
  showDates: boolean
  studentsByStart: ReadonlyMap<number, string>
  busy: boolean
  error: string
  changePublication: (slot: Slot) => Promise<boolean>
}

export function SlotCalendar({ facilityName, slots, showDates, studentsByStart, busy, error, changePublication }: Props) {
  const [selected, setSelected] = useState<Slot | null>(null)
  const [failed, setFailed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const available = slots.filter(slot => !slot.booked && slot.published).length
  const booked = slots.filter(slot => slot.booked).length
  const closed = slots.length - available - booked

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal()
  }, [selected])

  async function confirm() {
    if (!selected) return
    setFailed(false)
    if (await changePublication(selected)) dialog.current?.close()
    else setFailed(true)
  }

  return <section className="card calendar" aria-labelledby="calendar-title">
    <div className="sectionTop">
      <div>
        <h2 id="calendar-title">Saat planı</h2>
        <p className="muted">{facilityName} · İstanbul saati</p>
      </div>
    </div>
    <dl className="calendarCounts">
      <div><dt>Açık ve boş</dt><dd>{available}</dd></div>
      <div><dt>Rezerve</dt><dd>{booked}</dd></div>
      <div><dt>Kapalı</dt><dd>{closed}</dd></div>
    </dl>
    {slots.length === 0 ? <p className="muted">Bu görünümde yayımlanmış veya kapatılmış saat yok.</p> : <div className="tableWrap"><table>
      <thead><tr><th scope="col">Saat</th><th scope="col">Durum</th><th scope="col">İşlem</th></tr></thead>
      <tbody>{slots.map((slot, index) => {
        const key = dayKey(slot.starts_at)
        const student = studentsByStart.get(Date.parse(slot.starts_at))
        const showDay = showDates && (index === 0 || dayKey(slots[index - 1].starts_at) !== key)
        return <tr key={slot.id}>
          <th scope="row">
            <span className={showDay ? 'slotDay' : 'visuallyHidden'}>{dayLabel(slot.starts_at)}</span>
            <span className="slotTime">{timeLabel(slot.starts_at)} – {timeLabel(endOfSlot(slot.starts_at))}</span>
          </th>
          <td>
            <span className={`slotStatus ${slot.booked ? 'slotBooked' : slot.published ? 'slotOpen' : 'slotClosed'}`}>
              {slot.booked ? 'Rezerve' : slot.published ? 'Açık' : 'Kapalı'}
            </span>
            {slot.booked && student && <span className="slotStudent">{student}</span>}
          </td>
          <td>{slot.booked ? '—' : <button className="secondary rowAction" disabled={busy}
            aria-label={`${dateTime(slot.starts_at)} · ${slot.published ? 'Saati kapat' : 'Saati yayımla'}`}
            onClick={() => { setSelected(slot); setFailed(false) }}>{slot.published ? 'Kapat' : 'Yayımla'}</button>}</td>
        </tr>
      })}</tbody>
    </table></div>}

    <dialog ref={dialog} aria-labelledby="slot-dialog-title" onClose={() => { setSelected(null); setFailed(false) }}
      onCancel={event => { if (busy) event.preventDefault() }}>
      {selected && <div className="dialogBody">
        <h2 id="slot-dialog-title">{selected.published ? 'Saati kapat' : 'Saati yayımla'}</h2>
        <p><strong>{facilityName}</strong></p>
        <p>{dateTime(selected.starts_at)} – {timeLabel(endOfSlot(selected.starts_at))}</p>
        <p className="muted">{selected.published ? 'Bu saat öğrencilere gösterilmeyecek.' : 'Bu saat rezervasyon penceresi içinde öğrencilere gösterilecek.'}</p>
        {failed && error && <p className="error" role="alert">{error}</p>}
        <div className="dialogActions">
          <button className="secondary" type="button" autoFocus disabled={busy} onClick={() => dialog.current?.close()}>Vazgeç</button>
          <button type="button" disabled={busy} onClick={() => void confirm()}>{selected.published ? 'Saati kapat' : 'Saati yayımla'}</button>
        </div>
      </div>}
    </dialog>
  </section>
}
