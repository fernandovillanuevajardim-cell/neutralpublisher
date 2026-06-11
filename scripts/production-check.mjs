import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_BUCKET',
  'VITE_ENABLE_CLOUD_UPLOAD',
  'VITE_BASE_PATH',
]

const requiredFiles = [
  'dist/index.html',
  'dist/manifest.webmanifest',
  'dist/sw.js',
  'public/_headers',
  'backend/supabase/schema.sql',
  'backend/supabase/storage-policies.sql',
  'firebase.json',
  'vercel.json',
  'netlify.toml',
]

const results = []

const pass = (message) => results.push({ ok: true, message })
const fail = (message) => results.push({ ok: false, message })

for (const file of requiredFiles) {
  if (existsSync(resolve(file))) {
    pass(`Found ${file}`)
  } else {
    fail(`Missing ${file}`)
  }
}

for (const name of requiredEnv) {
  if (process.env[name]) {
    pass(`Env ${name} is set`)
  } else {
    fail(`Env ${name} is missing`)
  }
}

if (process.env.VITE_ENABLE_CLOUD_UPLOAD === 'true') {
  pass('Cloud upload explicitly enabled')
} else {
  fail('VITE_ENABLE_CLOUD_UPLOAD must be true for production cloud upload')
}

if (process.env.VITE_SUPABASE_URL?.startsWith('https://')) {
  pass('Supabase URL uses HTTPS')
} else {
  fail('VITE_SUPABASE_URL must start with https://')
}

if (existsSync(resolve('public/_headers'))) {
  const headers = readFileSync(resolve('public/_headers'), 'utf8')
  for (const header of [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]) {
    if (headers.includes(header)) {
      pass(`Security header configured: ${header}`)
    } else {
      fail(`Security header missing: ${header}`)
    }
  }
}

if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
  try {
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (response.ok) {
      pass('Supabase Auth endpoint reachable')
    } else {
      fail(`Supabase Auth endpoint returned ${response.status}`)
    }
  } catch (error) {
    fail(`Supabase Auth endpoint failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const failures = results.filter((result) => !result.ok)

for (const result of results) {
  console.log(`${result.ok ? 'OK' : 'FAIL'} ${result.message}`)
}

if (failures.length) {
  console.error(`\nProduction check failed with ${failures.length} issue(s).`)
  process.exit(1)
}

console.log('\nProduction check passed.')
