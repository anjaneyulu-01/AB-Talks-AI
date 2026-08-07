/**
 * Minimal markdown renderer.
 *
 * Why not `react-markdown`: it plus remark is ~60kb gzipped, and the only
 * markdown in this product is what the interviewer writes (paragraphs, bold,
 * inline code, occasional lists and fenced blocks) and what the candidate
 * types. That is a small, closed grammar. 60kb to render it would be a poor
 * trade on a screen whose whole job is to feel fast.
 *
 * Safety: this never sets `dangerouslySetInnerHTML`. Every branch returns real
 * React elements, so candidate-authored text is escaped by React itself and
 * cannot inject markup. That is the reason for the slightly verbose token
 * walk below rather than a regex-to-HTML shortcut.
 */

import { Fragment, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  return <div className={cn('prose-interview', className)}>{renderBlocks(content)}</div>
}

function renderBlocks(source: string): ReactNode[] {
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')

  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index]

    // Fenced code block.
    if (line.trimStart().startsWith('```')) {
      const language = line.trim().slice(3).trim()
      const body: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        body.push(lines[index])
        index += 1
      }
      index += 1 // consume closing fence
      blocks.push(
        <pre key={key++}>
          {language && (
            <span className="mb-2 block font-mono text-[0.6875rem] uppercase tracking-wider text-ink-faint">
              {language}
            </span>
          )}
          <code>{body.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Unordered list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''))
        index += 1
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Ordered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''))
        index += 1
      }
      blocks.push(
        <ol key={key++}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Blank line.
    if (!line.trim()) {
      index += 1
      continue
    }

    // Paragraph — greedily consume until a blank line or a block starter.
    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trimStart().startsWith('```') &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(<p key={key++}>{renderInline(paragraph.join(' '))}</p>)
  }

  return blocks
}

/** Handles `code`, **bold**, and *italic*, innermost-first. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Inline code is matched first and its content is never re-scanned, so
  // asterisks inside a code span stay literal.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g

  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
    }

    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(<code key={key++}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>)
  }

  return nodes
}
