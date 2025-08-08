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
  
  // Get the date string in Eastern timezone
  const easternDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/New_York"
  }); // Returns YYYY-MM-DD format
  
  // Create a date object for midnight in the local (server) timezone
  // Then we'll adjust it to represent midnight Eastern Time in UTC
  const midnightLocal = new Date(`${easternDateStr}T00:00:00`);
  
  // Format with timezone to check if DST is active
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  });
  
  const parts = formatter.formatToParts(midnightLocal);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'EST';
  
  // EDT is UTC-4, EST is UTC-5
  const isDST = tzName.includes('EDT') || tzName.includes('Eastern Daylight');
  const offsetHours = isDST ? 4 : 5;
  
  // Midnight Eastern Time in UTC is the date plus the offset hours
  // For example: Aug 8 midnight EDT = Aug 8 04:00 UTC (same calendar day, 4 hours later)
  const hourString = offsetHours.toString().padStart(2, '0');
  return new Date(`${easternDateStr}T${hourString}:00:00.000Z`);
}

// Get a date at midnight in Eastern Time for a given date (handles EST/EDT automatically)
export function getDateAtMidnightEST(date: Date): Date {
  // Get the date string in Eastern timezone
  const easternDateStr = date.toLocaleDateString("en-CA", {
    timeZone: "America/New_York"
  }); // Returns YYYY-MM-DD format
  
  // Create a date object for midnight in the local (server) timezone
  const midnightLocal = new Date(`${easternDateStr}T00:00:00`);
  
  // Format with timezone to check if DST is active
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  });
  
  const parts = formatter.formatToParts(midnightLocal);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'EST';
  
  // EDT is UTC-4, EST is UTC-5
  const isDST = tzName.includes('EDT') || tzName.includes('Eastern Daylight');
  const offsetHours = isDST ? 4 : 5;
  
  // Midnight Eastern Time in UTC is the date plus the offset hours
  // For example: Aug 8 midnight EDT = Aug 8 04:00 UTC (same calendar day, 4 hours later)
  const hourString = offsetHours.toString().padStart(2, '0');
  return new Date(`${easternDateStr}T${hourString}:00:00.000Z`);
}