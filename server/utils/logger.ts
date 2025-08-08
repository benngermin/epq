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

// Get today's date at midnight in EST
export function getTodayEST(): Date {
  // Get current time in EST
  const estString = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  // Parse the EST date string (MM/DD/YYYY format)
  const [month, day, year] = estString.split('/');
  
  // Create a new date at midnight EST
  // Note: JavaScript Date constructor uses local time, but we want UTC that represents EST midnight
  const estMidnight = new Date(`${year}-${month}-${day}T00:00:00-05:00`);
  
  return estMidnight;
}

// Get a date at midnight in EST for a given date
export function getDateAtMidnightEST(date: Date): Date {
  // Convert the date to EST string
  const estString = date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  // Parse the EST date string (MM/DD/YYYY format)
  const [month, day, year] = estString.split('/');
  
  // Create a new date at midnight EST
  const estMidnight = new Date(`${year}-${month}-${day}T00:00:00-05:00`);
  
  return estMidnight;
}