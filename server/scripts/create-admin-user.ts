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

async function createAdminUser() {
  const email = process.env.ADMIN_EMAIL || "benn@modia.ai";
  const password = process.env.ADMIN_PASSWORD;
  const firstName = "Benn";
  const lastName = "Admin";

  if (!password) {
    console.error('❌ Missing required environment variable: ADMIN_PASSWORD');
    console.log('💡 Set ADMIN_PASSWORD environment variable with a secure password');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`User ${email} already exists. Updating to admin...`);
      
      // Update existing user to be admin with new password
      const hashedPassword = await hashPassword(password);
      await db
        .update(users)
        .set({ 
          isAdmin: true,
          password: hashedPassword
        })
        .where(eq(users.email, email));
      
      console.log(`✅ User ${email} updated to admin with new password`);
    } else {
      // Create new admin user
      const hashedPassword = await hashPassword(password);
      
      await db.insert(users).values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        isAdmin: true,
      });
      
      console.log(`✅ Admin user created successfully:`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: [HIDDEN]`);
      console.log(`   Admin: true`);
    }
    
    console.log(`\n📝 You can now login at /auth with your credentials in development mode`);
    console.log(`🔐 Use the password you set via ADMIN_PASSWORD environment variable`);
    
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

createAdminUser();