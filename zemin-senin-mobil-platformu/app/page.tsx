'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Dumbbell,
  Flame,
  Gift,
  LayoutGrid,
  MapPin,
  Medal,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  UserRound,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

type Tab = 'home' | 'network' | 'offers' | 'profile'
type Role = 'student' | 'owner'

const facilities = [
  { name: 'Çiftlikköy 1 Nolu Halı Saha', short: 'Halı Saha 1', type: 'football', price: 600, icon: '⚽', tone: 'emerald' },
  { name: 'Çiftlikköy 2 Nolu Halı Saha', short: 'Halı Saha 2', type: 'football', price: 600, icon: '⚽', tone: 'emerald' },
  { name: 'Kapalı Tenis Kortu 1', short: 'Tenis Kortu 1', type: 'tennis', price: 200, icon: '🎾', tone: 'sky' },
  { name: 'Açık Tenis Kortu 2', short: 'Tenis Kortu 2', type: 'tennis', price: 180, icon: '🎾', tone: 'amber' },
]
const slots = ['18:00', '19:00', '20:00', '21:00', '22:00']
const offers = [
  { title: 'Çiftlikköy 3. Dalga Kahve', detail: 'Tüm sıcak içeceklerde', discount: '%30', badge: 'Son 4 Saat', hot: true, color: 'from-amber-100 to-orange-50', icon: '☕' },
  { title: 'Kampüs Burger House', detail: 'Öğrenci menülerinde', discount: '%20', badge: 'Son 2 Gün', color: 'from-emerald-100 to-teal-50', icon: '🍔' },
  { title: 'Üniversite Kırtasiye & Copy Center', detail: 'Tüm baskı ve kırtasiye', discount: '%10', badge: 'Bu hafta', color: 'from-sky-100 to-indigo-50', icon: '✎' },
  { title: 'Çiftlikköy Oto & Halı Yıkama', detail: 'Mekan tanıtımı', discount: 'Tanıtım', badge: 'İşletmeyi keşfet', color: 'from-slate-100 to-slate-50', icon: '✦' },
]

function formatTL(value: number) { return `${value.toLocaleString('tr-TR')} TL` }

