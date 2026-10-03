import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 원본 CHECKLIST_ITEMS를 그대로 포팅
const CHECKLIST_ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["entrance", "단지 진입 동선"], ["noise", "도로·생활 소음"], ["slope", "경사와 보행 환경"],
  ["parking", "주차 여유"], ["hall", "현관·복도 관리"], ["elevator", "엘리베이터 상태"],
  ["sunlight", "채광·향"], ["ventilation", "환기·냄새"], ["water", "수압·누수 흔적"], ["layout", "동선·수납"],
  ["transit", "대중교통 접근"], ["groceries", "장보기·생활상권"], ["school", "학교·돌봄 동선"],
];

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive() }),
  async (args) => {
    const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
    if (!property) return { ok: false, count: 0, message: "선정 매물을 찾을 수 없습니다." };
    const checklistRows = await db.select().from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, args.propertyId));
    const checklist = new Map(checklistRows.map((row) => [row.itemKey, row]));
    const existingTasks = await db.select().from(schema.revisitTasks).where(eq(schema.revisitTasks.propertyId, args.propertyId));
    for (const task of existingTasks) {
      if (task.reason !== "custom") await db.delete(schema.revisitTasks).where(eq(schema.revisitTasks.id, task.id));
    }
    const now = new Date();
    const generated: Array<typeof schema.revisitTasks.$inferInsert> = [];
    for (const [itemKey, label] of CHECKLIST_ITEMS) {
      const entry = checklist.get(itemKey);
      if (!entry?.checked) generated.push({ propertyId: args.propertyId, itemKey, label, reason: "unchecked", completed: false, note: entry?.note ?? "", createdAt: now, updatedAt: now });
      else if (!entry.note.trim()) generated.push({ propertyId: args.propertyId, itemKey, label, reason: "missing_note", completed: false, note: "", createdAt: now, updatedAt: now });
    }
    if (generated.length > 0) await db.insert(schema.revisitTasks).values(generated);
    return { ok: true, count: generated.length, message: generated.length === 0 ? "미완료 항목이나 비어 있는 현장 메모가 없습니다." : null };
  },
);
