import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const warehouse = await prisma.warehouse.create({
    data: { name: "Allo Fulfillment Center", location: "Bangalore, India" },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Allo Smart Scale",
        description: "Tracks weight, BMI, body fat, and muscle mass. Syncs to the Allo app.",
        price: 3499,
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Blood Pressure Monitor",
        description: "Clinically validated BP monitor with irregular heartbeat detection.",
        price: 2999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Pulse Oximeter",
        description: "Measures SpO2 and pulse rate in under 10 seconds.",
        price: 1299,
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Continuous Glucose Monitor",
        description: "14-day wear CGM with real-time glucose alerts and trend graphs.",
        price: 4999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Sleep Tracker",
        description: "Non-wearable under-mattress sensor that tracks sleep stages and HRV.",
        price: 5999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Allo Health Kit",
        description: "Starter bundle: scale + BP monitor + pulse oximeter. Save ₹1,200.",
        price: 6599,
      },
    }),
  ]);

  const stockLevels = [5, 3, 8, 2, 4, 1];

  for (let i = 0; i < products.length; i++) {
    await prisma.inventory.create({
      data: {
        productId: products[i].id,
        warehouseId: warehouse.id,
        totalStock: stockLevels[i],
        reservedStock: 0,
      },
    });
  }

  console.log("✅ Seeded Allo Health products");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());