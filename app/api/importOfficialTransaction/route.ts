import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { OFFICIAL_SOURCE_URL, geocodeExactAddress } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const [transaction] = await db.select().from(schema.officialTransactions).where(eq(schema.officialTransactions.id, args.id)).limit(1);
    if (!transaction) return { ok: false, id: null, message: "선택한 실거래 내역을 찾을 수 없습니다." };
    const [alreadyImported] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.sourceRecordId, transaction.fingerprint)).limit(1);
    if (alreadyImported) return { ok: true, id: alreadyImported.id, message: null };
    let latitude = transaction.latitude;
    let longitude = transaction.longitude;
    let resolvedAddress = transaction.roadAddress ?? [transaction.regionLabel, transaction.legalDong, transaction.jibun].filter(Boolean).join(" ");
    if (latitude === null || longitude === null) {
      const found = await geocodeExactAddress(resolvedAddress);
      if (!found) return { ok: false, id: null, message: "이 거래의 위치를 확인하지 못했습니다. 주소를 직접 등록해 주세요." };
      latitude = found.latitude;
      longitude = found.longitude;
      resolvedAddress = found.label;
      await db.update(schema.officialTransactions).set({ latitude, longitude }).where(eq(schema.officialTransactions.id, transaction.id));
    }
    const now = new Date();
    const result = await db.insert(schema.properties).values({
      name: transaction.apartmentName,
      address: transaction.roadAddress ?? `${transaction.regionLabel} ${transaction.legalDong} ${transaction.jibun ?? ""}`.trim(),
      resolvedAddress,
      latitude,
      longitude,
      areaSqm: transaction.areaSqm,
      askingPriceMan: transaction.dealAmountMan,
      depositMan: null,
      monthlyRentMan: null,
      purpose: "both",
      visitDate: null,
      memo: `${transaction.dealYmd} 신고 실거래 · ${transaction.floor === null ? "층 정보 없음" : `${transaction.floor}층`}`,
      priceBasis: "official_trade",
      sourceReference: OFFICIAL_SOURCE_URL,
      sourceRecordId: transaction.fingerprint,
      geocodeSource: "국토교통부 실거래가 + OpenStreetMap Nominatim",
      createdAt: now,
      updatedAt: now,
    }).returning({ id: schema.properties.id });
    const inserted = result[0];
    if (!inserted) return { ok: false, id: null, message: "임장자료로 저장하지 못했습니다." };
    return { ok: true, id: inserted.id, message: null };
  },
);
