import { Hono } from 'hono'
import { NOT_IMPLEMENTED } from './_notImplemented'

export const fundamentalsRoutes = new Hono()

fundamentalsRoutes.get('/profile/:ticker',      (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/financials/:ticker',   (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/ratios/:ticker',       (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/peers/:ticker',        (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/estimates/:ticker',    (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/grades/:ticker',       (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.post('/screener',            (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/earnings-calendar',    (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/dividends/:ticker',    (c) => c.json(NOT_IMPLEMENTED))
