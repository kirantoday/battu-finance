import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const userRoutes = new Hono()

userRoutes.get('/watchlist',         (c) => c.json(NOT_IMPLEMENTED))
userRoutes.post('/watchlist',        (c) => c.json(NOT_IMPLEMENTED))
userRoutes.delete('/watchlist/:id',  (c) => c.json(NOT_IMPLEMENTED))
