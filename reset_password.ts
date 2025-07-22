import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return salt + ":" + derivedKey.toString("hex");
}

async function resetPassword() {
  const password = "testadmin123";
  const hashedPassword = await hashPassword(password);
  
  await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.email, "benn@modia.ai"));
    
  console.log("Password reset for benn@modia.ai to 'testadmin123'");
  process.exit(0);
}

resetPassword().catch(console.error);
