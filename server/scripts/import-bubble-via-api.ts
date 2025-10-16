#!/usr/bin/env tsx
/**
 * Import all question sets from Bubble via the admin API
 * 
 * IMPORTANT SECURITY NOTES:
 * - This script requires admin authentication via a valid session cookie
 * - This is intended for manual execution by administrators only
 * - Never commit session cookies to version control
 * - Session cookies expire and should be kept confidential
 * 
 * AUTHENTICATION METHODS:
 * 1. Environment Variable:
 *    ADMIN_SESSION_COOKIE="your_session_cookie" npm run script:import-bubble
 * 
 * 2. Command Line Argument:
 *    tsx server/scripts/import-bubble-via-api.ts --cookie "your_session_cookie"
 * 
 * HOW TO OBTAIN A VALID SESSION COOKIE:
 * 1. Log into the application as an admin user through the web interface
 * 2. Open browser Developer Tools (F12)
 * 3. Go to Application/Storage tab > Cookies
 * 4. Find the 'connect.sid' cookie
 * 5. Copy the ENTIRE cookie value (including the 's%3A' prefix)
 * 6. Use the cookie value with one of the authentication methods above
 * 
 * EXAMPLE COOKIE FORMAT:
 * connect.sid=s%3A[hash].[signature]
 * 
 * SECURITY BEST PRACTICES:
 * - Only run this script in secure environments
 * - Delete the cookie from your command history after use
 * - Rotate admin credentials regularly
 * - Monitor logs for unauthorized import attempts
 */

/**
 * Get the session cookie from environment variable or command line argument
 */
function getSessionCookie(): string | null {
  // Check environment variable first
  if (process.env.ADMIN_SESSION_COOKIE) {
    return process.env.ADMIN_SESSION_COOKIE;
  }
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const cookieArgIndex = args.findIndex(arg => arg === '--cookie' || arg === '-c');
  
  if (cookieArgIndex !== -1 && args[cookieArgIndex + 1]) {
    return args[cookieArgIndex + 1];
  }
  
  return null;
}

/**
 * Validate and format the cookie for use in headers
 */
function formatCookie(cookieValue: string): string {
  // If the cookie doesn't include the name, add it
  if (!cookieValue.startsWith('connect.sid=')) {
    return `connect.sid=${cookieValue}`;
  }
  return cookieValue;
}

async function main() {
  const API_BASE = process.env.APP_URL || 'http://localhost:5000';
  
  console.log('🚀 Starting Bubble import via Admin API...\n');
  
  // Get and validate authentication
  const sessionCookie = getSessionCookie();
  
  if (!sessionCookie) {
    console.error('❌ ERROR: No admin session cookie provided!\n');
    console.error('Please provide authentication using one of these methods:');
    console.error('1. Environment variable: ADMIN_SESSION_COOKIE="your_cookie" npm run script:import-bubble');
    console.error('2. Command line: tsx server/scripts/import-bubble-via-api.ts --cookie "your_cookie"\n');
    console.error('See the script documentation for instructions on obtaining a valid session cookie.');
    process.exit(1);
  }
  
  const formattedCookie = formatCookie(sessionCookie);
  console.log('🔐 Admin authentication provided\n');
  
  try {
    // Step 1: Fetch all question sets from Bubble via admin API
    console.log('📥 Fetching question sets from Bubble...');
    const fetchResponse = await fetch(`${API_BASE}/api/admin/bubble/question-sets`, {
      headers: {
        'Cookie': formattedCookie
      }
    });
    
    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      if (fetchResponse.status === 401 || fetchResponse.status === 403) {
        throw new Error(`Authentication failed. Please ensure you are using a valid admin session cookie.\nServer response: ${error}`);
      }
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
        'Cookie': formattedCookie
      },
      body: JSON.stringify({ questionSets })
    });
    
    if (!importResponse.ok) {
      const error = await importResponse.text();
      if (importResponse.status === 401 || importResponse.status === 403) {
        throw new Error(`Authentication failed during import. Session may have expired.\nServer response: ${error}`);
      }
      throw new Error(`Failed to import: ${importResponse.status} - ${error}`);
    }
    
    const result = await importResponse.json();
    console.log('\n✅ Import completed successfully!');
    console.log(result.message);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error('\nTroubleshooting tips:');
    console.error('- Ensure you are logged in as an admin user');
    console.error('- Check that your session cookie hasn\'t expired');
    console.error('- Verify the API endpoint is accessible');
    console.error('- Check server logs for more details');
    process.exit(1);
  }
}

main().catch(console.error);