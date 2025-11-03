/**
 * Types pour Google Search Console Issues
 */

export interface GSCIssue {
  id: string
  issue_date: string
  domain: string
  issue_type: string
  severity: 'error' | 'warning' | 'info'
  status: 'open' | 'resolved' | 'fixed'
  title: string
  description: string | null
  affected_pages_count: number
  affected_urls: string[]
  detected_at: string
  first_seen: string
  last_seen: string
  resolved_at: string | null
  gsc_notification_id: string | null
  source: string
}

