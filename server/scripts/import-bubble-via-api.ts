#!/usr/bin/env tsx
/**
 * Import all question sets from Bubble via the admin API
 * This script uses the existing admin API endpoints
 */

async function main() {
  const API_BASE = 'http://localhost:5000';
  
  console.log('🚀 Starting Bubble import via Admin API...\n');
  
  try {
    // Step 1: Fetch all question sets from Bubble via admin API
    console.log('📥 Fetching question sets from Bubble...');
    const fetchResponse = await fetch(`${API_BASE}/api/admin/bubble/question-sets`, {
      headers: {
        'Cookie': 'connect.sid=s%3AVpgfLKAykgGYfcUBl4G95eDridD4wKJS.OdNQjMCyQQYoB5NVyd2koBWcN%2Fw0YhpNIJQW%2FkKOEtU' // You'll need to replace this with a valid admin session
      }
    });
    
    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`Failed to fetch question sets: ${fetchResponse.status} - ${error}`);
    }
    
    const data = await fetchResponse.json();
    const questionSets = data.response?.results || [];
    
    console.log(`✅ Found ${questionSets.length} question sets\n`);
    
    if (questionSets.length === 0) {
      console.log('⚠️  No question sets found to import');
      return;
    }
    
    // Step 2: Import all question sets
    console.log('📤 Importing all question sets...');
    const importResponse = await fetch(`${API_BASE}/api/admin/bubble/import-question-sets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AVpgfLKAykgGYfcUBl4G95eDridD4wKJS.OdNQjMCyQQYoB5NVyd2koBWcN%2Fw0YhpNIJQW%2FkKOEtU' // Same session cookie
      },
      body: JSON.stringify({ questionSets })
    });
    
    if (!importResponse.ok) {
      const error = await importResponse.text();
      throw new Error(`Failed to import: ${importResponse.status} - ${error}`);
    }
    
    const result = await importResponse.json();
    console.log('\n✅ Import completed!');
    console.log(result.message);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);