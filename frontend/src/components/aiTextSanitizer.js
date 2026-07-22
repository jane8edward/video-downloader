const SECTION_NAMES = 'SUMMARY|OUTLINE|MINDMAP|摘要|大纲|章节大纲|思维导图'
const SECTION_LINE_RE = new RegExp(
  `^\\s*(?:#{1,6}\\s*)?(?:={2,}\\s*)?(?:${SECTION_NAMES})(?:\\s*={2,})?\\s*$`,
  'i',
)
const SECTION_TOKEN_RE = new RegExp(
  `(?:={2,}\\s*(?:${SECTION_NAMES})\\s*={2,}|#{1,6}\\s*(?:${SECTION_NAMES})\\b)`,
  'gi',
)

function balanceInlineMarker(text, marker) {
  const matches = text.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))
  if (!matches || matches.length % 2 === 0) return text
  return text.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
}

function dropDanglingHeadingMarks(line) {
  return line
    .replace(/(^|\s)#{1,6}(?=\s*$)/g, '$1')
    .replace(/([^\n])\s*#{1,6}(?=\s*[\u4e00-\u9fa5A-Za-z0-9])/g, '$1 ')
    .replace(/^#{1,6}([^\s#])/g, '### $1')
}

export function sanitizeAiMarkdown(text = '') {
  let cleaned = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/```(?:markdown|md)?\n?/gi, '')
    .replace(/\n?```\s*$/g, '')
    .replace(SECTION_TOKEN_RE, '')
    .replace(/={2,}/g, '')
    .replace(new RegExp(`^\\s*(?:${SECTION_NAMES})\\s*$`, 'gim'), '')
    .replace(/^\s*={2,}\s*$/gm, '')
    .replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')

  cleaned = cleaned
    .split('\n')
    .filter((line) => !SECTION_LINE_RE.test(line))
    .map(dropDanglingHeadingMarks)
    .join('\n')

  cleaned = cleaned.replace(/\*\*/g, '').replace(/__/g, '')
  cleaned = balanceInlineMarker(cleaned, '`')

  return cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([，。；：！？、,.!?;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isSectionMarkerLine(line = '') {
  return SECTION_LINE_RE.test(line)
}
