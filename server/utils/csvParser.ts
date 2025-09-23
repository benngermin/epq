export interface StaticExplanationRow {
  uniqueId: string;  // Optional field, kept for backward compatibility
  courseName: string;  // Required: Course number like "CPCU540"
  questionSetTitle: string;  // Required: Question set title like "Question Set 1"
  questionNumber: number;  // Required: Question position in set
  loid: string;  // Optional field, kept for backward compatibility
  questionText: string;  // Optional field, kept for reference
  finalStaticExplanation: string;  // Required: The explanation to upload
}

export function parseStaticExplanationCSV(csvContent: string): StaticExplanationRow[] {
  const rows = parseCSV(csvContent);
  
  // Check for required headers
  if (rows.length === 0) {
    throw new Error("CSV is empty");
  }
  
  const headers = rows[0];
  const requiredHeaders = [
    "Course",  // Required
    "Question Set",  // Required - contains title like "Question Set 1"
    "Question Number",  // Required
    "Final Static Explanation"  // Required
  ];
  
  const optionalHeaders = [
    "Unique ID",  // Optional
    "LOID",  // Optional
    "Question Text"  // Optional
  ];
  
  // Map headers to indices
  const headerMap: Record<string, number> = {};
  
  // Check required headers
  for (const required of requiredHeaders) {
    const index = headers.findIndex(h => h.toLowerCase() === required.toLowerCase());
    if (index === -1) {
      throw new Error(`Missing required column: ${required}`);
    }
    headerMap[required] = index;
  }
  
  // Map optional headers
  for (const optional of optionalHeaders) {
    const index = headers.findIndex(h => h.toLowerCase() === optional.toLowerCase());
    if (index !== -1) {
      headerMap[optional] = index;
    }
  }
  
  // Parse data rows
  const parsedRows: StaticExplanationRow[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip empty rows
    if (row.length === 0 || row.every(cell => !cell || cell.trim() === "")) {
      continue;
    }
    
    // Extract required values
    const courseName = row[headerMap["Course"]]?.trim() || "";
    const questionSetTitle = row[headerMap["Question Set"]]?.trim() || "";
    const questionNumberStr = row[headerMap["Question Number"]]?.trim() || "";
    const finalStaticExplanation = row[headerMap["Final Static Explanation"]]?.trim() || "";
    
    // Extract optional values
    const uniqueId = headerMap["Unique ID"] !== undefined ? row[headerMap["Unique ID"]]?.trim() || "" : "";
    const loid = headerMap["LOID"] !== undefined ? row[headerMap["LOID"]]?.trim() || "" : "";
    const questionText = headerMap["Question Text"] !== undefined ? row[headerMap["Question Text"]]?.trim() || "" : "";
    
    // Validate required fields
    if (!courseName) {
      throw new Error(`Row ${i + 1}: Course is required`);
    }
    if (!questionSetTitle) {
      throw new Error(`Row ${i + 1}: Question Set is required`);
    }
    if (!questionNumberStr) {
      throw new Error(`Row ${i + 1}: Question Number is required`);
    }
    if (!finalStaticExplanation) {
      throw new Error(`Row ${i + 1}: Final Static Explanation is required`);
    }
    
    // Parse question number
    const questionNumber = parseInt(questionNumberStr, 10);
    
    if (isNaN(questionNumber) || questionNumber <= 0) {
      throw new Error(`Row ${i + 1}: Question Number must be a positive number, got: ${questionNumberStr}`);
    }
    
    // Normalize course name (remove spaces, uppercase)
    const normalizedCourse = courseName.replace(/\s+/g, '').toUpperCase();
    
    parsedRows.push({
      uniqueId,
      courseName: normalizedCourse,  // Normalized course number
      questionSetTitle,  // Keep original title casing for now
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