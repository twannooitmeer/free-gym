import {
  Forbidden,
  type Access,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type FieldAccess,
} from 'payload'

/**
 * Role helpers based on which auth collection the logged-in user belongs to.
 * Payload sets `user.collection` to the slug of the collection used to log in.
 */

export const isAdmin: Access = ({ req: { user } }) => user?.collection === 'admins'

export const isAdminField: FieldAccess = ({ req: { user } }) => user?.collection === 'admins'

type AuthCollection = 'admins' | 'customers' | 'teachers'

/**
 * Admins, or the logged-in user acting on their own document in `collection`.
 *
 * The collection check is the point. IDs are per-table serials, so customer
 * #3 and teacher #3 both exist; comparing ids alone would let either one
 * read and update the other (including its password over the REST API).
 */
export const isAdminOrSelf =
  (collection: AuthCollection): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (user.collection === 'admins') return true
    if (user.collection !== collection) return false
    return { id: { equals: user.id } }
  }

export const isAdminOrSelfField =
  (collection: AuthCollection): FieldAccess =>
  ({ req: { user }, id, doc }) => {
    if (!user) return false
    if (user.collection === 'admins') return true
    if (user.collection !== collection) return false
    const targetId = id ?? doc?.id
    return targetId !== undefined && String(targetId) === String(user.id)
  }

export const anyone: Access = () => true

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const isCustomer: Access = ({ req: { user } }) => user?.collection === 'customers'

export const isTeacher: Access = ({ req: { user } }) => user?.collection === 'teachers'

/**
 * Refuse creates that arrive over the REST or GraphQL API from anyone but
 * an admin. Collection `create` access does not cover this: Payload's
 * built-in POST /api/<collection>/first-register creates the first
 * document of an empty auth collection with overrideAccess, so on a fresh
 * install anyone could otherwise register the first teacher. Server code
 * (the signup action, the seed) uses the local API and is unaffected.
 */
export const onlyAdminsCreateOverApi: CollectionBeforeOperationHook = ({ operation, req, args }) => {
  if (operation === 'create' && req.payloadAPI !== 'local' && req.user?.collection !== 'admins') {
    throw new Forbidden(req.t)
  }
  return args
}

/** A login email changes only through an admin (it is how the account is recovered). */
export const onlyAdminsChangeEmail: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (
    operation === 'update' &&
    req.user?.collection !== 'admins' &&
    typeof data?.email === 'string' &&
    originalDoc?.email &&
    data.email.trim().toLowerCase() !== String(originalDoc.email).toLowerCase()
  ) {
    throw new Forbidden(req.t)
  }
  return data
}
