import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { OHLCVBar } from '@battu/shared'

interface Props {
  bars:        OHLCVBar[]
  chartType:   'candle' | 'line'
  ticker:      string
  onBarHover?: (bar: OHLCVBar | null) => void
}

interface ThemeColors {
  bg:       string
  border:   string
  text:     string
  positive: string
  negative: string
  accent:   string
}

function readVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function getThemeColors(): ThemeColors {
  return {
    bg:       readVar('--battu-screen-bg', '#0D0A00'),
    border:   readVar('--battu-border',    '#1F1500'),
    text:     readVar('--battu-muted',     '#78530A'),
    positive: readVar('--battu-positive',  '#86C232'),
    negative: readVar('--battu-negative',  '#CC4444'),
    accent:   readVar('--battu-accent',    '#F59E0B'),
  }
}

function toCandleBars(data: OHLCVBar[]) {
  return data
    .filter(b => b.open > 0 && b.close > 0)
    .map(b => ({
      time:  Math.floor(b.timestamp / 1000) as UTCTimestamp,
      open:  b.open,
      high:  b.high,
      low:   b.low,
      close: b.close,
    }))
    .sort((a, b) => (a.time as number) - (b.time as number))
}

function toLineBars(data: OHLCVBar[]) {
  return data
    .filter(b => b.close > 0)
    .map(b => ({
      time:  Math.floor(b.timestamp / 1000) as UTCTimestamp,
      value: b.close,
    }))
    .sort((a, b) => (a.time as number) - (b.time as number))
}

function toVolumeBars(data: OHLCVBar[], colors: ThemeColors) {
  return data
    .filter(b => b.volume > 0)
    .map(b => ({
      time:  Math.floor(b.timestamp / 1000) as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open
        ? colors.positive + '80'   // ~50% alpha
        : colors.negative + '80',
    }))
    .sort((a, b) => (a.time as number) - (b.time as number))
}

export function GPChart({ bars, chartType, ticker, onBarHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return

    const container = containerRef.current
    const colors = getThemeColors()

    // Tear down previous chart if any
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(container, {
      width:  container.clientWidth,
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor:  colors.text,
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize:   10,
      },
      grid: {
        vertLines: { color: colors.border, style: 1 },
        horzLines: { color: colors.border, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.accent, width: 1, style: 2, labelBackgroundColor: colors.accent },
        horzLine: { color: colors.accent, width: 1, style: 2, labelBackgroundColor: colors.accent },
      },
      rightPriceScale: {
        borderColor:  colors.border,
        textColor:    colors.text,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor:    colors.border,
        timeVisible:    true,
        secondsVisible: false,
        rightOffset:    5,
        barSpacing:     bars.length > 200 ? 3 : bars.length > 60 ? 5 : 8,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })
    chartRef.current = chart

    // Main series — candle or line (Lightweight Charts v4 API)
    let mainSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>
    if (chartType === 'candle') {
      const cs = chart.addCandlestickSeries({
        upColor:         colors.positive,
        downColor:       colors.negative,
        borderUpColor:   colors.positive,
        borderDownColor: colors.negative,
        wickUpColor:     colors.positive,
        wickDownColor:   colors.negative,
        priceScaleId:    'right',
      })
      cs.setData(toCandleBars(bars))
      mainSeries = cs
    } else {
      const ls = chart.addLineSeries({
        color:        colors.accent,
        lineWidth:    2,
        priceScaleId: 'right',
      })
      ls.setData(toLineBars(bars))
      mainSeries = ls
    }
    void mainSeries

    // Volume series — pinned to bottom 20% via its own price scale
    const volumeSeries = chart.addHistogramSeries({
      priceFormat:  { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeries.setData(toVolumeBars(bars, colors))

    // Crosshair → footer hover
    if (onBarHover) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.time) {
          onBarHover(null)
          return
        }
        const ts = (param.time as number) * 1000
        // Tolerance: 1 day in ms — covers daily bars; for intraday this still
        // resolves the right bar because timestamps match exactly.
        const bar = bars.find(b => Math.abs(b.timestamp - ts) < 86_400_000) ?? null
        onBarHover(bar)
      })
    }

    chart.timeScale().fitContent()

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [bars, chartType, ticker, onBarHover])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
    />
  )
}
