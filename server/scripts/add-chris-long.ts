import { db } from "../db";
import { users } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

async function addChrisLong() {
  const email = "long@theinstitutes.org";
  const name = "Chris Long";
  const password = process.env.USER_PASSWORD || "ChangeMe123!"; // Default password
  const isAdmin = false; // Set to regular user by default

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`✅ User ${email} already exists.`);
      console.log(`   Name: ${existingUser[0].name}`);
      console.log(`   Admin: ${existingUser[0].isAdmin}`);
    } else {
      // Create new user
      const hashedPassword = await hashPassword(password);
      
      await db.insert(users).values({
        email,
        password: hashedPassword,
        name,
        isAdmin,
      });
      
      console.log(`✅ User created successfully:`);
      console.log(`   Email: ${email}`);
      console.log(`   Name: ${name}`);
      console.log(`   Password: [HIDDEN]`);
      console.log(`   Admin: ${isAdmin}`);
    }
    
    console.log(`\n📝 Chris Long can now login at /auth with his credentials in development mode`);
    console.log(`🔐 Use the password set via USER_PASSWORD environment variable (or default)`);
    
  } catch (error) {
    console.error("❌ Error adding Chris Long:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

addChrisLong();