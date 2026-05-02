import { db } from "../index.js";
import { creditsTable, creditTransactionsTable } from "../schema/credits";
import { eq, sql } from "drizzle-orm";

export async function initializeUserCredits(userId: string): Promise<void> {
  await db.insert(creditsTable).values({ userId, balance: "10.00" }).onConflictDoNothing(); // Default starting balance
}

export async function getUserCredits(userId: string): Promise<number> {
  const result = await db.select({ balance: creditsTable.balance }).from(creditsTable).where(eq(creditsTable.userId, userId));
  if (result.length > 0) {
    return parseFloat(result[0].balance);
  }
  return 0;
}

export async function deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
  if (amount <= 0) {
    throw new Error("Amount to deduct must be positive.");
  }

  return await db.transaction(async (tx) => {
    const currentCredits = await getUserCredits(userId);
    if (currentCredits < amount) {
      return false; // Insufficient credits
    }

    await tx.update(creditsTable)
      .set({ balance: sql`${creditsTable.balance} - ${amount}`, updatedAt: new Date() })
      .where(eq(creditsTable.userId, userId));

    await tx.insert(creditTransactionsTable).values({
      userId,
      type: "usage",
      amount: -amount, // Negative for deduction
      description,
    });
    return true;
  });
}

export async function addCredits(userId: string, amount: number, type: string, description: string): Promise<void> {
  if (amount <= 0) {
    throw new Error("Amount to add must be positive.");
  }

  await db.transaction(async (tx) => {
    await tx.update(creditsTable)
      .set({ balance: sql`${creditsTable.balance} + ${amount}`, updatedAt: new Date() })
      .where(eq(creditsTable.userId, userId));

    await tx.insert(creditTransactionsTable).values({
      userId,
      type,
      amount,
      description,
    });
  });
}
