/**
 * HTML entity escaping utility to prevent XSS injection in transactional emails
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  const matchHtmlRegExp = /["'&<>]/;
  const match = matchHtmlRegExp.exec(s);
  if (!match) return s;

  let html = '';
  let index = 0;
  let lastIndex = 0;

  for (index = match.index; index < s.length; index++) {
    let escape = '';
    switch (s.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break;
      case 38: // &
        escape = '&amp;';
        break;
      case 39: // '
        escape = '&#39;';
        break;
      case 60: // <
        escape = '&lt;';
        break;
      case 62: // >
        escape = '&gt;';
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += s.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + s.substring(lastIndex, index) : html;
}
