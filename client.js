/**
 * Client half of the `llm-dsh-token-usage` bundle plugin.
 *
 * Registers one sidebar footer action (`sidebar.footer.action`) whose trigger
 * copies the shipped Cordis footer-action geometry, and one fixed panel that
 * is anchored above that trigger. The host half (`index.js`) owns the data;
 * this module only reads `/api/llm-token-usage/stats` and renders it.
 *
 * Plain-JS bundle format: `react` is the only runtime module, no JSX, and the
 * factory has no side effects beyond returning `{ inject, apply }`.
 */
window.__ModuleLoader__.load({
  id: 'llm-dsh-token-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Stats route owned by the host half of this bundle. */
    const STATS_PATH = '/api/llm-token-usage/stats'
    /** Selectable ranges, in days. */
    const RANGE_OPTIONS = [7, 14, 30, 90]
    /** Range selected on first render. */
    const DEFAULT_RANGE_DAYS = 30
    /** Summary card window that always means "last week". */
    const WEEK_DAYS = 7
    /** Marker attribute for the single injected stylesheet. */
    const STYLE_MARKER = 'data-llm-token-usage-style'

    /** Simplified Chinese dictionary. */
    const ZH = {
      trigger: 'Token 统计',
      panelTitle: 'Token 用量',
      refresh: '刷新',
      close: '关闭',
      cardToday: '今日',
      cardWeek: '近 7 天',
      cardRange: (days) => `近 ${days} 天`,
      inputOutput: '输入+输出',
      cacheRead: '缓存读取',
      rangeLabel: '统计范围',
      rangeOption: (days) => `${days} 天`,
      chartLabel: (days) => `近 ${days} 天每日 Token 用量柱状图`,
      columnDate: '日期',
      columnTotal: '总量',
      columnInput: '输入',
      columnOutput: '输出',
      columnCacheRead: '缓存读',
      columnSessions: '会话',
      loading: '正在读取 Token 用量…',
      refreshing: '正在刷新…',
      empty: '该范围内没有 Token 用量记录。',
      loadFailed: (message) => `读取 Token 用量失败：${message}`,
      retry: '重试',
      incomplete: (count) => `${count} 个会话读取失败，统计可能不完整。`,
      barTitle: (date, value) => `${date} · ${value} tokens`,
    }

    /** English dictionary, key for key with {@link ZH}. */
    const EN = {
      trigger: 'Token usage',
      panelTitle: 'Token usage',
      refresh: 'Refresh',
      close: 'Close',
      cardToday: 'Today',
      cardWeek: 'Last 7 days',
      cardRange: (days) => `Last ${days} days`,
      inputOutput: 'in + out',
      cacheRead: 'cache read',
      rangeLabel: 'Range',
      rangeOption: (days) => `${days}d`,
      chartLabel: (days) => `Daily token usage over the last ${days} days`,
      columnDate: 'Date',
      columnTotal: 'Total',
      columnInput: 'Input',
      columnOutput: 'Output',
      columnCacheRead: 'Cache read',
      columnSessions: 'Sessions',
      loading: 'Loading token usage…',
      refreshing: 'Refreshing…',
      empty: 'No token usage recorded in this range.',
      loadFailed: (message) => `Could not load token usage: ${message}`,
      retry: 'Retry',
      incomplete: (count) => `${count} session(s) could not be read; totals may be incomplete.`,
      barTitle: (date, value) => `${date} · ${value} tokens`,
    }

    /** Chinese when the document or the browser asks for it, English otherwise. */
    function detectLanguage() {
      const fromDocument = typeof document === 'undefined' || document.documentElement === null
        ? ''
        : document.documentElement.lang
      const fromNavigator = typeof navigator === 'undefined' || typeof navigator.language !== 'string'
        ? ''
        : navigator.language
      const language = String(fromDocument || fromNavigator || '')
      return language.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
    }

    /** Coerce a wire value to a finite non-negative count. */
    function numberOf(value) {
      return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
    }

    /** Drop trailing fractional zeros so `1.20M` still reads as `1.2M`. */
    function trimFraction(text) {
      return text.indexOf('.') === -1 ? text : text.replace(/\.?0+$/, '')
    }

    /** Compact token count: 1234, 12.3K, 345K, 1.2M, 3.4B. */
    function formatTokens(value) {
      const count = Math.round(numberOf(value))
      if (count < 1000) return String(count)
      if (count >= 1e9) return trimFraction((count / 1e9).toFixed(2)) + 'B'
      if (count >= 1e6) return trimFraction((count / 1e6).toFixed(2)) + 'M'
      if (count >= 1e5) return Math.round(count / 1e3) + 'K'
      return trimFraction((count / 1e3).toFixed(1)) + 'K'
    }

    /** Sum the trailing `size` days of a series into one bucket record. */
    function seriesWindow(series, size) {
      const sum = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        inputOutputTokens: 0,
        sessions: 0,
      }
      const start = Math.max(0, series.length - size)
      for (let index = start; index < series.length; index += 1) {
        const day = series[index]
        sum.inputTokens += numberOf(day.inputTokens)
        sum.outputTokens += numberOf(day.outputTokens)
        sum.cacheReadTokens += numberOf(day.cacheReadTokens)
        sum.cacheWriteTokens += numberOf(day.cacheWriteTokens)
        sum.totalTokens += numberOf(day.totalTokens)
        sum.inputOutputTokens += numberOf(day.inputOutputTokens)
        sum.sessions += numberOf(day.sessions)
      }
      if (sum.inputOutputTokens === 0) sum.inputOutputTokens = sum.inputTokens + sum.outputTokens
      if (sum.totalTokens === 0) {
        sum.totalTokens = sum.inputTokens + sum.outputTokens + sum.cacheReadTokens + sum.cacheWriteTokens
      }
      return sum
    }

    /** Original bar-chart artwork for the trigger. */
    function barChartIcon(size) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 20 20',
        fill: 'none',
        focusable: 'false',
        'aria-hidden': true,
        style: { display: 'block' },
      }, [
        h('rect', { key: 'left', x: 3.4, y: 9.6, width: 3, height: 6, rx: 1.4, fill: 'currentColor', opacity: 0.5 }),
        h('rect', { key: 'middle', x: 8.5, y: 5.2, width: 3, height: 10.4, rx: 1.4, fill: 'currentColor' }),
        h('rect', { key: 'right', x: 13.6, y: 11.9, width: 3, height: 3.7, rx: 1.4, fill: 'currentColor', opacity: 0.5 }),
      ])
    }

    /** Refresh glyph: a circular arrow. */
    function refreshIcon() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', focusable: 'false', 'aria-hidden': true,
      }, [
        h('path', {
          key: 'arc',
          d: 'M13 8a5 5 0 1 1-1.6-3.7',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
        h('path', {
          key: 'head',
          d: 'M13.3 2.3v2.8h-2.8',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      ])
    }

    /** Close glyph: a cross. */
    function closeIcon() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', focusable: 'false', 'aria-hidden': true,
      }, [
        h('path', {
          key: 'cross',
          d: 'M4.4 4.4 11.6 11.6M11.6 4.4 4.4 11.6',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
      ])
    }

    /** One summary card: total, then the non-cache and cache-read figures. */
    function SummaryCard({ label, entry, t }) {
      const total = numberOf(entry === null || entry === undefined ? 0 : entry.totalTokens)
      const withoutCache = numberOf(entry === null || entry === undefined ? 0 : entry.inputOutputTokens)
      const cacheRead = numberOf(entry === null || entry === undefined ? 0 : entry.cacheReadTokens)
      return h('div', { className: 'llmtu-card' }, [
        h('span', { key: 'label', className: 'llmtu-card-label', children: label }),
        h('span', { key: 'value', className: 'llmtu-card-value', children: formatTokens(total) }),
        h('span', { key: 'sub', className: 'llmtu-card-sub' },
          `${t.inputOutput} ${formatTokens(withoutCache)} · ${t.cacheRead} ${formatTokens(cacheRead)}`),
      ])
    }

    /** Zero-filled daily bars: the busiest day fills the plot, today stands out. */
    function BarChart({ series, todayDate, t }) {
      let peak = 0
      for (const day of series) peak = Math.max(peak, numberOf(day.totalTokens))
      return h('div', {
        className: 'llmtu-chart',
        role: 'img',
        'aria-label': t.chartLabel(series.length),
      }, series.map((day) => {
        const total = numberOf(day.totalTokens)
        const height = peak === 0 || total === 0 ? 0 : Math.max(2, Math.round((total / peak) * 100))
        return h('div', { key: day.date, className: 'llmtu-bar-column' },
          h('div', {
            className: 'llmtu-bar',
            'data-today': day.date === todayDate || undefined,
            style: { height: `${height}%` },
            title: t.barTitle(day.date, formatTokens(total)),
          }))
      }))
    }

    /** Newest-first daily rows with tabular figures for every numeric column. */
    function DailyTable({ series, todayDate, t }) {
      const header = h('thead', { key: 'head' }, h('tr', null, [
        h('th', { key: 'date', scope: 'col', children: t.columnDate }),
        h('th', { key: 'total', scope: 'col', className: 'llmtu-num', children: t.columnTotal }),
        h('th', { key: 'input', scope: 'col', className: 'llmtu-num', children: t.columnInput }),
        h('th', { key: 'output', scope: 'col', className: 'llmtu-num', children: t.columnOutput }),
        h('th', { key: 'cache', scope: 'col', className: 'llmtu-num', children: t.columnCacheRead }),
        h('th', { key: 'sessions', scope: 'col', className: 'llmtu-num', children: t.columnSessions }),
      ]))
      const rows = series.slice().reverse().map((day) => h('tr', {
        key: day.date,
        'data-today': day.date === todayDate || undefined,
      }, [
        h('td', { key: 'date', className: 'llmtu-date', children: day.date }),
        h('td', { key: 'total', className: 'llmtu-num llmtu-strong', children: formatTokens(day.totalTokens) }),
        h('td', { key: 'input', className: 'llmtu-num', children: formatTokens(day.inputTokens) }),
        h('td', { key: 'output', className: 'llmtu-num', children: formatTokens(day.outputTokens) }),
        h('td', { key: 'cache', className: 'llmtu-num', children: formatTokens(day.cacheReadTokens) }),
        h('td', { key: 'sessions', className: 'llmtu-num', children: String(numberOf(day.sessions)) }),
      ]))
      return h('table', { className: 'llmtu-table' }, [header, h('tbody', { key: 'body' }, rows)])
    }
    /** Both dictionaries, keyed by {@link detectLanguage}. */
    const MESSAGES = { zh: ZH, en: EN }

    /**
     * Sidebar footer action: a trigger matching the shipped Cordis geometry
     * (`wide` row vs. 36px rail icon) plus the panel it toggles.
     * @param props - slot props; `wide` is the sidebar's expanded flag.
     */
    function TokenUsageAction({ wide }) {
      const t = MESSAGES[detectLanguage()]
      const [open, setOpen] = React.useState(false)
      const [days, setDays] = React.useState(DEFAULT_RANGE_DAYS)
      const [sequence, setSequence] = React.useState(0)
      const [state, setState] = React.useState({ status: 'idle', days: DEFAULT_RANGE_DAYS, data: null, error: null })
      const [anchor, setAnchor] = React.useState(null)
      const rootRef = React.useRef(null)
      const buttonRef = React.useRef(null)
      const refreshRef = React.useRef(false)

      /** Ask the next fetch for fresh host data (refetch, bypassing its cache). */
      const requestRefresh = React.useCallback(() => {
        refreshRef.current = true
        setSequence((value) => value + 1)
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        const controller = new AbortController()
        const refresh = refreshRef.current
        refreshRef.current = false
        setState((previous) => ({
          status: 'loading',
          days,
          data: previous.days === days ? previous.data : null,
          error: null,
        }))
        const query = `${STATS_PATH}?days=${days}${refresh ? '&refresh=1' : ''}`
        fetch(query, { cache: 'no-store', signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
          })
          .then((data) => {
            if (controller.signal.aborted) return
            setState({ status: 'ready', days, data, error: null })
          })
          .catch((error) => {
            if (controller.signal.aborted) return
            const message = error instanceof Error ? error.message : String(error)
            setState((previous) => ({
              status: 'error',
              days,
              data: previous.days === days ? previous.data : null,
              error: message,
            }))
          })
        return () => { controller.abort() }
      }, [open, days, sequence])

      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const node = rootRef.current
          if (node === null) return
          const rect = node.getBoundingClientRect()
          setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 8 })
        }
        place()
        window.addEventListener('resize', place)
        return () => { window.removeEventListener('resize', place) }
      }, [open])

      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const node = rootRef.current
          if (node !== null && event.target instanceof Node && node.contains(event.target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          setOpen(false)
          const trigger = buttonRef.current
          if (trigger !== null) trigger.focus()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])

      /** Move focus into the dialog when it mounts; keep it stable afterwards. */
      const setPanelRef = React.useCallback((node) => {
        if (node !== null) node.focus({ preventScroll: true })
      }, [])

      const data = state.data
      const series = data !== null && Array.isArray(data.series) ? data.series : []
      const today = data !== null && data.today !== null && data.today !== undefined ? data.today : null
      const totals = data !== null && data.totals !== null && data.totals !== undefined ? data.totals : null
      const loadedDays = data !== null && typeof data.days === 'number' ? data.days : days
      const todayDate = today !== null ? today.date : undefined
      const busy = state.status === 'loading' || state.status === 'idle'
      const week = seriesWindow(series, WEEK_DAYS)
      const hasUsage = totals !== null && numberOf(totals.totalTokens) > 0
      const skipped = data !== null ? numberOf(data.skippedSessions) : 0

      const sections = [
        h('div', {
          key: 'ranges',
          className: 'llmtu-ranges',
          role: 'group',
          'aria-label': t.rangeLabel,
        }, RANGE_OPTIONS.map((option) => h('button', {
          key: option,
          type: 'button',
          className: 'llmtu-range',
          'aria-pressed': option === days,
          onClick: () => { if (option !== days) setDays(option) },
        }, t.rangeOption(option)))),
      ]

      if (state.status === 'error') {
        sections.push(h('div', { key: 'error', className: 'llmtu-error', role: 'alert' }, [
          h('span', { key: 'message', children: t.loadFailed(state.error) }),
          h('button', { key: 'retry', type: 'button', className: 'llmtu-retry', onClick: requestRefresh }, t.retry),
        ]))
      }

      if (data === null) {
        if (state.status !== 'error') {
          sections.push(h('p', { key: 'loading', className: 'llmtu-note' }, t.loading))
        }
      } else {
        if (busy) sections.push(h('p', { key: 'refreshing', className: 'llmtu-note' }, t.refreshing))
        if (today !== null && totals !== null) {
          sections.push(h('div', { key: 'cards', className: 'llmtu-cards' }, [
            h(SummaryCard, { key: 'today', label: t.cardToday, entry: today, t }),
            h(SummaryCard, { key: 'week', label: t.cardWeek, entry: week, t }),
            h(SummaryCard, { key: 'range', label: t.cardRange(loadedDays), entry: totals, t }),
          ]))
        }
        if (hasUsage) {
          sections.push(h(BarChart, { key: 'chart', series, todayDate, t }))
          sections.push(h(DailyTable, { key: 'table', series, todayDate, t }))
        } else {
          sections.push(h('p', { key: 'empty', className: 'llmtu-note' }, t.empty))
        }
        if (skipped > 0 || data.incomplete === true) {
          sections.push(h('p', { key: 'incomplete', className: 'llmtu-note' }, t.incomplete(skipped)))
        }
      }

      const trigger = h('button', {
        ref: buttonRef,
        type: 'button',
        className: 'llmtu-badge',
        'aria-label': t.trigger,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        title: wide ? undefined : t.trigger,
        onClick: () => setOpen((value) => !value),
      }, [
        h('span', { key: 'icon', className: 'llmtu-badge-icon', children: barChartIcon(wide ? 16 : 18) }),
        wide ? h('span', { key: 'label', className: 'llmtu-badge-label', children: t.trigger }) : null,
        wide && today !== null
          ? h('span', { key: 'count', className: 'llmtu-badge-count', children: formatTokens(today.totalTokens) })
          : null,
      ])

      const panel = open && anchor !== null
        ? h('section', {
          key: 'panel',
          ref: setPanelRef,
          className: 'llmtu-panel',
          role: 'dialog',
          'aria-label': t.panelTitle,
          tabIndex: -1,
          style: anchor,
        }, [
          h('header', { key: 'header', className: 'llmtu-header' }, [
            h('span', { key: 'title', className: 'llmtu-title', children: t.panelTitle }),
            h('div', { key: 'actions', className: 'llmtu-header-actions' }, [
              h('button', {
                key: 'refresh',
                type: 'button',
                className: 'llmtu-icon-button',
                'aria-label': t.refresh,
                title: t.refresh,
                disabled: busy,
                onClick: requestRefresh,
              }, refreshIcon()),
              h('button', {
                key: 'close',
                type: 'button',
                className: 'llmtu-icon-button',
                'aria-label': t.close,
                title: t.close,
                onClick: () => {
                  setOpen(false)
                  const node = buttonRef.current
                  if (node !== null) node.focus()
                },
              }, closeIcon()),
            ]),
          ]),
          h('div', { key: 'body', className: 'llmtu-body', 'aria-busy': busy }, sections),
        ])
        : null

      return h('div', {
        ref: rootRef,
        className: wide ? 'llmtu-layer' : 'llmtu-layer llmtu-rail',
      }, [
        panel,
        h('div', { key: 'buttons', className: 'llmtu-footer-buttons', children: trigger }),
      ])
    }
    /** All classes are prefixed `llmtu-`; colours are host theme tokens. */
    const STYLES = `
.llmtu-layer{position:relative;display:flex;flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0}
.llmtu-layer.llmtu-rail{width:36px;height:36px;margin:0}
.llmtu-footer-buttons{display:flex;align-items:center;width:100%}
.llmtu-rail .llmtu-footer-buttons{flex-direction:column;gap:2px}
.llmtu-badge{display:inline-flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:0 -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#1f2328);font-family:inherit;font-size:14px;cursor:pointer;overflow:hidden}
.llmtu-badge:hover,.llmtu-badge[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.llmtu-badge:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#3b82f6);outline-offset:-2px}
.llmtu-badge-icon{display:inline-flex;flex:none;align-items:center;color:var(--dsw-alias-label-secondary,#57606a)}
.llmtu-badge-label{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.llmtu-badge-count{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary,#8b949e);font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums;font-size:12px;line-height:16px}
.llmtu-rail .llmtu-badge{justify-content:center;gap:0;width:36px;height:36px;padding:0;border-radius:50%}
.llmtu-panel{position:fixed;z-index:30;display:flex;flex-direction:column;width:420px;max-width:calc(100vw - 24px);max-height:60vh;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:12px;background:var(--dsw-specific-menu,#ffffff);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.18));backdrop-filter:var(--dsw-menu-backdrop-filter,none);color:var(--dsw-alias-label-primary,#1f2328)}
.llmtu-panel:focus{outline:none}
.llmtu-header{display:flex;flex:none;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px;box-sizing:border-box}
.llmtu-title{font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary,#1f2328)}
.llmtu-header-actions{display:flex;flex:none;align-items:center;gap:2px}
.llmtu-icon-button{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary,#8b949e);cursor:pointer}
.llmtu-icon-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-secondary,#57606a)}
.llmtu-icon-button:disabled{opacity:.4;cursor:default}
.llmtu-icon-button:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#3b82f6);outline-offset:-2px}
.llmtu-body{flex:1;min-height:0;padding:0 12px 12px;overflow-y:auto}
.llmtu-ranges{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.llmtu-range{padding:2px 10px;border:0.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.26));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#57606a);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer}
.llmtu-range:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.llmtu-range[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));border-color:var(--dsw-alias-border-l4,rgba(127,127,127,.32));color:var(--dsw-alias-label-primary,#1f2328)}
.llmtu-range:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#3b82f6);outline-offset:1px}
.llmtu-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}
.llmtu-card{display:flex;flex-direction:column;gap:1px;min-width:0;padding:8px 10px;border:0.5px solid var(--dsw-alias-border-l4,rgba(127,127,127,.16));border-radius:var(--dsw-radius-sm,8px)}
.llmtu-card-label{overflow:hidden;color:var(--dsw-alias-label-caption,#8b949e);font-size:11px;line-height:16px;white-space:nowrap;text-overflow:ellipsis}
.llmtu-card-value{overflow:hidden;color:var(--dsw-alias-label-primary,#1f2328);font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:15px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:ellipsis}
.llmtu-card-sub{overflow:hidden;color:var(--dsw-alias-label-tertiary,#8b949e);font-size:11px;line-height:15px;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:ellipsis}
.llmtu-chart{display:flex;align-items:flex-end;gap:1px;height:72px;margin:0 0 8px;padding:0 0 2px;border-bottom:0.5px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2))}
.llmtu-bar-column{display:flex;flex:1 1 0;min-width:1px;height:100%;align-items:flex-end}
.llmtu-bar{width:100%;border-radius:2px 2px 0 0;background:var(--dsw-alias-label-tertiary,#8b949e);opacity:.45}
.llmtu-bar[data-today]{background:var(--dsw-alias-label-primary,#1f2328);opacity:.9}
.llmtu-table{width:100%;border-collapse:collapse;font-size:11px;line-height:18px}
.llmtu-table th{padding:2px 4px;color:var(--dsw-alias-label-caption,#8b949e);font-weight:500;text-align:left;white-space:nowrap}
.llmtu-table td{padding:3px 4px;border-top:0.5px solid var(--dsw-alias-border-l4,rgba(127,127,127,.14));color:var(--dsw-alias-label-secondary,#57606a)}
.llmtu-table .llmtu-num{text-align:right;font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}
.llmtu-table td.llmtu-date{color:var(--dsw-alias-label-tertiary,#8b949e);font-family:var(--dsh-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);white-space:nowrap}
.llmtu-table tr[data-today] td{color:var(--dsw-alias-label-primary,#1f2328)}
.llmtu-table .llmtu-strong{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}
.llmtu-note{margin:6px 0;color:var(--dsw-alias-label-tertiary,#8b949e);font-size:12px;line-height:18px}
.llmtu-error{display:flex;align-items:center;gap:8px;margin:6px 0;color:var(--dsw-alias-state-error-primary,#d1242f);font-size:12px;line-height:18px}
.llmtu-retry{margin-left:auto;flex:none;padding:2px 8px;border:0.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.3));border-radius:999px;background:transparent;color:inherit;font-family:inherit;font-size:11px;cursor:pointer}
.llmtu-retry:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
`
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          for (const stale of document.querySelectorAll(`style[${STYLE_MARKER}]`)) stale.remove()
          const style = document.createElement('style')
          style.setAttribute(STYLE_MARKER, '')
          style.textContent = STYLES
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'llm-token-usage: styles')
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'token-usage',
          order: 10,
          label: 'Token usage',
        }, TokenUsageAction))
      },
    }
  },
})
