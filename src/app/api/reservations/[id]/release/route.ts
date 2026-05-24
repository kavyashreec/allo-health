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

  if (reservation.status !== "pending") {
    return NextResponse.json(reservation);
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = GREATEST(0, "reservedStock" - ${reservation.quantity})
      WHERE "productId"   = ${reservation.productId}
        AND "warehouseId" = ${reservation.warehouseId}
    `;
    return tx.reservation.update({
      where: { id },
      data: { status: "released" },
      include: { product: true, warehouse: true },
    });
  });

  return NextResponse.json(updated);
}