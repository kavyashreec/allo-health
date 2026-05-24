import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { productId, warehouseId, quantity = 1 } = body;

  if (!productId || !warehouseId) {
    return NextResponse.json(
      { error: "productId and warehouseId are required" },
      { status: 400 }
    );
  }

  try {
    // ---------------------------------------------------------------
    // CONCURRENCY SAFETY via SELECT ... FOR UPDATE
    //
    // We use a raw SQL transaction with row-level locking.
    // When two requests hit this endpoint simultaneously, Postgres will
    // let only ONE of them lock the inventory row at a time. The second
    // request blocks until the first commits, then reads the updated
    // reservedStock and correctly sees there's no stock left.
    //
    // This is the simplest correct solution — no Redis, no queues.
    // ---------------------------------------------------------------
    const reservation = await prisma.$transaction(async (tx: any) => {
      // Lock the inventory row for this product+warehouse combo
      const rows = await tx.$queryRaw<
        { id: string; totalStock: number; reservedStock: number }[]
      >`
        SELECT id, "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new Error("NOT_FOUND");
      }

      const inv = rows[0];
      const available = inv.totalStock - inv.reservedStock;

      if (available < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Increment reservedStock
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET "reservedStock" = "reservedStock" + ${quantity}
        WHERE id = ${inv.id}
      `;

      // Create the reservation — expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const newReservation = await tx.reservation.create({
        data: { productId, warehouseId, quantity, expiresAt, status: "pending" },
        include: { product: true, warehouse: true },
      });

      return newReservation;
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Not enough stock available" },
        { status: 409 }
      );
    }
    if (message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Product not found in that warehouse" },
        { status: 404 }
      );
    }

    console.error("Reservation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
