import { formatSrtTime, formatTime, formatVttTime } from './util'

export type ExportFormat = 'md' | 'srt' | 'vtt' | 'textWithTime' | 'text' | 'json'

export interface FormatResult {
  content: string
  extension: string
}

/**
 * Format transcript body into selected format string
 */
export const formatTranscript = (
  format: ExportFormat,
  items: TranscriptItem[],
  title?: string,
  meta?: { author?: string, url?: string, time?: string }
): FormatResult => {
  let s = ''
  let suffix = 'txt'

  const header = (meta?.author || meta?.time)
    ? `${title ?? '无标题'}\n${meta?.url ?? ''}\n${meta?.author ?? ''} ${meta?.time ?? ''}\n\n`
    : ''

  switch (format) {
    case 'md': {
      const titleHeader = title ? `# ${title}\n\n` : ''
      let metaHeader = ''
      if (meta?.url || meta?.author || meta?.time) {
        metaHeader = '> ' + [
          meta.author ? `UP主: ${meta.author}` : '',
          meta.time ? `时间: ${meta.time}` : '',
          meta.url ? `链接: ${meta.url}` : '',
        ].filter(Boolean).join(' | ') + '\n\n'
      }
      s = titleHeader + metaHeader + items.map(item => `- **${formatTime(item.from)}** ${item.content ?? ''}`).join('\n')
      suffix = 'md'
      break
    }

    case 'text':
      s = header + items.map(item => item.content ?? '').join('\n')
      suffix = 'txt'
      break

    case 'textWithTime':
      s = header + items.map(item => `${formatTime(item.from)} ${item.content ?? ''}`).join('\n')
      suffix = 'txt'
      break

    case 'srt':
      s = items.map((item, idx) => {
        return `${idx + 1}\n${formatSrtTime(item.from)} --> ${formatSrtTime(item.to)}\n${(item.content ?? '').trim()}\n`
      }).join('\n')
      suffix = 'srt'
      break

    case 'vtt':
      s = `WEBVTT ${title ?? ''}\n\n` + items.map((item, idx) => {
        return `${idx + 1}\n${formatVttTime(item.from)} --> ${formatVttTime(item.to)}\n${(item.content ?? '').trim()}\n`
      }).join('\n')
      suffix = 'vtt'
      break

    case 'json':
      s = JSON.stringify({ title, body: items }, null, 2)
      suffix = 'json'
      break

    default:
      s = items.map(item => item.content ?? '').join('\n')
      suffix = 'txt'
  }

  return { content: s, extension: suffix }
}