export default function Page() {
  const [tab, setTab] = useState<Tab>('home')
  const [role, setRole] = useState<Role>('student')
  const [facility, setFacility] = useState(0)
  const [slot, setSlot] = useState('21:00')
  const [lesson, setLesson] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [join, setJoin] = useState<{title: string; total: number} | null>(null)
  const [requestStatus, setRequestStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const [offerCode, setOfferCode] = useState<string | null>(null)
  const [balance, setBalance] = useState(120)
  const selectedFacility = facilities[facility]
  const total = selectedFacility.price / 10 + (lesson ? 250 : 0)
  const isTennis = selectedFacility.type === 'tennis'
  const activeOffers = useMemo(() => offers, [])

  function reserve() {
    setCode(`${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`)
  }
  function confirmJoin() {
    if (!join) return
    setBalance((value) => value - join.total)
    setRequestStatus('pending')
    setJoin(null)
  }
  function acceptRequest() {
    setRequestStatus('accepted')
    setBalance((value) => value + 40)
  }
  function rejectRequest() {
    setRequestStatus('rejected')
    setBalance((value) => value + 50)
  }

  return (
    <main className="min-h-screen bg-[#e8eee9] px-3 py-5 text-slate-900 sm:px-6">
      <div className="relative mx-auto flex min-h-[840px] w-full max-w-md flex-col overflow-hidden rounded-[40px] border-8 border-slate-900 bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><ShieldCheck /></div>
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-black tracking-tight">Zemin Senin <BadgeCheck className="size-4 fill-emerald-500 text-white" /></div>
              <div className="text-[10px] font-medium text-slate-500">@mersin.edu.tr doğrulandı</div>
            </div>
          </div>
          <button onClick={() => setRole(role === 'student' ? 'owner' : 'student')} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-600 shadow-sm transition-transform active:scale-95" aria-label="Görünüm Değiştir"><MoreHorizontal className="size-4" /> {role === 'student' ? 'Öğrenci' : 'İlan Sahibi'}</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-28">
          {role === 'owner' ? (
            <OwnerView status={requestStatus} onAccept={acceptRequest} onReject={rejectRequest} />
          ) : tab === 'home' ? (
            <HomeView facility={facility} setFacility={setFacility} slot={slot} setSlot={setSlot} lesson={lesson} setLesson={setLesson} total={total} isTennis={isTennis} onReserve={reserve} />
          ) : tab === 'network' ? (
            <NetworkView onJoin={(title, amount) => setJoin({ title, total: amount })} />
          ) : tab === 'offers' ? (
            <OffersView offers={activeOffers} offerCode={offerCode} onUse={(i) => setOfferCode(`MEU-${i === 0 ? 'KAHVE' : i === 1 ? 'BURGER' : 'FIRSAT'}-${Math.floor(100 + Math.random() * 900)}`)} />
          ) : (
            <ProfileView balance={balance} />
          )}
        </div>

        <nav className="absolute bottom-4 left-1/2 z-10 flex w-[calc(100%-40px)] max-w-[360px] -translate-x-1/2 justify-between rounded-3xl border border-slate-200/70 bg-white/85 p-2 shadow-lg backdrop-blur-xl">
          {([['home', CalendarDays, 'Rezervasyon'], ['network', Users, 'Kampüs Ağı'], ['offers', Gift, 'Fırsatlar'], ['profile', UserRound, 'Profil']] as const).map(([key, Icon, label]) => <button key={key} onClick={() => setTab(key)} className={`flex min-w-[72px] flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition-all active:scale-95 ${tab === key ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-slate-400'}`}><Icon className="size-[18px]" />{label}</button>)}
        </nav>
      </div>

      {code && <Modal onClose={() => setCode(null)}><div className="text-center"><div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700"><Check className="size-8" /></div><p className="text-sm font-semibold text-emerald-700">Rezervasyon onaylandı</p><h2 className="mt-1 text-3xl font-black tracking-[0.18em] text-slate-900">{code}</h2><p className="mx-auto mt-3 max-w-[230px] text-xs leading-5 text-slate-500">Tesis girişinde saha görevlisine bu kodu iletiniz.</p><button onClick={() => setCode(null)} className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white active:scale-95">Tamam</button></div></Modal>}
      {join && <Modal onClose={() => setJoin(null)}><div><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold text-emerald-700">Katılım isteği</p><h2 className="mt-1 text-xl font-black">{join.title}</h2></div><button onClick={() => setJoin(null)} className="rounded-full bg-slate-100 p-2"><X className="size-4" /></button></div><div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Provizyon bilgilendirmesi</strong><br />Tutar şu an tahsil edilmez, cüzdandan bloke edilir. İlan sahibi onaylarsa kesinleşir, reddederse serbest kalır.</div><div className="mt-5 flex items-center justify-between"><span className="text-sm text-slate-500">Bloke edilecek tutar</span><strong className="text-xl">{join.total} TL</strong></div><button onClick={confirmJoin} className="mt-5 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 active:scale-95">Provizyonu Onayla</button></div></Modal>}
    </main>
  )
}

function HomeView({ facility, setFacility, slot, setSlot, lesson, setLesson, total, isTennis, onReserve }: { facility: number; setFacility: (v: number) => void; slot: string; setSlot: (v: string) => void; lesson: boolean; setLesson: (v: boolean) => void; total: number; isTennis: boolean; onReserve: () => void }) {
  return <div className="animate-in fade-in duration-300"><div className="mb-6 mt-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Merhaba Tahir</p><h1 className="mt-1 text-[27px] font-black leading-tight tracking-tight">Bugün hangi zemindesin?</h1></div><section><SectionTitle icon={<MapPin className="size-4" />} title="Tesis seç" action="Tümünü gör" /><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">{facilities.map((item, i) => <button key={item.name} onClick={() => setFacility(i)} className={`min-w-[132px] rounded-2xl border p-3 text-left transition-all active:scale-95 ${facility === i ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200/70 bg-white'}`}><span className="text-xl">{item.icon}</span><p className="mt-2 text-xs font-bold leading-4">{item.short}</p><p className="mt-1 text-[10px] text-slate-500">{formatTL(item.price)} / saat</p></button>)}</div></section><section className="mt-6"><SectionTitle icon={<Clock3 className="size-4" />} title="Saat seç" action="Bugün, 31 Eki" /><div className="grid grid-cols-5 gap-2">{slots.map((value) => { const full = value === '20:00'; return <button key={value} disabled={full} onClick={() => setSlot(value)} className={`rounded-2xl border py-3 text-center transition-all active:scale-95 ${full ? 'border-red-100 bg-red-50 text-red-300' : slot === value ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'border-slate-200/70 bg-white text-slate-600'}`}><span className="block text-xs font-black">{value}</span><span className="mt-1 block text-[9px] font-medium">{full ? 'Dolu' : value === '21:00' ? 'Önerilen' : 'Boş'}</span></button>})}</div></section>{isTennis && <button onClick={() => setLesson(!lesson)} className={`mt-5 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${lesson ? 'border-amber-300 bg-amber-50' : 'border-slate-200/70 bg-white'}`}><span className="flex items-center gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><Trophy className="size-4" /></span><span><span className="block text-xs font-bold">Tenis dersi ekle</span><span className="block text-[10px] text-slate-500">Antrenörlü · +250 TL</span></span></span><span className={`flex h-6 w-11 items-center rounded-full p-1 ${lesson ? 'bg-amber-500' : 'bg-slate-200'}`}><span className={`size-4 rounded-full bg-white shadow transition-transform ${lesson ? 'translate-x-5' : ''}`} /></span></button>}<div className="mt-6 rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/10"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rezervasyon özeti</p><p className="mt-2 text-sm font-bold">{selectedLabel(facility)} · {slot}</p></div><div className="text-right"><p className="text-[10px] text-slate-400">Toplam</p><p className="text-xl font-black">{total} TL</p></div></div><button onClick={onReserve} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-white transition-transform active:scale-95"><Ticket className="size-4" /> Rezervasyonu Onayla</button></div></div>
}
function selectedLabel(i: number) { return facilities[i].short }

function NetworkView({ onJoin }: { onJoin: (title: string, amount: number) => void }) { const [filter, setFilter] = useState('Tümü'); const cards = [{ title: 'Çiftlikköy 1 Nolu Halı Saha', sport: '⚽ Halı Saha', time: 'Bugün · 21:00', owner: 'Alican K.', score: 96, need: '1 Kaleci', price: 50, filled: '13/14' }, { title: 'Kapalı Tenis Kortu 2', sport: '🎾 Tenis', time: 'Yarın · 17:00', owner: 'Merve T.', score: 94, need: 'NTRP 3.5 · Orta', price: 40, filled: '1/2' }]; return <div className="animate-in fade-in duration-300"><div className="mb-5 mt-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Kampüs ağı</p><h1 className="mt-1 text-[27px] font-black tracking-tight">Birlikte oynayalım.</h1></div><div className="mb-5 flex gap-2 overflow-x-auto">{['Tümü', '⚽ Halı Saha', '🎾 Tenis', '🏀 Basketbol'].map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-bold active:scale-95 ${filter === item ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>{item}</button>)}</div><div className="flex flex-col gap-4">{cards.filter((c) => filter === 'Tümü' || c.sport === filter).map((card) => <article key={card.title} className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{card.sport}</span><h2 className="mt-3 text-sm font-black">{card.title}</h2><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><CalendarDays className="size-3.5" /> {card.time}</p></div><div className="flex items-center gap-1 text-xs font-black text-amber-600"><Star className="size-3.5 fill-amber-400" /> {card.score}</div></div><div className="my-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-[10px]"><div><p className="text-slate-400">İlan sahibi</p><p className="mt-1 font-bold">{card.owner}</p></div><div><p className="text-slate-400">Aranan</p><p className="mt-1 font-bold">{card.need}</p></div><div><p className="text-slate-400">Kişi başı</p><p className="mt-1 font-bold">{card.price - 5} TL + 5 TL hizmet</p></div><div><p className="text-slate-400">Kontenjan</p><p className="mt-1 font-bold text-emerald-700">{card.filled} dolu</p></div></div><button onClick={() => onJoin(card.title, card.price)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white active:scale-95">{card.price} TL ile Katıl <ChevronRight className="size-4" /></button></article>)}</div></div> }

function OffersView({ offers, offerCode, onUse }: { offers: typeof offers; offerCode: string | null; onUse: (i: number) => void }) { return <div className="animate-in fade-in duration-300"><div className="mb-5 mt-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">MEÜ ayrıcalıkları</p><h1 className="mt-1 text-[27px] font-black tracking-tight">Şehrin fırsatları.</h1></div><div className="-mx-1 mb-6 flex snap-x gap-3 overflow-x-auto px-1 pb-1"><div className="min-w-[270px] snap-center rounded-3xl bg-slate-900 p-5 text-white"><div className="flex justify-between"><Sparkles className="size-5 text-amber-400" /><span className="text-[10px] font-bold text-slate-400">01 / 03</span></div><p className="mt-8 text-xs font-bold text-emerald-300">CAMPUS COFFEE</p><h2 className="mt-1 text-xl font-black">Kahve molası şimdi daha iyi.</h2><p className="mt-2 text-xs text-slate-400">Öğrenciye özel %25 indirim</p></div><div className="min-w-[270px] snap-center rounded-3xl bg-emerald-600 p-5 text-white"><Dumbbell className="size-5 text-emerald-200" /><p className="mt-8 text-xs font-bold text-emerald-100">AKADEMİ GYM</p><h2 className="mt-1 text-xl font-black">Harekete geç.</h2><p className="mt-2 text-xs text-emerald-100">Öğrenci paketini keşfet</p></div></div><div className="flex flex-col gap-3">{offers.map((offer, i) => <article key={offer.title} className={`flex items-center gap-3 rounded-3xl border border-slate-200/70 bg-gradient-to-br ${offer.color} p-4 shadow-sm`}><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">{offer.icon}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="truncate text-xs font-black">{offer.title}</h2>{offer.hot && <Flame className="size-3.5 shrink-0 fill-orange-500 text-orange-500" />}</div><p className="mt-1 text-[10px] text-slate-500">{offer.detail}</p><span className="mt-2 inline-flex rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold text-slate-600">{offer.badge}</span></div><div className="text-right"><p className="text-xl font-black text-emerald-700">{offer.discount}</p>{offer.discount !== 'Tanıtım' && <button onClick={() => onUse(i)} className="mt-2 rounded-xl bg-slate-900 px-2.5 py-2 text-[9px] font-bold text-white active:scale-95">Kodu al</button>}</div></article>)}</div>{offerCode && <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div><p className="text-[10px] font-bold text-emerald-700">Tek kullanımlık kodun</p><p className="mt-1 font-black tracking-widest text-slate-900">{offerCode}</p></div><Copy className="size-4 text-emerald-600" /></div>}</div> }

function ProfileView({ balance }: { balance: number }) { return <div className="animate-in fade-in duration-300"><div className="mb-5 mt-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Profilim</p><h1 className="mt-1 text-[27px] font-black tracking-tight">Sporcu kartın.</h1></div><div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">TA</div></div><div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fair-play skoru</p><p className="mt-1 text-4xl font-black">98<span className="text-lg text-slate-500">/100</span></p></div><Award className="size-7 text-amber-400" /></div><div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4 text-xs"><span className="text-slate-400">Tahir A. · İşletme 4. Sınıf</span><span className="rounded-full bg-white/10 px-2 py-1 font-bold">Onaylı</span></div></div><div className="mt-4 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cüzdan bakiyesi</p><p className="mt-1 text-3xl font-black">{balance} TL</p></div><Wallet className="size-7 text-emerald-600" /></div><div className="mt-5 flex gap-2"><button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white"><ArrowDownLeft className="size-3.5" /> Bakiye yükle</button><button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700"><ArrowUpRight className="size-3.5" /> Çek</button></div></div><div className="mt-6"><SectionTitle icon={<Banknote className="size-4" />} title="Finansal geçmiş" action="Tümü" /><div className="flex flex-col gap-2">{[['Halı Saha Lobi Payı Geliri', '+45,00 TL', 'green'], ['Platform Hizmet Bedeli Kesintisi', '-5,00 TL', 'red'], ['Tenis Provizyon Blokesi', '-40,00 TL', 'red']].map(([a, b, c]) => <div key={a} className="flex items-center justify-between rounded-2xl bg-white p-3"><div><p className="text-xs font-bold">{a}</p><p className="mt-1 text-[10px] text-slate-400">31 Eki 2026 · 14:32</p></div><span className={`text-xs font-black ${c === 'green' ? 'text-emerald-600' : 'text-red-500'}`}>{b}</span></div>)}</div></div></div> }

function OwnerView({ status, onAccept, onReject }: { status: 'pending' | 'accepted' | 'rejected'; onAccept: () => void; onReject: () => void }) { return <div className="animate-in fade-in duration-300"><div className="mb-5 mt-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">İlan sahibi gözü</p><h1 className="mt-1 text-[27px] font-black tracking-tight">Kadroya göz at.</h1></div><div className="rounded-3xl bg-emerald-600 p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Aktif lobin</p><h2 className="mt-2 text-lg font-black">Çiftlikköy 1 Nolu<br />Halı Saha</h2></div><Trophy className="size-8 text-emerald-200" /></div><div className="mt-6 flex items-center justify-between border-t border-white/20 pt-4"><span className="text-xs text-emerald-100">Bugün · 21:00</span><span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{status === 'accepted' ? '14/14' : '13/14'} dolu</span></div></div><div className="mt-5"><SectionTitle icon={<Users className="size-4" />} title="Gelen istek" action="1 başvuru" />{status === 'pending' ? <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black">TA</div><div><h2 className="text-sm font-black">Tahir A.</h2><p className="mt-1 text-xs text-slate-500">Kaleci · Fair-Play skoru 98</p></div><span className="ml-auto rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">Beklemede</span></div><div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Tahir A. lobine katılmak istiyor. Provizyon tutarı <strong>50 TL</strong> bloke edildi.</div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={onReject} className="rounded-2xl border border-red-100 bg-red-50 py-3 text-xs font-black text-red-600 active:scale-95">Reddet</button><button onClick={onAccept} className="rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white active:scale-95">Kabul Et</button></div></div> : <div className={`rounded-3xl p-5 text-center ${status === 'accepted' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white"><Check className="size-6" /></div><p className="mt-3 text-sm font-black">{status === 'accepted' ? 'Kadro tamamlandı' : 'İstek reddedildi'}</p><p className="mt-1 text-xs">{status === 'accepted' ? '45 TL lobi payı bakiyene eklendi.' : '50 TL provizyon Tahir\'e iade edildi.'}</p></div>}</div></div> }

function SectionTitle({ icon, title, action }: { icon: React.ReactNode; title: string; action: string }) { return <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black">{icon}<span>{title}</span></h2><button className="text-[10px] font-bold text-emerald-700">{action}</button></div> }
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/35 px-3 pb-3 backdrop-blur-sm sm:items-center"><div className="w-full max-w-md rounded-[32px] bg-white p-5 shadow-2xl"><button onClick={onClose} className="sr-only">Kapat</button>{children}</div></div> }
