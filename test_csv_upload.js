const fs = require('fs');

// Read the CSV file and simulate the upload
const csvContent = fs.readFileSync('attached_assets/exported-course-content_1750453037112.csv', 'utf8');
const lines = csvContent.split('\n');
const materials = [];

for (let i = 1; i < lines.length && i < 10; i++) { // Test with first 10 entries
  const line = lines[i].trim();
  if (!line) continue;
  
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
  values.push(currentValue);
  
  if (values.length >= 4) {
    const [assignment, course, loid, content] = values;
    materials.push({ 
      assignment: assignment.replace(/"/g, ''), 
      course: course.replace(/"/g, ''), 
      loid: loid.replace(/"/g, ''), 
      content: content.replace(/"/g, '') 
    });
  }
}

console.log(`Parsed ${materials.length} materials`);
console.log('First material:', JSON.stringify(materials[0], null, 2));