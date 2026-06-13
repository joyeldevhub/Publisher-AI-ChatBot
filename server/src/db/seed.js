/**
 * Knowledge Base Seed Script — LaTeX Setter Formatting Guidelines
 * Source: Latex.docx (internal e-publishing guidelines)
 * Run from the server directory: node src/db/seed.js
 * Requires Ollama running with nomic-embed-text model.
 */

const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

const { addEntry, getAllEntries } = require('../services/vectorStore');

// ─── Knowledge entries extracted from Latex.docx ─────────────────────────────

const ENTRIES = [

  // ══════════════════════════════════════════════════════════════════
  // OFFLINE ARTICLE PROCESSING
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Offline Article Processing — When to Take an Article Offline',
    category: 'LaTeX Setter',
    error_description: 'Article needs to be taken offline for manual processing. Conditions include: presence of landscape images, article opener page not properly rendered due to many authors or affiliations, print-based articles, force justify not yet implemented, short page not yet implemented, figure continued not yet implemented, presence of a greater number of figures and tables in the Appendix section with challenges in float ordering, complex decimal alignment in tables.',
    solution: 'Take the article offline for manual intervention in these scenarios:\n1. Landscape images — cannot be handled automatically.\n2. Article opener page broken due to many authors or affiliations — needs manual layout.\n3. Print-based articles.\n4. Force justify, short page, or figure continued are not yet implemented in the tool.\n5. Complex decimal alignment in tables.\n6. Greater number of figures and tables in Appendix section where floats cannot be ordered sequentially.\n\nNote: The following were previously offline scenarios but have been fixed:\n- Inline tables and images (Fixed Apr 29)\n- Long tables (Fixed Apr 29)\n- Landscape tables (Fixed Apr 29)\n- Endnotes (Fixed Sept 23)\n- Straddle rule within tables (Fixed May 12)\n- Footnote in First Page (Fixed Oct 2)',
  },

  // ══════════════════════════════════════════════════════════════════
  // PENDING PAIN POINTS
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Known Pending Pain Points in LaTeX Proof Generation',
    category: 'LaTeX Setter',
    error_description: 'Recurring unresolved issues in proof generation: orphan and widow lines, row-wise splitting of long tables, excess spacing (above headings, between floats and text, between equations), decimal alignment in tables, color figures converting to greyscale in printer files, equations not rendering correctly requiring manual LaTeX command adjustments.',
    solution: '1. Orphan/widow lines — addressed only via workarounds (adjusting image width, adding spacing above headings). Not consistently applied.\n2. Row-wise splitting of long tables — not yet implemented. Results in excessive white space under continued tables.\n3. Excess spacing — above headings, between floats and text, between equations — requires manual spacing controls.\n4. Decimal alignment — unresolved; avoid "dot" alignment in table columns as a workaround.\n5. Color figures to greyscale during printer export — requires offline intervention at the printer stage.\n6. Equations not rendering as in editor — use \\textrm or \\mathrm instead of \\rm.',
  },

  // ══════════════════════════════════════════════════════════════════
  // APPENDIX HEAD REPEATING
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Appendix Head Repeating — Duplicate Appendix Label in Heading',
    category: 'LaTeX Setter',
    error_description: 'Duplicate Appendix labels appear in the heading after proof generation. For example, "Appendix A. Appendix A. Title" appears instead of "Appendix A. Title".',
    solution: 'The appendix label is duplicated because "Appendix A." is not tagged correctly as a label in the editor. Ensure the appendix label is properly tagged as a label element in appendix headings. Correct tagging of labels in appendix headings will prevent the duplication in the generated proof.',
  },

  // ══════════════════════════════════════════════════════════════════
  // AUTHOR QUERIES
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Author Queries — Only Author Queries Displayed in Proof',
    category: 'LaTeX Setter',
    error_description: 'Publisher queries or Kriya automated queries are not appearing in the proof. Only author queries show up.',
    solution: 'The current proofing mechanism is configured to display only author queries. Publisher queries and Kriya automated queries are not included by design and will not appear in the proof. This is expected behaviour.',
  },
  {
    title: 'Query Page Not Rendering in Proof',
    category: 'LaTeX Setter',
    error_description: 'The query page of an article is not rendering in the proof.',
    solution: 'The query page renders only when the data-query-page="true" attribute is set on the title node of the article. Steps:\n1. Click on the title paragraph.\n2. Open the Insert menu.\n3. Select Modify Attributes.\n4. Click Add Attribute.\n5. Enter data-query-page and set its value to true.',
  },
  {
    title: 'Author Query Numbers Skipped or Out of Sequence',
    category: 'LaTeX Setter',
    error_description: 'Query numbers are being skipped in the proof — for example, the count jumps from AQ4 to AQ7. Some author queries are missing from the sequence.',
    solution: 'Skipped query numbers indicate that a query is placed inside a float-based environment such as a table. Place the query outside the float environment (outside the table block) to fix the sequence issue and make all queries appear correctly.',
  },

  // ══════════════════════════════════════════════════════════════════
  // EQUATION ISSUES
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Equation Label or Number Missing in Proof',
    category: 'LaTeX Setter',
    error_description: 'Equation label or equation number does not appear in the proof. The equation is inside a starred environment like \\begin{align*} or \\begin{equation*}.',
    solution: 'Starred equation environments suppress equation numbering. To display equation numbers, remove the star from the environment:\n- Change \\begin{align*} to \\begin{align} and \\end{align*} to \\end{align}\n- Change \\begin{equation*} to \\begin{equation} and \\end{equation*} to \\end{equation}\nIf the equation number is not required, keep the starred environment as is.',
  },
  {
    title: 'Equations Right-Aligned Instead of Center-Aligned',
    category: 'LaTeX Setter',
    error_description: 'Equations inside align or align* environment are right-aligned instead of center-aligned. No alignment marker is specified so LaTeX defaults to right alignment.',
    solution: 'To center-align equations in the align environment, place the & symbol before the = sign in each equation. The & acts as an anchor point aligning all equations at the equal sign (equal aligning).\n\nExample:\n\\begin{align}\n    x + y & = z \\\\\n    a + b & = c \\\\\n    m - n & = p\n\\end{align}',
  },
  {
    title: 'Using \\displaystyle at the Beginning of an Equation Has No Effect',
    category: 'LaTeX Setter',
    error_description: 'The \\displaystyle command is placed at the start of an equation environment (e.g., \\displaystyle \\begin{equation}...) but does not change the font or style of the equation as expected.',
    solution: 'Do not use \\displaystyle at the beginning of an equation. Example to avoid:\n\\displaystyle \\begin{equation} .... \\end{equation}\n\nThe \\displaystyle command should be used selectively within the equation — for example, before characters like \\sigma or \\sum — not at the equation level. Using it at the start of the equation environment has no effect on font or style.',
  },
  {
    title: 'Display Equation Rendered as Inline Instead of Block',
    category: 'LaTeX Setter',
    error_description: 'A display equation specified as block/display in Kriya is rendering as inline (on the same line as text) in the proof.',
    solution: 'This is likely caused by using \\begin{aligned}...\\end{aligned} or \\begin{gathered}...\\end{gathered} environments. Replace them with their standalone alternatives:\n\n- \\begin{aligned}...\\end{aligned} → \\begin{align*}...\\end{align*} (no equation number)\n  Or \\begin{align}...\\end{align} (with equation number)\n\n- \\begin{gathered}...\\end{gathered} → \\begin{gather*}...\\end{gather*}\n\n- If it is a single equation, wrap the aligned environment inside an equation environment instead.',
  },
  {
    title: 'Using \\rule Command in Equations Breaks Text Flow',
    category: 'LaTeX Setter',
    error_description: 'The \\rule command is used in inline or display equations. This breaks the flow of text in the PDF. \\rule is not a recognized command in TeX for this purpose.',
    solution: 'Replace \\rule with \\underline in all inline and display equations.\n\nIncorrect: equation using \\rule\nCorrect: replace with \\underline\n\nUsing \\underline achieves the same visual effect without breaking the text flow.',
  },
  {
    title: 'Equation Using {rc} Parameter with \\begin{gather} Causes Rendering Error',
    category: 'LaTeX Setter',
    error_description: 'An equation uses {rc} as a parameter with \\begin{gather}{rc}...\\end{gather}. This causes incorrect rendering in the proof.',
    solution: 'The {rc} parameter is not valid for the gather environment. Remove it.\n\nIncorrect:\n\\begin{gather}{rc}\n  equation content\n\\end{gather}\n\nCorrected:\n\\begin{gather}\n  equation content\n\\end{gather}\n\nThe gather environment does not accept parameters — remove any text between \\begin{gather} and the first equation line.',
  },
  {
    title: 'Multiline Equation Using equation + split Causes Number Overlap',
    category: 'LaTeX Setter',
    error_description: 'Multiline equations are written using \\begin{equation}\\begin{split}...\\end{split}\\end{equation}. The equation number overlaps with content, especially for long equations.',
    solution: 'Use the align environment instead of equation+split for multiline equations. The align environment handles multiple lines better, keeps spacing clean, and avoids label merging.\n\nInstead of:\n\\begin{equation}\\begin{split}... \\\\ ...\\end{split}\\end{equation}\n\nUse:\n\\begin{align}... \\\\ ...\\end{align}\n\nFor custom numbering:\n\\begin{align}\\tag{2.28}\\begin{split}... \\\\ ...\\end{split}\\end{align}\n\nUse \\notag to skip numbers on specific lines.',
  },
  {
    title: 'Reversible Arrow \\xrightleftharpoons Not Rendering — Mathtools Package Missing',
    category: 'LaTeX Setter',
    error_description: 'The \\xrightleftharpoons command is not rendering or is not recognized. This command requires the mathtools package.',
    solution: '\\xrightleftharpoons[below]{above} is provided by the mathtools package. If the package is not available, convert it to low-level commands:\n\n\\stackrel{above}{\\underset{below}{symbol}}\n\nExample conversion:\nOriginal: A+B \\xrightleftharpoons[k^{-}]{k^+} C\nConverted: A + B \\stackrel{k^+}{\\underset{k^{-}}{\\rightleftharpoons}} C\n\nStructure:\n- {k^+} goes above the arrow\n- [k^-] goes below the arrow',
  },
  {
    title: 'Using \\limits Inside \\begin{cases} Causes Rendering Error',
    category: 'LaTeX Setter',
    error_description: 'An equation uses \\limits inside a \\begin{cases} environment (e.g., \\sum_\\limits{...}). This causes incorrect rendering in the proof.',
    solution: 'Replace \\sum_\\limits{...} with \\displaystyle \\sum_{...} inside the cases environment.\n\nIncorrect (causes rendering error):\n\\sum_\\limits{i=0}^{N}k_{\\textrm{off}}C_{i}\n\nCorrected:\n\\displaystyle \\sum_{i=0}^{N}k_{\\textrm{off}}C_{i}\n\nRemove all instances of \\limits inside \\begin{cases} and replace with the \\displaystyle prefix before the sum/product operator.',
  },

  // ══════════════════════════════════════════════════════════════════
  // FLOAT PLACEMENT / FIGURE CONTROLS
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Algorithm Not Placed Correctly — Should Be Treated as Figure',
    category: 'LaTeX Setter',
    error_description: 'An algorithm block is not being placed or formatted correctly in the proof. It needs to be treated as a figure/algorithm float.',
    solution: 'To mark an element as an algorithm float:\n1. Click on the figure/element you want to modify.\n2. Open the Insert menu.\n3. Select Modify Attributes.\n4. Click Add Attribute.\n5. Enter data-image-type and set its value to algorithm.\n\nNote: If you cannot do this, contact support (L2) to add the attribute.',
  },
  {
    title: 'Float Placement Wrong — Figure or Table on Wrong Page',
    category: 'LaTeX Setter',
    error_description: 'A figure or table is appearing on the wrong page or in the wrong order. Need to move a float to a different page or change the order of floats on a page.',
    solution: 'Use the data-place-floats attribute on a paragraph to control float placement:\n1. Click on the paragraph where you want the float to appear after.\n2. Open the Insert menu → Select Modify Attributes → Click Add Attribute.\n3. Enter data-place-floats and set its value to the float ID (e.g., BLK_F1).\n4. For multiple floats, separate IDs with commas (e.g., BLK_F1,BLK_F2).\n\nImportant: This attribute works only on paragraphs — not on headings, equations, floats, or lists.',
  },
  {
    title: 'Figure Reordering Issue When Using data-place-floats Attribute',
    category: 'LaTeX Setter',
    error_description: 'After applying data-place-floats to move Figure 2 to an earlier page, Figure 2 appears before Figure 1, causing figures to be out of sequence.',
    solution: 'When multiple figures need to be placed together, always list ALL figures (including the ones already on the page) in the data-place-floats attribute in the correct order.\n\nIncorrect (causes Figure 2 to appear before Figure 1):\ndata-place-floats="BLK_F2"\n\nCorrect (preserves sequence):\ndata-place-floats="BLK_F1,BLK_F2"\n\nThis ensures Figure 1 appears immediately after the paragraph, followed by Figure 2 in the correct order.',
  },
  {
    title: 'Placing a Figure Before a Table on the Same Page',
    category: 'LaTeX Setter',
    error_description: 'On a page that has both a figure and a table, the table is appearing before the figure, but the figure should come first.',
    solution: 'To place a figure before a table on the same page, go to the preceding page and add the data-place-floats attribute to the relevant paragraph with the table ID listed first, then the figure ID:\n\ndata-place-floats="BLK_table_ID,BLK_fig_ID"\n\nListing the table ID first ensures it is placed before the figure in the float queue, resulting in the figure appearing before the table on the output page.',
  },
  {
    title: 'Appendix Figure Appearing at Top of Page Instead of In-Place',
    category: 'LaTeX Setter',
    error_description: 'An appendix figure is appearing at the top of the page by default (RS template places floats at the top), but it should appear exactly where it is referenced in the text (in-place).',
    solution: 'Use data-floats-style="inplace" on the figure to override default top placement:\n1. Click on the figure you want to modify.\n2. Open the Insert menu → Select Modify Attributes → Click Add Attribute.\n3. Enter data-floats-style and set its value to inplace.\n\nOptionally, to add a barrier after the image (to control content flow before the image):\n4. Enter data-floats-barrier and set its value to true.\n\nAlternatively, tag the figure as inline to render it in-place.\n\nNote: This attribute works only on figure floats, not on paragraphs, headings, equations, or lists.',
  },
  {
    title: 'Figure or Table Number Incorrect in Proof',
    category: 'LaTeX Setter',
    error_description: 'The figure or table number in the proof is incorrect. For example, a correction article has only Figure 10, but the proof labels it Figure 1 because the template auto-counts from 1.',
    solution: 'Override the auto-counter using the data-step-counter attribute:\n1. Click on the figure or table that must be updated.\n2. Open the Insert menu → Select Modify Attributes → Click Add Attribute.\n3. Enter data-step-counter and set its value to the correct number (e.g., 12 for Figure 12).\n\nExample: data-step-counter = "12"\n\nNote for equations: Do not enter a decimal label (e.g., 3.5). Enter the ordinal position of the equation (e.g., 5 for the 5th equation).',
  },
  {
    title: 'Content Overflows Page — Need to Push Content to Next Page After Float',
    category: 'LaTeX Setter',
    error_description: 'Content after a figure or table overflows the page due to tight float placement. Need to force content after the float to move to the next page.',
    solution: 'Use the data-clearpage="true" attribute on the figure or table to push content after it to the next page:\n1. Click on the figure or table.\n2. Open the Insert menu → Select Modify Attributes → Click Add Attribute.\n3. Enter data-clearpage and set its value to true.\n\nNote: This attribute works only on figure/table floats, not on paragraphs, headings, equations, or lists.',
  },

  // ══════════════════════════════════════════════════════════════════
  // SPACING CONTROLS
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Adding Space Above or Below a Paragraph',
    category: 'LaTeX Setter',
    error_description: 'Need to add space above or below a specific paragraph in the proof to improve layout.',
    solution: 'Use data-space-top and data-space-bottom attributes on the paragraph:\n1. Click on the paragraph.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. Enter data-space-top with a numeric value to add lines above (e.g., data-space-top="1" adds one line above).\n4. Enter data-space-bottom with a numeric value to add lines below (e.g., data-space-bottom="1" adds one line below).\n\nNote: These attributes work only on paragraphs — not on headings, equations, floats, or lists.',
  },
  {
    title: 'Adding or Removing Space Above a Heading',
    category: 'LaTeX Setter',
    error_description: 'Too much or too little space above a heading in the proof. Need to adjust spacing above a heading.',
    solution: 'Use the data-top-gap attribute on the heading:\n1. Click on the heading.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. Enter data-top-gap with a point value.\n\nTo add space: data-top-gap="12pt" (adds 12pt above the heading)\nTo remove space: data-top-gap="-12pt" (reduces space above heading by 12pt)\n\nNote: This attribute works only on headings — not on paragraphs, equations, floats, or lists.',
  },
  {
    title: 'Gaining or Losing a Line in a Paragraph or List Item',
    category: 'LaTeX Setter',
    error_description: 'A paragraph or list item needs to be stretched to gain a line (add a line) or tightened to lose a line to fix layout issues like widow/orphan lines.',
    solution: 'Use data-gain-a-line or data-loose-a-line attributes:\n1. Click on the paragraph or list item.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. To gain a line: Enter data-gain-a-line with value "true".\n4. To tighten/lose a line: Enter data-loose-a-line with value "true".\n\nNote: These attributes work only on paragraphs — not on headings, equations, floats, or lists.',
  },

  // ══════════════════════════════════════════════════════════════════
  // INDENTATION
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Indenting or Removing Indent from a Paragraph',
    category: 'LaTeX Setter',
    error_description: 'A paragraph is incorrectly indented or needs indentation removed in the proof.',
    solution: 'To indent/remove indent via proof controls:\n- Select the paragraph → Choose proof controls → Select "remove indent paragraph" option → Click Add or Remove.\n\nTo prevent indentation using attributes:\n1. Select the paragraph.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. Add data-indent and set its value to an integer (e.g., 12).\n\nNote: The numerical value is relevant for AHS proofing but does not affect LaTeX typesetting. LaTeXSetter applies indentation based on template configuration and ignores this numerical value.\n\nThis attribute works only on paragraphs — not on headings, equations, floats, or lists.',
  },

  // ══════════════════════════════════════════════════════════════════
  // TABLE CONTROLS
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Table Too Wide — Does Not Fit on Page',
    category: 'LaTeX Setter',
    error_description: 'A table is too wide to fit on the page. The content overflows or is cut off.',
    solution: 'Reduce the font size of the table to make it fit:\n1. Adjust the font size of the table using table setter to a lower value.\n2. Generate the proof again after reducing the font size.\n\nThis is the recommended approach when the table must remain on a single page and cannot be reformatted otherwise.',
  },
  {
    title: 'Table Column Decimal Alignment Breaking Proof or PDF Half-Generated',
    category: 'LaTeX Setter',
    error_description: 'Table alignment is breaking and text like "[table-column-width=..." appears in the proof. Or the PDF is generated only halfway. One or more columns have decimal (dot) alignment.',
    solution: '1. Preview the table using table setter.\n2. Check the alignment of each column.\n3. If any column alignment is set to "dot", change it to "None".\n4. Re-proof the manuscript.\n\nImportant: If you change the table layout from "single" to "double" or "landscape", the column alignment will automatically reset. After any layout change, recheck all column alignments and reset any that reverted to "dot".',
  },
  {
    title: 'Removing Column Separation Space in Tables',
    category: 'LaTeX Setter',
    error_description: 'Table columns have too much space between them (default is 6pt in LaTeX templates). Need to remove or reduce column separation.',
    solution: 'Use the data-remove-colsep attribute on the table:\n1. Select the table.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. Enter data-remove-colsep and set its value to "true".\n\nThis removes the default 6pt column separation space.\n\nNote: This attribute works only on tables — not on headings, equations, floats, or list items.',
  },

  // ══════════════════════════════════════════════════════════════════
  // DEPRECATED LATEX COMMANDS
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Deprecated LaTeX Formatting Commands — \\bf \\it \\rm \\sf \\tt',
    category: 'LaTeX Setter',
    error_description: 'Old-style LaTeX commands such as \\bf, \\it, \\rm, \\sf, or \\tt are used for text formatting. These are deprecated and do not work well with modern font encodings.',
    solution: 'Replace deprecated commands with modern equivalents:\n\nBold text:\n  Avoid: {\\bf text} or \\bf text\n  Use: \\textbf{text}\n\nItalic text:\n  Avoid: {\\it text} or \\it text\n  Use: \\textit{text}\n\nRoman font:\n  Avoid: {\\rm text} or \\rm text\n  Use: \\textrm{text}\n\nSans-serif: use \\textsf{text}\nTypewriter/monospace: use \\texttt{text}',
  },
  {
    title: 'Bold Calligraphic Math Symbols — \\boldsymbol{\\mathcal{}} Not Supported',
    category: 'LaTeX Setter',
    error_description: 'Equations use $\\boldsymbol{\\mathcal{E}}$ (or similar bold calligraphic symbols). The \\boldsymbol command is not supported in the LaTeX template and does not render correctly.',
    solution: 'Replace \\boldsymbol{\\mathcal{}} with \\mathbfcal{}:\n\nIncorrect: $\\boldsymbol{\\mathcal{E}}$\nCorrect: $\\mathbfcal{E}$\n\nApply this replacement to all instances of \\boldsymbol{\\mathcal{...}} in the document.',
  },
  {
    title: 'Greek Symbols Rendering Italic Instead of Upright (Royal Society Journals)',
    category: 'LaTeX Setter',
    error_description: 'In Royal Society journals, uppercase Greek symbols such as \\Gamma, \\Delta, \\Theta, \\Lambda, \\Xi, \\Pi, \\Sigma, \\Upsilon, \\Phi, \\Psi, \\Omega are rendering in italic style instead of upright (roman) style, even though MathJax renders them upright.',
    solution: 'This is by design for Royal Society journals. The Royal Society template redeclares these symbols to their italic variants.\n\nThese standard commands render italic in the RS template:\n\\Gamma, \\Delta, \\Theta, \\Lambda, \\Xi, \\Pi, \\Sigma, \\Upsilon, \\Phi, \\Psi, \\Omega\n\nIf upright rendering is required, use the corresponding \\var versions:\nExample: \\Delta → \\varDelta\n\nMathJax renders these symbols upright by default, but the Royal Society LaTeX template overrides this to use italic style.',
  },

  // ══════════════════════════════════════════════════════════════════
  // PROOF GENERATION FAILURES
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Proof Generation Failed — Unsupported Equation Commands',
    category: 'LaTeX Setter',
    error_description: 'Proof generation fails completely. No proof is produced. Multiple unsupported equation commands are present in the editor.',
    solution: 'Proof generation will fail if the document contains unsupported equation commands. Steps to resolve:\n1. Check the editor for unsupported LaTeX equation commands.\n2. If there are multiple occurrences of unsupported equations, the proof generation will fail.\n3. Identify the unsupported commands and replace them with supported equivalents.\n4. Common unsupported commands: \\rule in equations (replace with \\underline), \\boldsymbol{\\mathcal{}} (replace with \\mathbfcal{}), physics package commands like \\qty or \\grad.\n5. After replacing all unsupported commands, regenerate the proof.',
  },

  // ══════════════════════════════════════════════════════════════════
  // FRONT PAGE CONTROLS (ROYAL SOCIETY)
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Unwanted Content Moving to First Page Gap (Royal Society) — data-skip-fpsplit',
    category: 'LaTeX Setter',
    error_description: 'A paragraph or heading is incorrectly moving to fill the gap between the abstract block and the copyright statement block on the first page of a Royal Society journal article, causing layout issues.',
    solution: 'Use the data-skip-fpsplit="true" attribute to prevent the node from moving to the first page:\n1. Click on the paragraph or heading that should not move to the first page.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. Enter data-skip-fpsplit and set its value to "true".\n\nNote: Adding data-skip-fpsplit to a node will also prevent all subsequent consecutive nodes from moving to the first page.',
  },
  {
    title: 'Abstract Split Causing Widow/Orphan Line on Second Page (Royal Society) — data-split-abs',
    category: 'LaTeX Setter',
    error_description: 'The abstract paragraph splits on the first page of a Royal Society article, but the split point results in a widow or orphan line on the second page.',
    solution: 'Use the data-split-abs="true" attribute on an empty span node inserted at the desired split point in the abstract:\n\n1. Identify the exact word in the abstract where the split should occur to avoid the widow/orphan line.\n2. Insert an empty span node at that position.\n3. Add the attribute data-split-abs="true" to that span node.\n\nImportant: There is currently no proof control available in the editor for this. This must be done by the support team (L2). Raise a request if this adjustment is needed.',
  },
  {
    title: 'Left Panel Spacing on First Page Too Large (Royal Society) — data-adjust-stub-space',
    category: 'LaTeX Setter',
    error_description: 'The left panel (stub area) spacing on the first page of a Royal Society journal article is too large and needs to be reduced.',
    solution: 'Use the data-adjust-stub-space attribute on the journal title:\n1. Click on the title of the journal.\n2. Open Insert → Modify Attributes → Add Attribute.\n3. Enter data-adjust-stub-space and set its value to the number of points to reduce (e.g., data-adjust-stub-space="1").\n\nNote: The value reduces the spacing in points (pt).',
  },

  // ══════════════════════════════════════════════════════════════════
  // FOLIO / PAGE NUMBER
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Folio Block or Page Number Missing from Proof',
    category: 'LaTeX Setter',
    error_description: 'The folio block or page number is missing from a page in the proof. The page with the missing folio contains an image.',
    solution: 'If the folio block or page number is missing on a page that contains an image, try reducing the width of the image on that page. Reducing the image width often resolves folio block rendering issues caused by the image taking up too much space on the page.',
  },

  // ══════════════════════════════════════════════════════════════════
  // UNSUPPORTED PACKAGES
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Physics Package Commands Not Rendering — \\qty \\grad Not Recognized (Royal Society)',
    category: 'LaTeX Setter',
    error_description: 'Commands from the physics package such as \\qty or \\grad are not rendering correctly or are unrecognized in the proof. The Royal Society LaTeX template does not include the physics package.',
    solution: 'The physics package is not supported in the Royal Society LaTeX template. Commands like \\qty and \\grad will not be recognized and will cause incorrect rendering of equations or text.\n\nThe physics package cannot be imported globally because it redeclares some standard commands like \\div, which would break other functionality.\n\nResolution: Replace all physics package commands with standard LaTeX equivalents:\n- \\qty{value}{unit} → write out the value and unit manually\n- \\grad → \\nabla or write gradient explicitly\n\nRefer to the standard Royal Society template for supported commands.',
  },

  // ══════════════════════════════════════════════════════════════════
  // TABULARRAY PACKAGE
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Why tabularray Package Is Used Instead of tabular',
    category: 'LaTeX Setter',
    error_description: 'Questions about why tabularray is used instead of the standard tabular package. Or tabular-specific formatting is not working as expected.',
    solution: 'The tabularray package is used instead of tabular for these reasons:\n\n1. Row spanning and line rules: In tabular, horizontal lines (rules) often appear within spanned rows, disrupting visual structure. tabularray ensures horizontal lines appear only at the end of a row, keeping formatting clean.\n\n2. Inline long tables: Inline long tables are not supported in the tabular environment. tabularray handles them seamlessly.\n\nIf you are experiencing issues with tabular-specific commands, they may need to be converted to tabularray syntax.',
  },

  // ══════════════════════════════════════════════════════════════════
  // FORCE JUSTIFICATION
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Applying Force Justification to a Paragraph',
    category: 'LaTeX Setter',
    error_description: 'A paragraph needs force justification — the text needs to break at a specific word and the line should be force-justified.',
    solution: 'To force justify content within a paragraph:\n1. Select the Breakpoint — highlight the word in the paragraph where you want the content to break and move to the next line.\n2. Hover over the selected text to reveal Proof Control.\n3. Click on Proof Control.\n4. Click the dropdown and select Force Justify.\n\nThis breaks the content at the selected word and applies force justification within the proof.\n\nNote: Force justify is not yet fully implemented as a general feature — use this proof control method as the available workaround.',
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📚 Starting KB seed — ${ENTRIES.length} entries from Latex.docx\n`);

  const existing = getAllEntries();
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()));

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < ENTRIES.length; i++) {
    const entry = ENTRIES[i];
    const label = `[${String(i + 1).padStart(2, '0')}/${ENTRIES.length}]`;

    if (existingTitles.has(entry.title.toLowerCase())) {
      console.log(`${label} SKIP  — already exists: ${entry.title}`);
      skipped++;
      continue;
    }

    process.stdout.write(`${label} Adding — ${entry.title} ... `);
    try {
      await addEntry({
        id: require('crypto').randomUUID(),
        title: entry.title,
        error_description: entry.error_description,
        solution: entry.solution,
        category: entry.category,
        source_files: ['Latex.docx'],
      });
      console.log('✓');
      added++;
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`);
    }
  }

  console.log(`\n✅ Done. Added: ${added}  |  Skipped (duplicates): ${skipped}\n`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
