import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { localSettings } from './local-settings.mjs'

const base = new URL(process.env.PILOT_DB_URL ?? localSettings().DB_URL)
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Test veritabanı yerel olmalı.')
const name = `zemin_test_${randomUUID().replaceAll('-', '')}`
const admin = new Client({ connectionString: base.href })
const connections = []
const actor = {
  a: 'aaaa0000-0000-4000-8000-000000000001',
  b: 'aaaa0000-0000-4000-8000-000000000002',
  c: 'aaaa0000-0000-4000-8000-000000000003',
  staff: 'aaaa0000-0000-4000-8000-000000000004',
  low: 'aaaa0000-0000-4000-8000-000000000005',
}
await admin.connect()
let created = false

async function connect() {
  const connection = new Client({ connectionString: base.href })
  await connection.connect()
  connections.push(connection)
  return connection
}

async function login(connection, id) {
  await connection.query('set role authenticated')
  await connection.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
}

async function action(connection, operation, payload, id = randomUUID()) {
  const result = await connection.query('select public.pilot_action($1,$2,$3) as value', [operation, payload, id])
  return result.rows[0].value.id
}

const dashboard = async connection => (await connection.query('select public.pilot_dashboard() as value')).rows[0].value

try {
  await admin.query(`create database ${name} template template0`)
  created = true
  base.pathname = `/${name}`
  const db = await connect()
  await db.query(`
    do $$begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end$$;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  `)
  await db.query(await readFile('supabase/migrations/20261128000100_pilot.sql', 'utf8'))
  const students = await Promise.all([connect(), connect(), connect(), connect()])
  const [a, b, c, low] = students
  const staff = await connect()
  for (const [label, id] of Object.entries(actor)) {
    await db.query('insert into auth.users values ($1)', [id])
    await db.query('insert into pilot.profiles values ($1,$2,$3)', [id, label, label === 'staff' ? 'staff' : 'student'])
    if (['a', 'b', 'c'].includes(label)) {
      await db.query("insert into pilot.ledger(member,kind,reference,amount) values ($1,'initial_credit',$1,100000)", [id])
    }
  }

  const facility = (await db.query("insert into pilot.facilities(name,sport,price) values ('Saha A','Futbol',60000),('Saha B','Futbol',20000) returning id")).rows
  await db.query('insert into pilot.staff_facilities values ($1,$2)', [actor.staff, facility[0].id])
  const slots = (await db.query(`insert into pilot.slots(facility,starts_at,published)
    select $1, date_trunc('hour',now()) + hours * interval '1 hour', hours <> 48
    from unnest(array[24,48,72,1,-2,240]) hours returning id, starts_at`, [facility[0].id])).rows
  await Promise.all([login(a, actor.a), login(b, actor.b), login(c, actor.c), login(low, actor.low), login(staff, actor.staff)])

  await assert.rejects(a.query('select * from pilot.ledger'), /permission denied/)
  assert.equal((await dashboard(staff)).facilities.length, 1)
  await assert.rejects(action(staff, 'facility_rules', { id: facility[1].id, price: 1, advance_days: 1, cancel_minutes: 1 }), /FORBIDDEN/)
  await assert.rejects(action(a, 'publish_slot', { id: slots[1].id, published: true }), /FORBIDDEN/)
  await assert.rejects(action(low, 'reserve', { id: slots[0].id, price: 60000 }), /INSUFFICIENT_BALANCE/)
  for (const slot of [slots[1], slots[4], slots[5]]) {
    await assert.rejects(action(a, 'reserve', { id: slot.id, price: 60000 }), /INVALID_SLOT/)
  }
  await assert.rejects(action(a, 'reserve', { id: slots[0].id, price: 59000 }), /PRICE_CHANGED/)
  const slotPayload = { id: slots[0].id, price: 60000 }
  const first = randomUUID()
  const second = randomUUID()
  const race = await Promise.allSettled([action(a, 'reserve', slotPayload, first), action(b, 'reserve', slotPayload, second)])
  const [owner, rival, ownerRequest] = race[0].status === 'fulfilled' ? [a, b, first] : [b, a, second]
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1)
  assert.match(race.find(result => result.status === 'rejected').reason.message, /SLOT_TAKEN/)
  const reservation = await action(owner, 'reserve', slotPayload, ownerRequest)
  assert.equal((await dashboard(owner)).balance, 40000)
  assert.equal((await dashboard(rival)).balance, 100000)
  await assert.rejects(action(owner, 'reserve', { id: slots[2].id, price: 60000 }, ownerRequest), /REQUEST_REUSED/)
  await assert.rejects(action(rival, 'create_listing', { id: reservation, description: 'Test', capacity: 1, price: 5000 }), /FORBIDDEN/)
  const listing = await action(owner, 'create_listing', { id: reservation, description: 'Test', capacity: 1, price: 5000 })
  const pendingA = await action(rival, 'apply', { id: listing })
  const pendingB = await action(c, 'apply', { id: listing })
  await assert.rejects(action(rival, 'apply', { id: listing }), /ALREADY_EXISTS/)
  await assert.rejects(action(rival, 'decide', { id: pendingA, accepted: true }), /FORBIDDEN/)
  assert.equal((await dashboard(rival)).applications.length, 1)
  const decisions = await Promise.allSettled([
    action(owner, 'decide', { id: pendingA, accepted: true }), actionForSameActor(pendingB),
  ])
  assert.equal(decisions.filter(result => result.status === 'fulfilled').length, 1)
  assert.match(decisions.find(result => result.status === 'rejected').reason.message, /LISTING_FULL/)
  const denied = decisions[0].status === 'fulfilled' ? pendingB : pendingA
  await action(owner, 'decide', { id: denied, accepted: false })
  const cancelId = randomUUID()
  await action(owner, 'cancel', { id: reservation }, cancelId)
  await action(owner, 'cancel', { id: reservation }, cancelId)
  assert.equal((await dashboard(owner)).balance, 100000)
  assert.equal((await dashboard(rival)).balance, 100000)
  assert.equal((await dashboard(c)).balance, 100000)
  assert.equal((await dashboard(owner)).listings[0].status, 'cancelled')
  assert.equal((await dashboard(rival)).slots.find(slot => slot.id === slots[0].id).booked, false)

  const late = await action(owner, 'reserve', { id: slots[3].id, price: 60000 })
  await assert.rejects(action(owner, 'cancel', { id: late }), /CANCELLATION_CLOSED/)
  await action(staff, 'publish_slot', { id: slots[1].id, published: true })
  assert.equal((await dashboard(a)).slots.some(slot => slot.id === slots[1].id), true)
  await action(staff, 'add_slot', { id: facility[0].id, starts_at: new Date(Math.floor(Date.now() / 3600000) * 3600000 + 96 * 3600000).toISOString() })

  const live = await action(owner, 'create_listing', { id: late, description: 'Oyun', capacity: 2, price: 5000 })
  const accepted = await action(rival, 'apply', { id: live })
  const expires = await action(c, 'apply', { id: live })
  await action(owner, 'decide', { id: accepted, accepted: true })
  await db.query('update pilot.slots set starts_at = $2::timestamptz - interval \'1 hour\' where id = $1', [slots[3].id, slots[4].starts_at])
  await db.query('select pilot.settle_due(); select pilot.settle_due()')
  assert.equal((await dashboard(owner)).balance, 44500)
  assert.equal((await dashboard(rival)).balance, 95000)
  assert.equal((await dashboard(c)).balance, 100000)
  const status = (await db.query('select status from pilot.applications where id = $1', [expires])).rows[0].status
  assert.equal(status, 'expired')
  const fee = (await db.query("select sum(amount)::int as amount from pilot.ledger where kind = 'platform_fee'")).rows[0].amount
  assert.equal(fee, 500)
  console.log('Veritabanı testleri geçti: yetkiler, eşzamanlı rezervasyon ve kontenjan, bakiye, idempotency, iptal ve maç başlangıcı.')

  async function actionForSameActor(id) {
    const connection = await connect()
    await login(connection, owner === a ? actor.a : actor.b)
    return action(connection, 'decide', { id, accepted: true })
  }
} finally {
  await Promise.all(connections.map(connection => connection.end()))
  if (created) await admin.query(`drop database ${name}`)
  await admin.end()
}
