import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export function localSettings() {
  return JSON.parse(execFileSync(resolve('node_modules/.bin/supabase'), ['status', '-o', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }))
}
