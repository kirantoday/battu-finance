import type { NewsArticle } from '@battu/shared'

interface Props { articles: NewsArticle[] }

const CATEGORY_COLORS: Record<NewsArticle['category'], string> = {
  earnings: 'var(--battu-warning)',
  analyst:  '#4A9EFF',
  ma:       'var(--battu-positive)',
  macro:    '#9B59B6',
  general:  'var(--battu-muted)',
}

const CATEGORY_LABELS: Record<NewsArticle['category'], string> = {
  earnings: 'EARNINGS',
  analyst:  'ANALYST',
  ma:       'M&A',
  macro:    'MACRO',
  general:  'GENERAL',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch { return '' }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch { return '' }
}

function getDayKey(iso: string): string {
  try { return new Date(iso).toISOString().split('T')[0] }
  catch { return '' }
}

export function NIArticleList({ articles }: Props) {
  if (articles.length === 0) {
    return (
      <div style={{ padding: '24px', color: 'var(--battu-muted)', fontSize: '11px' }}>
        No articles found for selected filter.
      </div>
    )
  }

  // Group by date, preserving article order (NewsAPI returns newest first)
  const groups = new Map<string, NewsArticle[]>()
  for (const a of articles) {
    const day = getDayKey(a.publishedAt)
    const arr = groups.get(day) ?? []
    arr.push(a)
    groups.set(day, arr)
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {Array.from(groups.entries()).map(([day, dayArticles]) => (
        <div key={day}>
          <div style={{
            padding:       '6px 16px',
            background:    'var(--battu-surface)',
            borderTop:     '1px solid var(--battu-border)',
            borderBottom:  '1px solid var(--battu-border)',
            color:         'var(--battu-accent)',
            fontSize:      '9px',
            letterSpacing: '2px',
            fontWeight:    'bold',
          }}>
            ── {formatDate(dayArticles[0].publishedAt).toUpperCase()} ──
          </div>

          {dayArticles.map((article, i) => (
            <ArticleRow key={article.id || `${day}-${i}`} article={article} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ArticleRow({ article }: { article: NewsArticle }) {
  const catColor = CATEGORY_COLORS[article.category] || 'var(--battu-muted)'
  const catLabel = CATEGORY_LABELS[article.category] || 'GENERAL'

  return (
    <div
      style={{
        padding:      '10px 16px',
        borderBottom: '1px solid var(--battu-border)',
        cursor:       'pointer',
        transition:   'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--battu-surface)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <span style={{
          color:         catColor,
          border:        `1px solid ${catColor}`,
          fontSize:      '8px',
          letterSpacing: '1px',
          padding:       '1px 5px',
          borderRadius:  '2px',
          flexShrink:    0,
        }}>
          {catLabel}
        </span>

        <span style={{ color: 'var(--battu-muted)', fontSize: '9px', flexShrink: 0 }}>
          {formatTime(article.publishedAt)}
        </span>

        <span style={{
          color:      'var(--battu-muted)',
          fontSize:   '9px',
          marginLeft: 'auto',
          flexShrink: 0,
        }}>
          {article.source}
        </span>
      </div>

      <div style={{
        color:        'var(--battu-text)',
        fontSize:     '11px',
        lineHeight:   '1.5',
        marginBottom: article.summary ? '4px' : 0,
        fontWeight:   'bold',
      }}>
        {article.headline}
      </div>

      {article.summary && (
        <div style={{
          color:           'var(--battu-muted)',
          fontSize:        '10px',
          lineHeight:      '1.5',
          display:         '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow:        'hidden',
        }}>
          {article.summary}
        </div>
      )}

      {article.tickers.length > 0 && (
        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {article.tickers.slice(0, 5).map(t => (
            <span key={t} style={{
              color:        'var(--battu-accent)',
              fontSize:     '8px',
              border:       '1px solid var(--battu-border)',
              padding:      '1px 4px',
              borderRadius: '2px',
            }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
