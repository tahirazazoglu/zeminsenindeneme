import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { localSettings } from './local-settings.mjs'

const settings = localSettings()
const inbox = settings.INBUCKET_URL ?? settings.MAILPIT_URL ?? 'http://127.0.0.1:55324'
for (const endpoint of [settings.API_URL, inbox]) {
  assert.equal(new URL(endpoint).hostname, '127.0.0.1')
}
const app = () => createClient(settings.API_URL, settings.PUBLISHABLE_KEY ?? settings.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function mail(path) {
  const response = await fetch(inbox + '/api/v1/' + path)
  assert.ok(response.ok, `Mailpit HTTP ${response.status}`)
  return response.json()
}

async function login(email) {
  const client = app()
  const previous = new Set((await mail('messages')).messages?.map(item => item.ID))
  const sent = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  assert.ifError(sent.error)
  for (let i = 0; i < 20; i++) {
    const list = await mail('messages')
    const item = list.messages?.find(message => !previous.has(message.ID) && message.To.some(person => person.Address === email))
    if (item) {
      const message = await mail('message/' + item.ID)
      const token = (message.Text + ' ' + message.HTML).match(/\b\d{6}\b/)?.[0]
      assert.ok(token, 'E-postada giriş kodu bulunmalı.')
      const verified = await client.auth.verifyOtp({ email, token, type: 'email' })
      assert.ifError(verified.error)
      return client
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('Giriş e-postası ulaşmadı.')
}

async function dashboard(client) {
  const { data, error } = await client.rpc('pilot_dashboard')
  assert.ifError(error)
  return data
}

async function change(client, operation, payload, id = randomUUID()) {
  const { data, error } = await client.rpc('pilot_action', { operation, payload, request_id: id })
  assert.ifError(error)
  return data.id
}

const guest = app()
assert.ok((await guest.auth.signInWithOtp({ email: 'davet-disi@example.com', options: { shouldCreateUser: false } })).error)
assert.ok((await guest.rpc('pilot_dashboard')).error)
assert.ok((await guest.auth.signUp({ email: 'davet-disi@example.com', password: randomUUID() })).error)
const student = await login('ogrenci1@example.com')
const member = await login('ogrenci2@example.com')
const staff = await login('gorevli@example.com')
const studentData = await dashboard(student)
const memberBalance = (await dashboard(member)).balance
const staffData = await dashboard(staff)
assert.equal(studentData.profile.role, 'student')
assert.equal(staffData.profile.role, 'staff')
assert.equal(staffData.facilities.length, 1)
const facility = staffData.facilities[0]
const start = new Date(Math.floor(Date.now() / 3600000) * 3600000 + 6 * 86400000).toISOString()
const oldSlot = staffData.slots.find(slot => Date.parse(slot.starts_at) === Date.parse(start))
const slot = oldSlot?.id ?? await change(staff, 'add_slot', { id: facility.id, starts_at: start })
if (oldSlot && !oldSlot.published) await change(staff, 'publish_slot', { id: slot, published: true })
const requestId = randomUUID()
const booking = await change(student, 'reserve', { id: slot, price: facility.price }, requestId)
assert.equal(await change(student, 'reserve', { id: slot, price: facility.price }, requestId), booking)
assert.equal((await dashboard(student)).balance, studentData.balance - facility.price)
assert.ok((await dashboard(staff)).reservations.some(item => item.id === booking))
const listing = await change(student, 'create_listing', {
  id: booking, capacity: 1, price: 5000, description: 'Yerel pilot akış testi',
})
const request = await change(member, 'apply', { id: listing })
assert.equal((await dashboard(member)).balance, memberBalance - 5000)
await change(student, 'decide', { id: request, accepted: true })
assert.equal((await dashboard(student)).listings.find(item => item.id === listing).filled, 1)
await change(student, 'cancel', { id: booking })
assert.equal((await dashboard(student)).balance, studentData.balance)
assert.equal((await dashboard(member)).balance, memberBalance)
assert.equal((await dashboard(staff)).reservations.find(item => item.id === booking).status, 'cancelled')
await change(staff, 'publish_slot', { id: slot, published: false })
assert.ok(!(await dashboard(student)).slots.some(item => item.id === slot))
console.log('HTTP testleri geçti: davet ve OTP, görevli takvimi, rezervasyon, ilan, kabul ve iade.')
