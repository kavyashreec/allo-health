import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "confirmed") {
    return NextResponse.json(reservation);
  }
  if (reservation.status === "released") {
    return NextResponse.json({ error: "Reservation has already been released" }, { status: 410 });
  }

  if (reservation.expiresAt < new Date()) {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "Inventory"
        SET "reservedStock" = GREATEST(0, "reservedStock" - ${reservation.quantity})
        WHERE "productId" = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
      `,
      prisma.reservation.update({
        where: { id },
        data: { status: "released" },
      }),
    ]);
    return NextResponse.json({ error: "Reservation has expired" }, { status: 410 });
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET
        "totalStock"    = GREATEST(0, "totalStock" - ${reservation.quantity}),
        "reservedStock" = GREATEST(0, "reservedStock" - ${reservation.quantity})
      WHERE "productId"   = ${reservation.productId}
        AND "warehouseId" = ${reservation.warehouseId}
    `;
    return tx.reservation.update({
      where: { id },
      data: { status: "confirmed" },
      include: { product: true, warehouse: true },
    });
  });

  return NextResponse.json(updated);
}