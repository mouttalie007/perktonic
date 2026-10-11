// One-time diagnostic: usage `npx tsx prisma/check-login.ts <email> <password>`
// Reports exactly why a login would succeed or fail, without exposing the
// password hash. Safe to delete after use.
import { prisma } from "../src/lib/prisma";
import { verifyPassword } from "../src/lib/auth";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log("Usage: npx tsx prisma/check-login.ts <email> <password>");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    console.log(`NO USER found for email: "${normalizedEmail}"`);
    const all = await prisma.user.findMany({ select: { email: true, isActive: true, role: true } });
    console.log("Users that DO exist in the database:", all);
    return;
  }

  console.log("User found:", {
    email: user.email,
    isActive: user.isActive,
    role: user.role,
    id: user.id,
  });

  const matches = await verifyPassword(password, user.passwordHash);
  console.log("Password matches:", matches);

  const sessionCount = await prisma.session.count({ where: { userId: user.id } });
  console.log("Existing sessions for this user:", sessionCount);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
