export function logWithEST(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/New_York", // EST/EDT
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function getESTTimestamp(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDateEST(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// Get today's date at midnight in Eastern Time (handles EST/EDT automatically)
export function getTodayEST(): Date {
  // Get the current date/time
  const now = new Date();
  
  // Format the current date in Eastern timezone to get year, month, day
  const easternDateParts = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).split('/');
  
  // Rearrange from MM/DD/YYYY to YYYY-MM-DD format
  const [month, day, year] = easternDateParts;
  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  // Create a date object for midnight in Eastern time
  // We create it as a UTC date and then use Intl.DateTimeFormat to get the correct UTC time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  
  // Create a date for midnight Eastern by parsing the formatted string
  const midnightEastern = new Date(`${dateStr}T00:00:00`);
  const parts = formatter.formatToParts(midnightEastern);
  
  // Extract the timezone offset from the formatted parts
  const timezoneName = parts.find(p => p.type === 'timeZoneName')?.value || 'EST';
  const isDST = timezoneName.includes('EDT');
  const offsetHours = isDST ? -4 : -5;
  
  // Create the final date with the correct offset
  const offsetMinutes = offsetHours * 60;
  const utcTime = new Date(`${dateStr}T00:00:00`).getTime() - (offsetMinutes * 60 * 1000);
  
  return new Date(utcTime);
}

// Get a date at midnight in Eastern Time for a given date (handles EST/EDT automatically)
export function getDateAtMidnightEST(date: Date): Date {
  // Format the given date in Eastern timezone to get year, month, day
  const easternDateParts = date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).split('/');
  
  // Rearrange from MM/DD/YYYY to YYYY-MM-DD format
  const [month, day, year] = easternDateParts;
  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  // Create a date object for midnight in Eastern time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  
  // Create a date for midnight Eastern by parsing the formatted string
  const midnightEastern = new Date(`${dateStr}T00:00:00`);
  const parts = formatter.formatToParts(midnightEastern);
  
  // Extract the timezone offset from the formatted parts
  const timezoneName = parts.find(p => p.type === 'timeZoneName')?.value || 'EST';
  const isDST = timezoneName.includes('EDT');
  const offsetHours = isDST ? -4 : -5;
  
  // Create the final date with the correct offset
  const offsetMinutes = offsetHours * 60;
  const utcTime = new Date(`${dateStr}T00:00:00`).getTime() - (offsetMinutes * 60 * 1000);
  
  return new Date(utcTime);
}