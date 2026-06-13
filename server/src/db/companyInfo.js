const { v4: uuidv4 } = require('uuid');
const { addEntry, getAllEntries } = require('../services/vectorStore');

const COMPANY_ENTRIES = [
  {
    title: 'What is DocFlow?',
    category: 'General',
    error_description: 'User asks what DocFlow is, what it does, or what it can help with.',
    solution: 'DocFlow is an AI-powered support chatbot designed to help publishing professionals quickly resolve technical issues and questions.\n\nDocFlow can help with:\n- Citation formatting (APA, MLA, Chicago, Harvard, IEEE)\n- XML and JATS validation\n- DTD and XSD validation\n- Proofreading and editing guidelines\n- Table, figure, and equation formatting\n- PDF and EPUB generation and rendering\n- Publishing standards (PMC, Crossref, ISSN, ISBN, WCAG)\n- Metadata and accessibility requirements\n- General publishing workflow questions\n\nDocFlow uses a local knowledge base and web search to provide accurate, industry-standard answers. For complex or unresolved issues, it will guide you to human support resources.',
  },
  {
    title: 'DocFlow Capabilities and Features',
    category: 'General',
    error_description: 'User asks what DocFlow can do, what topics it covers, or what features are available.',
    solution: 'DocFlow covers the full publishing workflow, including:\n\n1. Citation Management — APA, MLA, Chicago, Harvard, IEEE formats; DOI and URL handling\n2. XML & Markup — JATS XML validation, well-formed XML, namespaces, special characters\n3. Validation — DTD, XSD, Schematron validation; error message interpretation\n4. Formatting — Tables, figures, equations, headings, structure, cross-references\n5. Outputs — EPUB conversion, PDF quality and rendering, format compatibility\n6. Standards — PMC requirements, Crossref registration, ISSN vs ISBN, WCAG accessibility\n7. Fonts & Colors — Font embedding, color consistency, international character support\n8. Images — Image handling, figure tagging, supplementary materials\n9. Metadata — Essential metadata, publication dates, keywords, author roles, licensing\n10. Proofreading — Punctuation, grammar, stylistic consistency, hyphenation\n\nAnswers are drawn from a curated knowledge base or verified through web search.',
  },
  {
    title: 'Publishing Standards and Compliance',
    category: 'General',
    error_description: 'User asks about publishing standards, compliance, or industry requirements.',
    solution: 'Key publishing standards and compliance frameworks:\n\n- JATS XML — Standard for journal article markup in scientific publishing\n- DTD/XSD Validation — Ensuring well-formed, compliant documents\n- PMC (PubMed Central) — Requirements for open-access publication\n- Crossref — DOI registration and citation linking\n- WCAG 2.1 — Web Accessibility Guidelines for digital publications\n- ISSN/ISBN — International Standard Serial/Book Numbers for identification\n- Dublin Core Metadata — Standard metadata elements for resources\n- Schematron — Advanced validation for complex rules\n\nDocFlow can help navigate these standards and ensure your content meets industry requirements.',
  },
  {
    title: 'Using DocFlow for Common Publishing Questions',
    category: 'General',
    error_description: 'User wants to know how to get help with publishing-related problems.',
    solution: 'DocFlow helps with publishing questions in several ways:\n\n1. Ask a specific question — "How do I format citations in APA?" or "What is JATS XML?"\n2. Describe an error — Share error messages or descriptions, and DocFlow will suggest solutions\n3. Report issues — Use thumbs up/down feedback to help improve the knowledge base\n4. Escalate if needed — DocFlow will direct you to human support for complex issues\n\nTips for best results:\n- Be specific about your publishing format (PDF, EPUB, HTML, XML)\n- Include error messages or symptoms\n- Mention the tool or platform you\'re using\n- Provide context about your publishing workflow\n\nDocFlow has access to a comprehensive knowledge base covering all major publishing topics.',
  },
  {
    title: 'DocFlow Knowledge Base and Web Search',
    category: 'General',
    error_description: 'User asks how DocFlow finds answers or what sources it uses.',
    solution: 'DocFlow uses a two-stage approach to find answers:\n\n1. Knowledge Base Search — Searches a curated database of 65+ publishing entries covering citations, XML, validation, formatting, accessibility, and standards. Answers from the KB are verified and specific to publishing.\n\n2. Web Search Fallback — If an answer isn\'t in the knowledge base, DocFlow searches Stack Exchange communities (TeX Stack Exchange, Academia Stack Exchange, Stack Overflow) for relevant answers and best practices.\n\n3. Feedback Loop — Users can flag helpful answers with a thumbs-up (saved to KB) or unhelpful answers with a thumbs-down (reviewed and improved).\n\nAll answers prioritize accuracy and industry best practices. DocFlow runs completely locally — no data is sent to external AI services.',
  },
  {
    title: 'Typesetting and Format Support',
    category: 'General',
    error_description: 'User asks what publishing formats, typesetting systems, or file formats are supported.',
    solution: 'DocFlow provides guidance on a wide range of publishing formats and typesetting technologies:\n\nFile Formats:\n- XML/JATS — Structured markup for journals and academic publishing\n- PDF — Print and digital publications\n- EPUB — E-books and digital publications\n- HTML — Web publishing\n- DOCX — Word documents and manuscript preparation\n\nTypesetting Technologies:\n- LaTeX — Scientific and mathematical typesetting\n- XSL-FO — XML-driven formatting\n- InDesign — High-design layouts\n- Various composition systems\n\nDocFlow can help with validation, conversion, troubleshooting, and best practices for any of these formats and technologies.',
  },
];

async function seedCompanyInfo() {
  try {
    const existing = getAllEntries();
    const existingTitles = new Set(existing.map((e) => e.title));
    // Add only the entries that are missing — avoids the all-or-nothing skip that
    // left entries like "Using DocFlow for Common Publishing Questions" out of the KB.
    const missing = COMPANY_ENTRIES.filter((e) => !existingTitles.has(e.title));
    if (missing.length === 0) return;

    console.log(`  Seeding ${missing.length} missing DocFlow company info entr${missing.length === 1 ? 'y' : 'ies'}…`);
    for (const entry of missing) {
      await addEntry({ id: uuidv4(), ...entry, source_files: [] });
    }
    console.log(`  ✓ Added ${missing.length} company info entries to KB`);
  } catch (err) {
    console.error('  [companyInfo seed] Error:', err.message);
  }
}

module.exports = { seedCompanyInfo };
