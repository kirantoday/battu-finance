import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const newsRoutes = new Hono()

newsRoutes.get('/:ticker', (c) => c.json(NOT_IMPLEMENTED))
