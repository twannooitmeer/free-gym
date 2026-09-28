'use server'

import { login, logout } from '@payloadcms/next/auth'

import config from '@/payload.config'

type Result = { ok: true } | { ok: false }

/**
 * Sign in on the public site. Payload checks the password, applies its
 * failed-attempt lockout and sets its HTTP-only session cookie. Every
 * failure reads the same to the caller, so the form cannot be used to
 * probe which emails exist.
 */
export async function signIn(
  role: 'customer' | 'teacher',
  email: string,
  password: string,
): Promise<Result> {
  try {
    await login({
      collection: role === 'teacher' ? 'teachers' : 'customers',
      config,
      email: email.trim().toLowerCase(),
      password,
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function signOut(): Promise<void> {
  await logout({ config })
}
