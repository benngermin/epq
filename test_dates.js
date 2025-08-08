// Test the date calculation
const easternDateStr = "2025-08-08";
const offsetHours = 4; // EDT

// Old buggy way (if it was using T0${offsetHours})
const buggyDate = new Date(`${easternDateStr}T0${offsetHours}:00:00.000Z`);
console.log("Buggy date string:", `${easternDateStr}T0${offsetHours}:00:00.000Z`);
console.log("Buggy date:", buggyDate.toISOString());

// Fixed way with proper padding
const hourString = offsetHours.toString().padStart(2, '0');
const fixedDate = new Date(`${easternDateStr}T${hourString}:00:00.000Z`);
console.log("\nFixed date string:", `${easternDateStr}T${hourString}:00:00.000Z`);
console.log("Fixed date:", fixedDate.toISOString());

// Verify what this represents in Eastern Time
console.log("\nFixed date in Eastern Time:", fixedDate.toLocaleString("en-US", { timeZone: "America/New_York" }));
