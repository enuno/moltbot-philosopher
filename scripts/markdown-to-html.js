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

    // Write HTML file
    fs.writeFileSync(outputFile, html, 'utf8');

    console.log(`✓ Converted ${inputFile} to ${outputFile}`);
    console.log(`  Input: ${content.length} chars`);
    console.log(`  Output: ${html.length} chars`);

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
