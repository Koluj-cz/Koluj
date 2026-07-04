export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeInternalPath(value: string | null, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

function stripUnsafeAttributes(html: string) {
  return html
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "");
}

export function sanitizeRichText(value: string | null | undefined) {
  if (!value) return "";

  let html = value.trim();

  html = html
    .replace(/<\/?(?:script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base)[^>]*>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");

  html = stripUnsafeAttributes(html);

  html = html.replace(/<a\s+([^>]*?)>/gi, (_match, attrs) => {
    const hrefMatch = String(attrs).match(/href\s*=\s*("[^"]*"|'[^']*')/i);
    if (!hrefMatch) return "<a>";

    const rawHref = hrefMatch[1].slice(1, -1).trim();
    if (!/^https?:\/\//i.test(rawHref) && !rawHref.startsWith("mailto:")) {
      return "<a>";
    }

    return `<a href="${escapeHtml(rawHref)}" target="_blank" rel="noopener noreferrer">`;
  });

  html = html.replace(/<(?!\/?(?:p|br|strong|b|em|i|u|ul|ol|li|blockquote|a)\b)[^>]+>/gi, "");

  return html;
}
