import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importCourseMaterials() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Reading course materials CSV...');
    const csvContent = readFileSync('./attached_assets/exported-course-content_1750453037112.csv', 'utf8');
    
    // Parse CSV - simple parsing since we know the format
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    
    console.log('Headers found:', headers);
    
    // Clear existing course materials
    console.log('Clearing existing course materials...');
    await client.query('DELETE FROM course_materials');
    
    console.log(`Processing ${lines.length - 1} rows...`);
    let importedCount = 0;
    
    // Process in smaller batches to avoid timeouts
    const batchSize = 50;
    for (let batchStart = 1; batchStart < lines.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, lines.length);
      console.log(`Processing batch ${Math.floor(batchStart/batchSize) + 1}...`);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV line (handling quoted values with commas)
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue); // Add the last value
        
        if (values.length >= 4) {
          const [assignment, course, loid, content] = values;
          
          try {
            await client.query(
              'INSERT INTO course_materials (assignment, course, loid, content) VALUES ($1, $2, $3, $4)',
              [assignment, course, loid, content]
            );
            importedCount++;
          } catch (error) {
            console.error(`Error importing row ${i}:`, error.message);
          }
        }
      }
      
      // Commit this batch
      await client.query('COMMIT');
      await client.query('BEGIN');
      console.log(`Imported ${importedCount} course materials so far...`);
    }
    
    await client.query('COMMIT');
    console.log(`Successfully imported ${importedCount} course materials!`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing course materials:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importCourseMaterials().catch(console.error);