import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Also release any expired reservations lazily when products are fetched
  // This is the "lazy cleanup" approach — no cron job needed
  await prisma.$executeRaw`
    UPDATE "Inventory" i
    SET "reservedStock" = "reservedStock" - r.qty
    FROM (
      SELECT "productId", "warehouseId", SUM(quantity) as qty
      FROM "Reservation"
      WHERE status = 'pending' AND "expiresAt" < NOW()
      GROUP BY "productId", "warehouseId"
    ) r
    WHERE i."productId" = r."productId"
      AND i."warehouseId" = r."warehouseId"
      AND i."reservedStock" >= r.qty
  `;

  await prisma.reservation.updateMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "released" },
  });

  const products = await prisma.product.findMany({
    include: {
      inventory: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}
