#!/usr/bin/env node

/**
 * Convert Markdown to HTML using marked
 * Usage: node markdown-to-html.js <input.md> <output.html>
 */

const fs = require('fs');
const { marked } = require('marked');

// Configure marked for proper HTML output
marked.setOptions({
  gfm: true,              // GitHub Flavored Markdown
  breaks: false,          // Don't convert \n to <br>
  headerIds: true,        // Add IDs to headers
  mangle: false,          // Don't mangle email addresses
  sanitize: false         // Don't sanitize HTML (we trust our input)
});

// Logo and footer configuration
const LOGO_URL = 'https://raw.githubusercontent.com/enuno/moltbot-philosopher/refs/heads/main/assets/logo/noesis_logo.png';
const MOLTBOOK_PROFILE = 'https://www.moltbook.com/u/MoltbotPhilosopher';

function wrapWithHeaderAndFooter(html) {
  const header = `<div style="text-align: center; margin-bottom: 2rem;">
  <a href="${MOLTBOOK_PROFILE}" target="_blank" rel="noopener">
    <img src="${LOGO_URL}" alt="Noesis - The Divided Line" style="max-width: 200px; height: auto;" />
  </a>
</div>

`;

  const footer = `

<hr style="margin-top: 3rem; margin-bottom: 1.5rem; border: none; border-top: 1px solid #e5e7eb;" />

<div style="text-align: center; padding: 1.5rem 0; color: #6b7280; font-size: 0.875rem;">
  <p style="margin: 0.5rem 0;">
    <strong>Noesis</strong> — Essays in Applied Philosophy
  </p>
  <p style="margin: 0.5rem 0;">
    <em>Where Virgil's hexameters meet Camus' rocks and Jefferson's plow</em>
  </p>
  <p style="margin: 1rem 0;">
    <a href="${MOLTBOOK_PROFILE}" target="_blank" rel="noopener" style="color: #1E3A8A; text-decoration: none; font-weight: 500;">
      Follow on Moltbook →
    </a>
  </p>
</div>`;

  return header + html + footer;
}

function convertMarkdownToHtml(inputFile, outputFile) {
  try {
    // Read markdown file
    const markdown = fs.readFileSync(inputFile, 'utf8');

    // Skip frontmatter if present
    let content = markdown;
    if (markdown.startsWith('---')) {
      const parts = markdown.split('---');
      if (parts.length >= 3) {
        // Frontmatter exists, skip it
        content = parts.slice(2).join('---').trim();
      }
    }

    // Convert to HTML
    const html = marked.parse(content);

    // Wrap with header and footer
    const wrappedHtml = wrapWithHeaderAndFooter(html);

    // Write HTML file
    fs.writeFileSync(outputFile, wrappedHtml, 'utf8');

    console.log(`✓ Converted ${inputFile} to ${outputFile}`);
    console.log(`  Input: ${content.length} chars`);
    console.log(`  Output: ${wrappedHtml.length} chars`);

    process.exit(0);
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node markdown-to-html.js <input.md> <output.html>');
  process.exit(1);
}

const [inputFile, outputFile] = args;

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

convertMarkdownToHtml(inputFile, outputFile);
