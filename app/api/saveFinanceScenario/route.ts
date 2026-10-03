import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    propertyId: z.number().int().positive(),
    purchasePriceMan: z.number().int().nonnegative().max(10000000),
    ownFundsMan: z.number().int().nonnegative().max(10000000),
    annualIncomeMan: z.number().int().nonnegative().max(10000000),
    otherAnnualDebtMan: z.number().int().nonnegative().max(10000000),
    loanRatePct: z.number().min(0).max(100),
    loanYears: z.number().int().min(1).max(50),
    ltvPct: z.number().min(0).max(100),
    acquisitionTaxPct: z.number().min(0).max(100),
    brokeragePct: z.number().min(0).max(100),
  }),
  async (args) => {
    const { propertyId, ...values } = args;
    const now = new Date();
    await db.insert(schema.financeScenarios).values({ propertyId, ...values, updatedAt: now }).onConflictDoUpdate({
      target: schema.financeScenarios.propertyId,
      set: { ...values, updatedAt: now },
    });
    return { ok: true };
  },
);
