export function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function inlineFormat(str) {
  let escaped = escapeHtml(str)
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return escaped
}

export function renderMarkdown(text) {
  const lines = text.split('\n')
  let html = ''
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^#{1,3}\s+/.test(trimmed)) {
      if (inList) {
        html += '</ul>'
        inList = false
      }
      html += `<h3>${escapeHtml(trimmed.replace(/^#{1,3}\s+/, ''))}</h3>`
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        html += '<ul>'
        inList = true
      }
      html += `<li>${inlineFormat(trimmed.replace(/^[-*]\s+/, ''))}</li>`
      continue
    }

    if (trimmed === '') {
      if (inList) {
        html += '</ul>'
        inList = false
      }
      continue
    }

    if (inList) {
      html += '</ul>'
      inList = false
    }
    html += `<p>${inlineFormat(trimmed)}</p>`
  }
  if (inList) html += '</ul>'
  return html
}
