import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const marketRoutes = new Hono()

marketRoutes.get('/price/:ticker',     (c) => c.json(NOT_IMPLEMENTED))
marketRoutes.get('/ohlcv/:ticker',     (c) => c.json(NOT_IMPLEMENTED))
marketRoutes.get('/movers/:direction', (c) => c.json(NOT_IMPLEMENTED))
