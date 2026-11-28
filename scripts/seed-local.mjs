import { writeFile } from 'node:fs/promises'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { localSettings } from './local-settings.mjs'

const config = localSettings()
if (new URL(config.API_URL).hostname !== '127.0.0.1' || new URL(config.DB_URL).hostname !== '127.0.0.1') {
  throw new Error('Bu komut yalnızca yerel Supabase ortamına test verisi ekler.')
}

const auth = createClient(config.API_URL, config.SERVICE_ROLE_KEY ?? config.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin
const accounts = [
  ['ogrenci1@example.com', 'Deniz Y.', 'student'],
  ['ogrenci2@example.com', 'Ece A.', 'student'],
  ['gorevli@example.com', 'Tesis Görevlisi', 'staff'],
]
const football = '10000000-0000-4000-8000-000000000001'
const tennis = '10000000-0000-4000-8000-000000000002'
const db = new Client({ connectionString: config.DB_URL })
await db.connect()

try {
  const existing = new Map()
  for (let page = 1; ; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: 100 })
    if (error) throw error
    for (const account of data.users) existing.set(account.email, account.id)
    if (data.users.length < 100) break
  }

  const provisioned = []
  for (const [email, name, role] of accounts) {
    let id = existing.get(email)
    if (!id) {
      const { data, error } = await auth.createUser({ email, email_confirm: true })
      if (error) throw error
      id = data.user.id
    }
    provisioned.push({ id, name, role })
  }

  await db.query('begin')
  await db.query(`insert into pilot.facilities(id,name,sport,price) values
    ($1,'Çiftlikköy Halı Saha','Halı saha',60000),($2,'Kapalı Tenis Kortu','Tenis',20000)
    on conflict do nothing`, [football, tennis])

  for (const { id, name, role } of provisioned) {
    await db.query('insert into pilot.profiles(id,name,role) values ($1,$2,$3) on conflict do nothing', [id, name, role])
    if (role === 'staff') {
      await db.query('insert into pilot.staff_facilities values ($1,$2) on conflict do nothing', [id, football])
    } else {
      await db.query(`insert into pilot.ledger(member,kind,reference,amount)
        values ($1,'initial_credit',$1,100000) on conflict do nothing`, [id])
    }
  }

  await db.query(`insert into pilot.slots(facility,starts_at)
    select f.id, (date_trunc('day', now() at time zone 'Europe/Istanbul') + d * interval '1 day'
      + h * interval '1 hour') at time zone 'Europe/Istanbul'
    from pilot.facilities f cross join generate_series(1,3) d cross join generate_series(18,21) h
    where f.id in ($1,$2) on conflict do nothing`, [football, tennis])
  await db.query('commit')
} catch (error) {
  await db.query('rollback')
  throw error
} finally {
  await db.end()
}

const key = config.PUBLISHABLE_KEY ?? config.ANON_KEY
for (const [file, prefix] of [['apps/mobile/.env.local', 'EXPO_PUBLIC'], ['apps/staff/.env.local', 'NEXT_PUBLIC']]) {
  try {
    await writeFile(file, `${prefix}_SUPABASE_URL=${config.API_URL}\n${prefix}_SUPABASE_KEY=${key}\n`, { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    console.log(`${file} zaten mevcut ve korundu.`)
  }
}
console.log('Yerel test hesapları ve örnek tesis saatleri hazır.')
