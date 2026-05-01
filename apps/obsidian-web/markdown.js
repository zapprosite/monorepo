/**
 * obsidian-web - Vanilla JS Markdown Renderer
 * No external dependencies - parses markdown to HTML
 */

/**
 * Render markdown content to HTML
 * @param {string} content - Markdown text to render
 * @returns {string} HTML string
 */
function renderMarkdown(content) {
  if (!content) return '';

  let html = escapeHtml(content);

  // Code blocks (must be processed before other transformations)
  html = parseCodeBlocks(html);

  // Blockquotes
  html = parseBlockquotes(html);

  // Headers (h6 to h1 to avoid conflicts)
  html = parseHeaders(html);

  // Horizontal rules
  html = parseHorizontalRules(html);

  // Bold and italic (order matters)
  html = parseBoldItalic(html);

  // Wikilinks [[Note Name]] - internal vault links
  html = parseWikilinks(html);

  // Standard markdown links [text](url)
  html = parseLinks(html);

  // Lists
  html = parseLists(html);

  // Inline code
  html = parseInlineCode(html);

  // Clean up paragraphs
  html = finalizeParagraphs(html);

  return html.trim();
}

/**
 * Escape HTML special characters
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const escapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => escapes[char]);
}

/**
 * Parse fenced code blocks with syntax highlighting via highlight.js CDN
 * @param {string} html
 * @returns {string}
 */
function parseCodeBlocks(html) {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  return html.replace(codeBlockRegex, (match, language, code) => {
    const lang = language || 'plaintext';
    const decoded = decodeHtmlEntities(code);
    // highlight.js will be loaded via CDN in app.js
    return `<pre><code class="language-${lang}">${decoded}</code></pre>`;
  });
}

/**
 * Decode HTML entities (for code blocks)
 * @param {string} text
 * @returns {string}
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Parse blockquotes
 * @param {string} html
 * @returns {string}
 */
function parseBlockquotes(html) {
  const lines = html.split('\n');
  let inBlockquote = false;
  let result = [];
  let buffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^&gt;\s*/)) {
      if (!inBlockquote) {
        inBlockquote = true;
        buffer = [];
      }
      buffer.push(line.replace(/^&gt;\s*/, ''));
    } else {
      if (inBlockquote) {
        result.push('<blockquote>' + buffer.join('<br>') + '</blockquote>');
        buffer = [];
        inBlockquote = false;
      }
      result.push(line);
    }
  }

  if (inBlockquote) {
    result.push('<blockquote>' + buffer.join('<br>') + '</blockquote>');
  }

  return result.join('\n');
}

/**
 * Parse headers (h6 to h1 to avoid matching issues)
 * @param {string} html
 * @returns {string}
 */
function parseHeaders(html) {
  // h6 to h1
  for (let i = 6; i >= 1; i--) {
    const regex = new RegExp(`^${'#'.repeat(i)}\\s+(.+)$`, 'gm');
    html = html.replace(regex, `<h${i}>$1</h${i}>`);
  }
  return html;
}

/**
 * Parse horizontal rules
 * @param {string} html
 * @returns {string}
 */
function parseHorizontalRules(html) {
  return html.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr>');
}

/**
 * Parse bold and italic with nested support
 * @param {string} html
 * @returns {string}
 */
function parseBoldItalic(html) {
  // Bold+Italic (***text*** or ___text___)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  return html;
}

/**
 * Parse wikilinks [[Note Name]] and [[Note Name|Display Text]]
 * @param {string} html
 * @returns {string}
 */
function parseWikilinks(html) {
  // Wiki links: [[Note]] or [[Note|Display Text]] or [[folder/Note]]
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  return html.replace(wikilinkRegex, (match, target, display) => {
    const displayText = display || target;
    // Convert spaces and special chars for URL encoding
    const encodedTarget = encodeURIComponent(target.trim());
    return `<a href="#note-${encodedTarget}" class="wikilink" data-target="${escapeHtml(target.trim())}">${escapeHtml(displayText)}</a>`;
  });
}

/**
 * Parse standard markdown links [text](url)
 * @param {string} html
 * @returns {string}
 */
function parseLinks(html) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  return html.replace(linkRegex, (match, text, url) => {
    const escapedText = escapeHtml(text);
    const escapedUrl = escapeHtml(url.trim());

    // External links get target="_blank"
    const isExternal = escapedUrl.startsWith('http://') || escapedUrl.startsWith('https://');
    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';

    return `<a href="${escapedUrl}"${targetAttr}>${escapedText}</a>`;
  });
}

/**
 * Parse unordered and ordered lists
 * @param {string} html
 * @returns {string}
 */
function parseLists(html) {
  const lines = html.split('\n');
  let result = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Unordered list: - or * or +
    const ulMatch = line.match(/^[\-\*\+]\s+(.+)$/);
    // Ordered list: 1. or 1)
    const olMatch = line.match(/^\d+\.?\s+(.+)$/);

    if (ulMatch) {
      if (inOl) {
        result.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        result.push('<ul>');
        inUl = true;
      }
      result.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        result.push('<ol>');
        inOl = true;
      }
      result.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        result.push('</ol>');
        inOl = false;
      }
      result.push(line);
    }
  }

  // Close any open lists
  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');

  return result.join('\n');
}

/**
 * Parse inline code `code`
 * @param {string} html
 * @returns {string}
 */
function parseInlineCode(html) {
  const inlineCodeRegex = /`([^`]+)`/g;
  return html.replace(inlineCodeRegex, '<code>$1</code>');
}

/**
 * Finalize paragraphs - wrap loose text lines in <p> tags
 * @param {string} html
 * @returns {string}
 */
function finalizeParagraphs(html) {
  const lines = html.split('\n');
  let result = [];
  let inParagraph = false;
  let paragraphBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      if (inParagraph) {
        result.push('<p>' + paragraphBuffer.join(' ') + '</p>');
        paragraphBuffer = [];
        inParagraph = false;
      }
      continue;
    }

    // Skip lines that are already block elements
    if (line.match(/^<(h[1-6]|ul|ol|li|p|blockquote|pre|hr)/)) {
      if (inParagraph) {
        result.push('<p>' + paragraphBuffer.join(' ') + '</p>');
        paragraphBuffer = [];
        inParagraph = false;
      }
      result.push(line);
      continue;
    }

    // Add to paragraph buffer
    paragraphBuffer.push(line);
    inParagraph = true;
  }

  // Close any open paragraph
  if (inParagraph && paragraphBuffer.length > 0) {
    result.push('<p>' + paragraphBuffer.join(' ') + '</p>');
  }

  return result.join('\n');
}

/**
 * Initialize highlight.js from CDN
 * Call this once when the app loads
 */
function initHighlightJs() {
  // Load highlight.js from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
  script.onload = () => {
    // Auto-detect and highlight code blocks after load
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  };
  document.head.appendChild(script);

  // Load a common theme (atom-one-dark)
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
  document.head.appendChild(style);
}

/**
 * Highlight code blocks that were rendered after CDN load
 * Call this after rendering markdown content
 */
function highlightCodeBlocks() {
  if (window.hljs) {
    document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMarkdown, initHighlightJs, highlightCodeBlocks };
}