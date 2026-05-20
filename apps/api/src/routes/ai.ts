import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const aiRoutes = new Hono()

aiRoutes.post('/query', (c) => c.json(NOT_IMPLEMENTED))
