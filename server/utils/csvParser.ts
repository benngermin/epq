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

// Helper function to parse CSV handling quoted values with commas and newlines
function parseCSV(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  
  // Process character by character to handle multi-line fields
  while (i < csvContent.length) {
    const char = csvContent[i];
    const nextChar = i + 1 < csvContent.length ? csvContent[i + 1] : null;
    
    if (char === '"') {
      if (inQuotes) {
        if (nextChar === '"') {
          // Escaped quote within quoted field
          currentField += '"';
          i += 2; // Skip both quotes
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        // Start of quoted field - only at beginning of field
        if (currentField === "") {
          inQuotes = true;
          i++;
        } else {
          // Quote in middle of unquoted field - treat as literal
          currentField += char;
          i++;
        }
      }
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      // End of row (not within quotes)
      if (currentField !== "" || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.length > 0 && !currentRow.every(cell => cell === "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      }
      // Skip \r\n combination
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = "";
      i++;
    } else {
      // Regular character
      currentField += char;
      i++;
    }
  }
  
  // Add last field and row if there's content
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 0 && !currentRow.every(cell => cell === "")) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}