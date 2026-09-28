import type { Access, FieldAccess } from 'payload'
import { describe, expect, it } from 'vitest'

import { onlyAdminsChangeEmail, onlyAdminsCreateOverApi } from '@/access/roles'
import { Bookings } from '@/collections/Bookings'
import { Customers } from '@/collections/Customers'
import { Media } from '@/collections/Media'
import { Memberships } from '@/collections/Memberships'
import { Teachers } from '@/collections/Teachers'

/**
 * Customer and teacher ids are separate serials, so the same number exists
 * in both tables. Self-access must be scoped to the user's own collection,
 * or customer #N could update teacher #N's password over REST (and the
 * reverse). These call the real access functions from the collection
 * configs, so a regression in either collection fails here.
 */

type User = { id: number; collection: 'admins' | 'customers' | 'teachers' }

const call = (fn: Access | undefined, user: User | null) =>
  (fn as Access)({ req: { user } } as never)

const callField = (fn: FieldAccess | undefined, user: User | null, id: number) =>
  (fn as FieldAccess)({ req: { user }, id } as never)

const field = (name: string) =>
  Customers.fields.find((f) => 'name' in f && f.name === name) as {
    access?: { read?: FieldAccess }
  }

describe('self access is scoped to the user collection', () => {
  const customer3: User = { id: 3, collection: 'customers' }
  const teacher3: User = { id: 3, collection: 'teachers' }
  const admin: User = { id: 1, collection: 'admins' }

  it('a customer reads only their own customer record (and updates it only via the site)', () => {
    expect(call(Customers.access?.read, customer3)).toEqual({ id: { equals: 3 } })
    expect(call(Customers.access?.update, customer3)).toBe(false)
  })

  it('a teacher cannot read or update the customer with the same id', () => {
    expect(call(Customers.access?.read, teacher3)).toBe(false)
    expect(call(Customers.access?.update, teacher3)).toBe(false)
  })

  it('a customer cannot update the teacher with the same id', () => {
    expect(call(Teachers.access?.update, customer3)).toBe(false)
    expect(call(Teachers.access?.update, teacher3)).toEqual({ id: { equals: 3 } })
  })

  it('customer contact fields are hidden from the teacher with the same id', () => {
    for (const name of ['phone', 'dateOfBirth']) {
      const read = field(name).access?.read
      expect(callField(read, customer3, 3)).toBe(true)
      expect(callField(read, teacher3, 3)).toBe(false)
      expect(callField(read, customer3, 4)).toBe(false)
    }
  })

  it('admins keep full access, anonymous users get none', () => {
    expect(call(Customers.access?.update, admin)).toBe(true)
    expect(call(Teachers.access?.update, admin)).toBe(true)
    expect(call(Customers.access?.read, null)).toBe(false)
  })
})

describe('media uploads', () => {
  it('only admins may upload, change or delete files', () => {
    const customer: User = { id: 3, collection: 'customers' }
    const teacher: User = { id: 3, collection: 'teachers' }
    const admin: User = { id: 1, collection: 'admins' }
    for (const op of ['create', 'update', 'delete'] as const) {
      expect(call(Media.access?.[op], customer)).toBe(false)
      expect(call(Media.access?.[op], teacher)).toBe(false)
      expect(call(Media.access?.[op], admin)).toBe(true)
    }
    expect(call(Media.access?.read, null)).toBe(true)
  })
})

describe('customers write only through the site, never the API', () => {
  const customer: User = { id: 3, collection: 'customers' }
  const teacher: User = { id: 3, collection: 'teachers' }
  const admin: User = { id: 1, collection: 'admins' }

  it('bookings: only admins create, update or delete over the API', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
      expect(call(Bookings.access?.[op], customer)).toBe(false)
      expect(call(Bookings.access?.[op], teacher)).toBe(false)
      expect(call(Bookings.access?.[op], null)).toBe(false)
      expect(call(Bookings.access?.[op], admin)).toBe(true)
    }
  })

  it('customers: no self sign-up or self update over the API', () => {
    expect(call(Customers.access?.create, null)).toBe(false)
    expect(call(Customers.access?.create, customer)).toBe(false)
    expect(call(Customers.access?.update, customer)).toBe(false)
    expect(call(Customers.access?.create, admin)).toBe(true)
  })

  it("a membership's notes and payment reference are admin-only", () => {
    for (const name of ['notes', 'paymentReference']) {
      const f = Memberships.fields.find((x) => 'name' in x && x.name === name) as {
        access?: { read?: FieldAccess }
      }
      expect(callField(f.access?.read, customer, 1)).toBe(false)
      expect(callField(f.access?.read, admin, 1)).toBe(true)
    }
  })
})

describe('first-register and other API creates of people', () => {
  const run = (payloadAPI: string, user: User | null) =>
    (onlyAdminsCreateOverApi as (a: unknown) => unknown)({
      operation: 'create',
      args: {},
      req: { payloadAPI, user, t: (k: string) => k },
    })

  it('refuses anonymous and non-admin creates over REST and GraphQL', () => {
    expect(() => run('REST', null)).toThrow()
    expect(() => run('GraphQL', null)).toThrow()
    expect(() => run('REST', { id: 3, collection: 'customers' })).toThrow()
  })

  it('lets admins and server code through', () => {
    expect(() => run('REST', { id: 1, collection: 'admins' })).not.toThrow()
    expect(() => run('local', null)).not.toThrow()
  })

  it('is installed on customers and teachers', () => {
    expect(Customers.hooks?.beforeOperation).toContain(onlyAdminsCreateOverApi)
    expect(Teachers.hooks?.beforeOperation).toContain(onlyAdminsCreateOverApi)
  })
})

describe('login emails', () => {
  const run = (user: User | null, email: string) =>
    (onlyAdminsChangeEmail as (a: unknown) => unknown)({
      operation: 'update',
      data: { email },
      originalDoc: { email: 'coach@example.test' },
      req: { user, t: (k: string) => k },
    })

  it('a teacher cannot change their own login email; admins can', () => {
    expect(() => run({ id: 3, collection: 'teachers' }, 'other@example.test')).toThrow()
    expect(() => run({ id: 3, collection: 'teachers' }, 'Coach@example.test')).not.toThrow()
    expect(() => run({ id: 1, collection: 'admins' }, 'other@example.test')).not.toThrow()
    expect(Teachers.hooks?.beforeChange).toContain(onlyAdminsChangeEmail)
  })
})

describe('document locks', () => {
  it('are off on every collection and global, so there is no lock collection to abuse', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const cfg = await configPromise
    for (const c of cfg.collections.filter((c) => !c.slug.startsWith('payload-'))) {
      expect(c.lockDocuments, c.slug).toBe(false)
    }
    for (const g of cfg.globals) expect(g.lockDocuments, g.slug).toBe(false)
    expect(cfg.collections.some((c) => (c.slug as string) === 'payload-locked-documents')).toBe(false)
  })
})
