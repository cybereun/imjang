import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { asc, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const revisitTaskSchema = z.object({
  id: z.number(),
  itemKey: z.string(),
  label: z.string(),
  reason: z.enum(["unchecked", "missing_note", "custom"]),
  completed: z.boolean(),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const priceTrackerSchema = z.object({
  active: z.boolean(),
  targetPriceMan: z.number().nullable(),
  updatedAt: z.string(),
});

const priceSnapshotSchema = z.object({
  id: z.number(),
  amountMan: z.number(),
  kind: z.enum(["asking", "official_trade"]),
  note: z.string(),
  sourceUrl: z.string().nullable(),
  recordedAt: z.string(),
});

const financeScenarioSchema = z.object({
  purchasePriceMan: z.number(),
  ownFundsMan: z.number(),
  annualIncomeMan: z.number(),
  otherAnnualDebtMan: z.number(),
  loanRatePct: z.number(),
  loanYears: z.number(),
  ltvPct: z.number(),
  acquisitionTaxPct: z.number(),
  brokeragePct: z.number(),
  updatedAt: z.string(),
});

const listingTradeTypeSchema = z.enum(["sale", "jeonse", "wolse"]);
const listingStatusSchema = z.enum(["active", "hold", "done", "closed"]);

const listingSchema = z.object({
  id: z.number(),
  propertyId: z.number(),
  brokerName: z.string(),
  brokerContact: z.string(),
  dong: z.string(),
  ho: z.string(),
  areaSqm: z.number().nullable(),
  tradeType: listingTradeTypeSchema,
  priceMan: z.number(),
  monthlyRentMan: z.number().nullable(),
  targetPriceMan: z.number().nullable(),
  listingUrl: z.string().nullable(),
  status: listingStatusSchema,
  memo: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const listingSummarySchema = listingSchema.extend({
  firstPriceMan: z.number().nullable(),
  priceChangeMan: z.number().nullable(),
  logCount: z.number(),
});

// 원본 serializeListing을 그대로 포팅
function serializeListing(row: typeof schema.listings.$inferSelect): z.infer<typeof listingSchema> {
  return {
    id: row.id,
    propertyId: row.propertyId,
    brokerName: row.brokerName,
    brokerContact: row.brokerContact,
    dong: row.dong,
    ho: row.ho,
    areaSqm: row.areaSqm,
    tradeType: row.tradeType as "sale" | "wolse" | "jeonse",
    priceMan: row.priceMan,
    monthlyRentMan: row.monthlyRentMan,
    targetPriceMan: row.targetPriceMan,
    listingUrl: row.listingUrl,
    status: row.status as "active" | "closed" | "hold" | "done",
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive() }),
  async (args) => {
    const [taskRows, trackerRows, snapshotRows, financeRows, listingRows] = await Promise.all([
      db.select().from(schema.revisitTasks).where(eq(schema.revisitTasks.propertyId, args.propertyId)).orderBy(asc(schema.revisitTasks.completed), asc(schema.revisitTasks.createdAt)),
      db.select().from(schema.priceTrackers).where(eq(schema.priceTrackers.propertyId, args.propertyId)).limit(1),
      db.select().from(schema.priceSnapshots).where(eq(schema.priceSnapshots.propertyId, args.propertyId)).orderBy(desc(schema.priceSnapshots.recordedAt)),
      db.select().from(schema.financeScenarios).where(eq(schema.financeScenarios.propertyId, args.propertyId)).limit(1),
      db.select().from(schema.listings).where(eq(schema.listings.propertyId, args.propertyId)).orderBy(desc(schema.listings.updatedAt)),
    ]);
    const tracker = trackerRows[0];
    const finance = financeRows[0];
    const listingSummaries = await Promise.all(
      listingRows.map(async (row) => {
        const firstLogs = await db
          .select({ priceMan: schema.listingPriceLogs.priceMan })
          .from(schema.listingPriceLogs)
          .where(eq(schema.listingPriceLogs.listingId, row.id))
          .orderBy(asc(schema.listingPriceLogs.recordedAt), asc(schema.listingPriceLogs.id));
        const first = firstLogs[0]?.priceMan ?? null;
        return {
          ...serializeListing(row),
          firstPriceMan: first,
          priceChangeMan: first === null ? null : row.priceMan - first,
          logCount: firstLogs.length,
        };
      }),
    );
    return {
      revisitTasks: taskRows.map((row) => ({ id: row.id, itemKey: row.itemKey, label: row.label, reason: row.reason, completed: row.completed, note: row.note, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })),
      priceTracker: tracker ? { active: tracker.active, targetPriceMan: tracker.targetPriceMan, updatedAt: tracker.updatedAt.toISOString() } : null,
      priceSnapshots: snapshotRows.map((row) => ({ id: row.id, amountMan: row.amountMan, kind: row.kind, note: row.note, sourceUrl: row.sourceUrl, recordedAt: row.recordedAt.toISOString() })),
      financeScenario: finance ? { purchasePriceMan: finance.purchasePriceMan, ownFundsMan: finance.ownFundsMan, annualIncomeMan: finance.annualIncomeMan, otherAnnualDebtMan: finance.otherAnnualDebtMan, loanRatePct: finance.loanRatePct, loanYears: finance.loanYears, ltvPct: finance.ltvPct, acquisitionTaxPct: finance.acquisitionTaxPct, brokeragePct: finance.brokeragePct, updatedAt: finance.updatedAt.toISOString() } : null,
      listingSummaries,
    };
  },
);
