const { chromium } = require('playwright');

(async () => {
  console.log('Starting admin upload page test...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:5000/auth');
    await page.waitForTimeout(2000);
    
    // Check if already logged in or need to login
    const currentUrl = page.url();
    if (currentUrl.includes('/auth')) {
      console.log('2. Logging in as admin...');
      
      // Try to login
      await page.fill('[data-testid="input-email"]', 'benn@modia.ai');
      await page.fill('[data-testid="input-password"]', 'Password123');
      await page.click('[data-testid="button-login"]');
      
      // Wait for navigation or dashboard
      await page.waitForTimeout(3000);
    }
    
    // Navigate to admin upload page
    console.log('3. Navigating to admin upload page...');
    await page.goto('http://localhost:5000/admin/upload-explanations');
    await page.waitForTimeout(3000);
    
    // Take screenshot of initial state
    console.log('4. Taking screenshot of initial upload page...');
    await page.screenshot({ 
      path: 'admin-upload-initial.png',
      fullPage: true 
    });
    console.log('   ✓ Screenshot saved: admin-upload-initial.png');
    
    // Check if we have access to the page
    const pageTitle = await page.textContent('h1, h2, .text-2xl');
    console.log('   Page title:', pageTitle);
    
    // Check for the upload dropzone
    const dropzone = await page.locator('[data-testid="csv-dropzone"]').count();
    if (dropzone > 0) {
      console.log('   ✓ Upload dropzone found');
      
      // Upload the CSV file
      console.log('5. Uploading CSV file...');
      const fileInput = await page.locator('input[type="file"]').elementHandle();
      await fileInput.setInputFiles('attached_assets/Static Answers-1_1758150480787.csv');
      
      // Wait for preview to load
      console.log('   Waiting for preview...');
      await page.waitForTimeout(5000);
      
      // Take screenshot of preview
      console.log('6. Taking screenshot of preview...');
      await page.screenshot({ 
        path: 'admin-upload-preview.png',
        fullPage: true 
      });
      console.log('   ✓ Screenshot saved: admin-upload-preview.png');
      
      // Check for preview table
      const tableRows = await page.locator('table tbody tr').count();
      if (tableRows > 0) {
        console.log(`   ✓ Preview table loaded with ${tableRows} rows`);
        
        // Check statistics
        const stats = await page.locator('text=/matched|total|unmatched/i').allTextContents();
        if (stats.length > 0) {
          console.log('   ✓ Statistics displayed:', stats.join(' | '));
        }
        
        // Check for selection controls
        const checkboxes = await page.locator('input[type="checkbox"]').count();
        if (checkboxes > 0) {
          console.log(`   ✓ ${checkboxes} selection checkboxes found`);
        }
        
        // Try selecting/deselecting rows
        console.log('7. Testing row selection...');
        const firstCheckbox = await page.locator('input[type="checkbox"]').first();
        if (await firstCheckbox.isChecked()) {
          await firstCheckbox.uncheck();
          console.log('   ✓ Unchecked first row');
        } else {
          await firstCheckbox.check();
          console.log('   ✓ Checked first row');
        }
        
        await page.waitForTimeout(1000);
        
        // Take final screenshot
        console.log('8. Taking final screenshot...');
        await page.screenshot({ 
          path: 'admin-upload-final.png',
          fullPage: true 
        });
        console.log('   ✓ Screenshot saved: admin-upload-final.png');
        
        // Check for upload button
        const uploadButton = await page.locator('button:has-text("Upload")').count();
        if (uploadButton > 0) {
          console.log('   ✓ Upload button found (not clicking to avoid actual upload)');
        }
        
        console.log('\n✅ Admin upload page test completed successfully!');
      } else {
        console.log('   ⚠️ No preview table found');
      }
    } else {
      console.log('   ⚠️ Upload dropzone not found - checking if redirected...');
      const currentUrl = page.url();
      console.log('   Current URL:', currentUrl);
      
      if (!currentUrl.includes('admin')) {
        console.log('   ❌ No admin access - redirected away from admin page');
      }
    }
    
  } catch (error) {
    console.error('Error during test:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'admin-upload-error.png',
      fullPage: true 
    });
    console.log('Error screenshot saved: admin-upload-error.png');
  } finally {
    await browser.close();
    console.log('\nTest completed.');
  }
})();