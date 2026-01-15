/**
 * HTML Template
 *
 * Template for generating HTML documentation with search and navigation
 */

import type { TemplateContext } from '../types';

/**
 * Render HTML template
 */
export function renderHTMLTemplate(context: TemplateContext): string {
  const {
    projectName,
    version,
    description,
    repository,
    homepage,
    author,
    license,
    generatedAt,
    apiReference,
    symbols,
    categories,
    diagrams,
    tutorials,
    changelog,
    stats,
    custom,
  } = context;

  // Generate navigation items
  const navItems = Object.entries(categories).map(([name, syms]) => `
    <div class="nav-item">
      <a href="#category-${escapeHtml(name.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(name)}</a>
      <ul class="nav-subitems">
        ${syms.slice(0, 10).map(s => `
          <li><a href="#symbol-${s.id}">${escapeHtml(s.name)}</a></li>
        `).join('')}
      </ul>
    </div>
  `).join('');

  // Generate API sections
  const apiSections = Object.entries(categories).map(([name, syms]) => `
    <section id="category-${escapeHtml(name.toLowerCase().replace(/\s+/g, '-'))}" class="doc-section">
      <h2>${escapeHtml(name)}</h2>
      ${syms.slice(0, 10).map(s => renderSymbolHTML(s)).join('')}
    </section>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)} - Documentation</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="version" content="${escapeHtml(version)}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: 280px;
      background: #1e293b;
      color: #e2e8f0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 1.5rem;
      border-bottom: 1px solid #334155;
    }

    .sidebar-header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .sidebar-header .version {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .search {
      padding: 1rem;
      border-bottom: 1px solid #334155;
    }

    .search input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #475569;
      border-radius: 0.375rem;
      background: #0f172a;
      color: #e2e8f0;
      font-size: 0.875rem;
    }

    .search input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .nav {
      padding: 1rem 0;
    }

    .nav-item {
      margin-bottom: 0.5rem;
    }

    .nav-item > a {
      display: block;
      padding: 0.5rem 1.5rem;
      color: #e2e8f0;
      text-decoration: none;
      font-weight: 500;
      transition: background 0.2s;
    }

    .nav-item > a:hover {
      background: #334155;
    }

    .nav-subitems {
      list-style: none;
      padding: 0.25rem 0;
    }

    .nav-subitems li {
      padding: 0.25rem 1.5rem 0.25rem 2.5rem;
    }

    .nav-subitems a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;
    }

    .nav-subitems a:hover {
      color: #e2e8f0;
    }

    /* Main content */
    .main-content {
      flex: 1;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #e2e8f0;
    }

    .header h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #0f172a;
    }

    .header .description {
      font-size: 1.25rem;
      color: #64748b;
      margin-bottom: 1.5rem;
    }

    .badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    /* Documentation sections */
    .doc-section {
      margin-bottom: 4rem;
      scroll-margin-top: 2rem;
    }

    .doc-section h2 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
    }

    /* Symbol documentation */
    .symbol {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f8fafc;
      border-radius: 0.5rem;
      border-left: 4px solid #3b82f6;
    }

    .symbol-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .symbol-kind {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .symbol-kind.function { background: #dbeafe; color: #1e40af; }
    .symbol-kind.class { background: #f3e8ff; color: #6b21a8; }
    .symbol-kind.interface { background: #dcfce7; color: #166534; }
    .symbol-kind.type { background: #fef3c7; color: #92400e; }

    .symbol-name {
      font-size: 1.5rem;
      font-weight: 600;
    }

    .symbol-description {
      color: #475569;
      margin-bottom: 1rem;
    }

    .signature {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1rem;
      border-radius: 0.375rem;
      overflow-x: auto;
      margin: 1rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }

    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    th {
      background: #f1f5f9;
      font-weight: 600;
    }

    code {
      background: #f1f5f9;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.875em;
    }

    /* Footer */
    .footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 0.875rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      body { flex-direction: column; }
      .sidebar { width: 100%; height: auto; position: relative; }
      .main-content { padding: 1rem; }
      .header h1 { font-size: 2rem; }
    }

    /* Search results */
    .search-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.375rem;
      margin-top: 0.25rem;
      max-height: 400px;
      overflow-y: auto;
      display: none;
    }

    .search-results.active { display: block; }

    .search-result {
      padding: 0.75rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid #334155;
    }

    .search-result:hover { background: #334155; }

    .search-result-name { font-weight: 500; }
    .search-result-kind { color: #94a3b8; font-size: 0.75rem; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>${escapeHtml(projectName)}</h1>
      <div class="version">v${escapeHtml(version)}</div>
    </div>

    <div class="search">
      <input type="text" id="search-input" placeholder="Search symbols..." />
      <div class="search-results" id="search-results"></div>
    </div>

    <nav class="nav">
      ${navItems}
    </nav>
  </aside>

  <main class="main-content">
    <header class="header">
      <h1>${escapeHtml(projectName)}</h1>
      ${description ? `<p class="description">${escapeHtml(description)}</p>` : ''}
      <div class="badges">
        <span class="badge">v${escapeHtml(version)}</span>
        <span class="badge">${license}</span>
        <span class="badge">${stats.totalSymbols} symbols</span>
        <span class="badge">${stats.coverage.toFixed(0)}% documented</span>
      </div>
    </header>

    ${apiSections}

    <footer class="footer">
      <p>Generated on ${new Date(generatedAt).toISOString()}</p>
      <p>${stats.totalSymbols} symbols across ${stats.totalFiles} files</p>
      ${author ? `<p>© ${new Date().getFullYear()} ${escapeHtml(author)}</p>` : ''}
    </footer>
  </main>

  <script>
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const symbols = ${JSON.stringify(symbols.map(s => ({ id: s.id, name: s.name, kind: s.kind, filePath: s.filePath })))};

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();

      if (query.length < 2) {
        searchResults.classList.remove('active');
        return;
      }

      const matches = symbols.filter(s => s.name.toLowerCase().includes(query));

      if (matches.length === 0) {
        searchResults.classList.remove('active');
        return;
      }

      const resultHTML = matches.slice(0, 10).map(s => {
        return '<div class="search-result" data-symbol-id="' + String(s.id) + '">' +
          '<div class="search-result-name">' + escapeHtml(s.name) + '</div>' +
          '<div class="search-result-kind">' + s.kind + '</div>' +
          '</div>';
      }).join('');

      searchResults.innerHTML = resultHTML;

      searchResults.querySelectorAll('.search-result').forEach((el: any) => {
        el.addEventListener('click', () => {
          const symbolId = el.getAttribute('data-symbol-id');
          window.location.hash = 'symbol-' + symbolId;
        });
      });

      searchResults.classList.add('active');
    });

    // Close search results on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search')) {
        searchResults.classList.remove('active');
      }
    });

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Render a single symbol in HTML
 */
function renderSymbolHTML(symbol: any): string {
  const badges = [
    symbol.deprecated ? '<span class="badge" style="background: #fee2e2; color: #991b1b;">Deprecated</span>' : '',
    symbol.exported ? '<span class="badge" style="background: #dcfce7; color: #166534;">Exported</span>' : '',
  ].filter(Boolean).join(' ');

  const parameters = symbol.parameters && symbol.parameters.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Optional</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${symbol.parameters.map((p: any) => `
          <tr>
            <td><code>${p.name}</code></td>
            <td><code>${p.type}</code></td>
            <td>${p.optional ? 'Yes' : 'No'}</td>
            <td>${p.description || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  return `
    <div class="symbol" id="symbol-${symbol.id}">
      <div class="symbol-header">
        <span class="symbol-kind ${symbol.kind}">${symbol.kind}</span>
        <span class="symbol-name">${escapeHtml(symbol.name)}</span>
        ${badges}
      </div>

      ${symbol.summary ? `<p class="symbol-description">${escapeHtml(symbol.summary)}</p>` : ''}

      ${symbol.signature ? `<div class="signature">${escapeHtml(symbol.signature)}</div>` : ''}

      ${symbol.returnType ? `<p><strong>Returns:</strong> <code>${escapeHtml(symbol.returnType)}</code></p>` : ''}

      ${parameters}

      ${symbol.since || symbol.version ? `
        <p style="color: #94a3b8; font-size: 0.875rem;">
          ${symbol.since ? `Since: ${symbol.since}` : ''}
          ${symbol.version ? `Version: ${symbol.version}` : ''}
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
