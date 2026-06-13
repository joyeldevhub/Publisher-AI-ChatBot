#!/usr/bin/env node
/**
 * Seed script: Clear knowledge base and load generic publishing entries
 * Usage: node seedKB.js
 */

const fs = require('fs');
const path = require('path');
const entries = require('./publishingEntries');

const KB_PATH = path.join(__dirname, '../data/knowledge.json');

async function seedKB() {
  try {
    console.log('🔄 Clearing knowledge base...');
    fs.writeFileSync(KB_PATH, JSON.stringify([], null, 2));
    console.log('✓ Knowledge base cleared');

    console.log('📝 Loading generic publishing entries...');
    // Write entries without embeddings (they'll be generated on first search)
    const entriesWithoutEmbedding = entries.map(({ ...rest }) => rest);
    fs.writeFileSync(KB_PATH, JSON.stringify(entriesWithoutEmbedding, null, 2));
    console.log(`✓ Loaded ${entries.length} generic publishing entries`);

    console.log('\n✨ Knowledge base seeded successfully!');
    console.log('Note: Embeddings will be generated on first search/use.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seedKB();
