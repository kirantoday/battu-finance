import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const liqRoutes = new Hono()

liqRoutes.get('/:ticker',           (c) => c.json(NOT_IMPLEMENTED))
liqRoutes.post('/:ticker/refresh',  (c) => c.json(NOT_IMPLEMENTED))
