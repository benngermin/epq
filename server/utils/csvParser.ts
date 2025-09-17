export interface StaticExplanationRow {
  uniqueId: string;
  courseName: string;
  questionSetNumber: number;
  questionNumber: number;
  loid: string;
  questionText: string;
  finalStaticExplanation: string;
}

export function parseStaticExplanationCSV(csvContent: string): StaticExplanationRow[] {
  const rows = parseCSV(csvContent);
  
  // Check for required headers
  if (rows.length === 0) {
    throw new Error("CSV is empty");
  }
  
  const headers = rows[0];
  const requiredHeaders = [
    "Unique ID",
    "Course", 
    "Question Set",
    "Question Number",
    "LOID",
    "Question Text",
    "Final Static Explanation"
  ];
  
  // Map headers to indices
  const headerMap: Record<string, number> = {};
  for (const required of requiredHeaders) {
    const index = headers.findIndex(h => h.toLowerCase() === required.toLowerCase());
    if (index === -1) {
      throw new Error(`Missing required column: ${required}`);
    }
    headerMap[required] = index;
  }
  
  // Parse data rows
  const parsedRows: StaticExplanationRow[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip empty rows
    if (row.length === 0 || row.every(cell => !cell || cell.trim() === "")) {
      continue;
    }
    
    // Extract values
    const uniqueId = row[headerMap["Unique ID"]]?.trim() || "";
    const courseName = row[headerMap["Course"]]?.trim() || "";
    const questionSetStr = row[headerMap["Question Set"]]?.trim() || "";
    const questionNumberStr = row[headerMap["Question Number"]]?.trim() || "";
    const loid = row[headerMap["LOID"]]?.trim() || "";
    const questionText = row[headerMap["Question Text"]]?.trim() || "";
    const finalStaticExplanation = row[headerMap["Final Static Explanation"]]?.trim() || "";
    
    // Validate required fields
    if (!courseName) {
      throw new Error(`Row ${i + 1}: Course name is required`);
    }
    if (!questionSetStr) {
      throw new Error(`Row ${i + 1}: Question Set is required`);
    }
    if (!questionNumberStr) {
      throw new Error(`Row ${i + 1}: Question Number is required`);
    }
    if (!loid) {
      throw new Error(`Row ${i + 1}: LOID is required`);
    }
    if (!finalStaticExplanation) {
      throw new Error(`Row ${i + 1}: Final Static Explanation is required`);
    }
    
    // Parse numbers
    const questionSetNumber = parseInt(questionSetStr, 10);
    const questionNumber = parseInt(questionNumberStr, 10);
    
    if (isNaN(questionSetNumber)) {
      throw new Error(`Row ${i + 1}: Question Set must be a number, got: ${questionSetStr}`);
    }
    if (isNaN(questionNumber)) {
      throw new Error(`Row ${i + 1}: Question Number must be a number, got: ${questionNumberStr}`);
    }
    
    parsedRows.push({
      uniqueId,
      courseName,
      questionSetNumber,
      questionNumber,
      loid,
      questionText,
      finalStaticExplanation
    });
  }
  
  return parsedRows;
}

// Helper function to parse CSV handling quoted values with commas
function parseCSV(csvContent: string): string[][] {
  const rows: string[][] = [];
  const lines = csvContent.split(/\r?\n/);
  
  for (const line of lines) {
    if (line.trim() === "") continue;
    
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next character
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        row.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    
    // Add last field
    row.push(current);
    rows.push(row);
  }
  
  return rows;
}