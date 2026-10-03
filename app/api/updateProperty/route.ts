import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const purposeSchema = z.enum(["both", "invest", "reside"]);

export const POST = defineRoute(
  z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1).max(80),
    areaSqm: z.number().positive().max(10000),
    askingPriceMan: z.number().int().nonnegative().max(10000000),
    depositMan: z.number().int().nonnegative().max(10000000).nullable(),
    monthlyRentMan: z.number().int().nonnegative().max(1000000).nullable(),
    purpose: purposeSchema,
    visitDate: z.string().nullable(),
    memo: z.string().max(2000),
  }),
  async (args) => {
    const { id, ...values } = args;
    const [existing] = await db.select({ areaSqm: schema.properties.areaSqm, askingPriceMan: schema.properties.askingPriceMan, priceBasis: schema.properties.priceBasis }).from(schema.properties).where(eq(schema.properties.id, id)).limit(1);
    const priceWasOverridden = existing?.priceBasis === "official_trade" && (existing.areaSqm !== values.areaSqm || existing.askingPriceMan !== values.askingPriceMan);
    await db.update(schema.properties).set({ ...values, ...(priceWasOverridden ? { priceBasis: "asking" as const, sourceReference: null } : {}), updatedAt: new Date() }).where(eq(schema.properties.id, id));
    return { ok: true };
  },
);
