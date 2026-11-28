import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const network = 'zemin-senin-pilot-loopback'
const bindingOption = 'com.docker.network.bridge.host_binding_ipv4'
const existing = spawnSync('docker', ['network', 'inspect', network], { encoding: 'utf8' })
if (existing.status !== 0) {
  execFileSync('docker', ['network', 'create', '--driver', 'bridge', '--opt', `${bindingOption}=127.0.0.1`, network], { stdio: 'inherit' })
}
const [config] = JSON.parse(execFileSync('docker', ['network', 'inspect', network], { encoding: 'utf8' }))
if (config.Options?.[bindingOption] !== '127.0.0.1') throw new Error('Pilot Docker ağı yerel adresle sınırlı olmalı.')

const result = spawnSync(resolve('node_modules/.bin/supabase'), ['start', '--network-id', network], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
