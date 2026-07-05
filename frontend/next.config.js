const fs = require('fs')
const path = require('path')

/**
 * Minimal .env parser (no dependency needed) for the single project-root .env
 * file shared with the backend. Existing process.env values (e.g. real env
 * vars set in production) still take priority over what's in the file.
 */
function loadRootEnv() {
  const envPath = path.join(__dirname, '../.env')
  if (!fs.existsSync(envPath)) return {}

  const parsed = {}
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    parsed[key] = value
  }
  return parsed
}

const rootEnv = loadRootEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || rootEnv.NEXT_PUBLIC_API_URL || 'http://localhost:4001',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      rootEnv.GOOGLE_CLIENT_ID ||
      '103998945467-3e3ghetqb4m5b4d6pvauhmsva7ltr902.apps.googleusercontent.com',
  },
}

module.exports = nextConfig
