"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Warehouse = { id: string; name: string; location: string };
type InventoryItem = {
  id: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
  warehouse: Warehouse;
};
type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  inventory: InventoryItem[];
};

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null); // "productId-warehouseId"
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  async function reserve(productId: string, warehouseId: string) {
    const key = `${productId}-${warehouseId}`;
    setReserving(key);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError("❌ Not enough stock — someone else just grabbed the last one.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      // Go to checkout with the new reservation
      router.push(`/checkout/${data.id}`);
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 text-sm">Loading products...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Products</h1>
        <p className="text-zinc-400 text-sm">Reserve an item to hold it for 10 minutes while you checkout.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4"
          >
            <div>
              <h2 className="font-semibold text-white text-base mb-1">{product.name}</h2>
              <p className="text-zinc-400 text-xs leading-relaxed">{product.description}</p>
            </div>

            <div className="text-xl font-bold text-white">
              ₹{product.price.toLocaleString("en-IN")}
            </div>

            <div className="border-t border-zinc-800 pt-3 space-y-3">
              {product.inventory.map((inv) => {
                const available = inv.totalStock - inv.reservedStock;
                const key = `${product.id}-${inv.warehouseId}`;
                const isReserving = reserving === key;

                return (
                  <div key={inv.warehouseId} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-zinc-300">{inv.warehouse.name}</div>
                      <div className={`text-xs mt-0.5 ${available === 0 ? "text-red-400" : available <= 2 ? "text-amber-400" : "text-emerald-400"}`}>
                        {available === 0 ? "Out of stock" : `${available} available`}
                      </div>
                    </div>
                    <button
                      onClick={() => reserve(product.id, inv.warehouseId)}
                      disabled={available === 0 || isReserving || reserving !== null}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                        bg-white text-zinc-900 hover:bg-zinc-200
                        disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
                    >
                      {isReserving ? "Reserving..." : "Reserve"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
