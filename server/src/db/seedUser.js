/**
 * Seed a default test user for development/testing
 * Run from server directory: node src/db/seedUser.js
 */

const { createUser, findByEmail } = require('./users');

async function seedUser() {
  const testEmail = 'publisher@gmail.com';
  const testPassword = 'User123';

  console.log(`\n🌱 Seeding test user...`);
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}\n`);

  // Check if user already exists
  const existing = findByEmail(testEmail);
  if (existing) {
    console.log(`✓ User already exists: ${testEmail}`);
    console.log(`  ID: ${existing.id}`);
    console.log(`  Created: ${existing.createdAt}\n`);
    return;
  }

  // Create new user
  try {
    const result = await createUser(testEmail, testPassword);
    if (result.error) {
      console.log(`✗ Error: ${result.error}\n`);
      return;
    }
    console.log(`✓ User created successfully:`);
    console.log(`  ID: ${result.id}`);
    console.log(`  Email: ${result.email}`);
    console.log(`  Created: ${result.createdAt}\n`);
  } catch (err) {
    console.log(`✗ Error: ${err.message}\n`);
  }
}

seedUser();
