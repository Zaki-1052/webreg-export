#!/usr/bin/env node

/**
 * Utility script to generate secure admin tokens
 * Run with: node scripts/generate-admin-token.js
 */

const { generateSecureToken, isValidAdminToken } = require('../config/adminAuth');

console.log('\n' + '='.repeat(60));
console.log('🔐 UCSD WebReg Export - Admin Token Generator');
console.log('='.repeat(60) + '\n');

// Generate a new secure token
const token = generateSecureToken();

console.log('Generated secure admin token:');
console.log('\n  ' + token + '\n');

// Verify the token meets security requirements
if (isValidAdminToken(token)) {
  console.log('✅ Token meets all security requirements');
} else {
  console.error('❌ Token validation failed (this should not happen)');
  process.exit(1);
}

console.log('\nTo use this token:');
console.log('1. Add to your .env file:');
console.log(`   ADMIN_TOKEN=${token}`);
console.log('\n2. Or set as environment variable:');
console.log(`   export ADMIN_TOKEN="${token}"`);
console.log('\n3. Use in API requests:');
console.log(`   Authorization: Bearer ${token}`);

console.log('\n⚠️  Security Notes:');
console.log('- Keep this token secret and secure');
console.log('- Never commit tokens to version control');
console.log('- Rotate tokens regularly (monthly recommended)');
console.log('- Use different tokens for dev/staging/production');

console.log('\n' + '='.repeat(60) + '\n');