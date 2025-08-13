#!/usr/bin/env tsx
/**
 * Script to import all question sets from Bubble repository
 * This will fetch ALL available question sets and import them
 */

import dotenv from 'dotenv';
dotenv.config();

const API_BASE_URL = process.env.APP_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://your-production-url.com' 
    : 'http://localhost:5000');

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;

if (!BUBBLE_API_KEY) {
  console.error('❌ BUBBLE_API_KEY not found in environment variables');
  process.exit(1);
}

async function fetchAllQuestionSets() {
  console.log('🔍 Fetching all question sets from Bubble repository...');
  
  try {
    // Fetch question sets from the Bubble API
    const response = await fetch('https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/assessment_question_set', {
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Bubble API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.response?.results?.length || 0} question sets`);
    
    return data.response?.results || [];
  } catch (error) {
    console.error('❌ Error fetching question sets:', error);
    throw error;
  }
}

async function importQuestionSetsToApp(questionSets: any[]) {
  console.log(`\n📥 Importing ${questionSets.length} question sets to the application...`);
  
  try {
    // First, we need to authenticate as admin
    // For this script, we'll use direct database access or you can modify to use admin credentials
    
    const response = await fetch(`${API_BASE_URL}/api/admin/bubble/import-question-sets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers if needed
      },
      body: JSON.stringify({ questionSets }),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Import failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Import result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Error importing question sets:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Bubble Question Sets Import Process...\n');
  
  try {
    // Step 1: Fetch all question sets
    const questionSets = await fetchAllQuestionSets();
    
    if (questionSets.length === 0) {
      console.log('⚠️  No question sets found to import');
      return;
    }

    // Show summary of what will be imported
    console.log('\n📊 Question Sets Summary:');
    questionSets.forEach((qs: any) => {
      console.log(`  - ${qs.title || 'Untitled'} (Course: ${qs.learning_object?.course?.course_number || 'Unknown'})`);
    });

    // Step 2: Import all question sets
    console.log('\nStarting import process...');
    const result = await importQuestionSetsToApp(questionSets);
    
    console.log('\n🎉 Import completed successfully!');
    console.log(`   Imported: ${result.imported || 0}`);
    console.log(`   Failed: ${result.failed || 0}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach((error: string) => {
        console.log(`   - ${error}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Import process failed:', error);
    process.exit(1);
  }
}

// Run the import
main().catch(console.error);