/**
 * Slack notifier - Envoyer des messages Slack
 */

import { log } from '../../etl/shared/error-handler.js'

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

if (!SLACK_WEBHOOK_URL) {
  console.warn('⚠️  SLACK_WEBHOOK_URL not configured - Slack notifications disabled')
}

// ========================================
// TYPES
// ========================================

export interface SlackMessage {
  text: string
  blocks?: any[]
}

// ========================================
// HELPERS
// ========================================

/**
 * Envoyer un message Slack simple
 */
export async function sendSlackMessage(text: string): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    log('warn', 'Slack webhook not configured, skipping notification')
    return false
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`)
    }

    log('info', '✅ Slack notification sent')
    return true
  } catch (error: any) {
    log('error', 'Failed to send Slack notification', { error: error.message })
    return false
  }
}

/**
 * Envoyer un message Slack avec blocks (formaté)
 */
export async function sendSlackBlocks(message: SlackMessage): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    log('warn', 'Slack webhook not configured, skipping notification')
    return false
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`)
    }

    log('info', '✅ Slack notification sent')
    return true
  } catch (error: any) {
    log('error', 'Failed to send Slack notification', { error: error.message })
    return false
  }
}

/**
 * Formatter un rapport pour Slack
 */
export function formatReportForSlack(report: {
  summary: string
  topActions: Array<{ title: string; site: string; impact?: string }>
  detailsUrl?: string
}): SlackMessage {
  const { summary, topActions, detailsUrl } = report

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Rapport hebdo Moverz Analytics',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: summary,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🎯 Top actions recommandées :*',
      },
    },
  ]

  // Ajouter les actions (max 3)
  topActions.slice(0, 3).forEach((action, idx) => {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${idx + 1}. *${action.title}* (${action.site})${action.impact ? `\n_Impact: ${action.impact}_` : ''}`,
      },
    })
  })

  // Lien vers détails
  if (detailsUrl) {
    blocks.push({
      type: 'divider',
    })
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${detailsUrl}|📈 Voir les détails complets>`,
      },
    })
  }

  return {
    text: summary, // Fallback pour notifications
    blocks,
  }
}

/**
 * Envoyer un rapport hebdo sur Slack
 */
export async function pushWeeklyReport(report: {
  summary: string
  topActions: Array<{ title: string; site: string; impact?: string }>
  detailsUrl?: string
}): Promise<boolean> {
  const message = formatReportForSlack(report)
  return sendSlackBlocks(message)
}

export default {
  sendSlackMessage,
  sendSlackBlocks,
  formatReportForSlack,
  pushWeeklyReport,
}

