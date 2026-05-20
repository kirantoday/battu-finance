import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const ownershipRoutes = new Hono()

ownershipRoutes.get('/:ticker', (c) => c.json(NOT_IMPLEMENTED))
