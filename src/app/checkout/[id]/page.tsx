"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Reservation = {
  id: string;
  status: string;
  quantity: number;
  expiresAt: string;
  product: { name: string; price: number; description: string };
  warehouse: { name: string; location: string };
};

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    fetch(`/api/reservations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setReservation(data);
        const msLeft = new Date(data.expiresAt).getTime() - Date.now();
        setSecondsLeft(Math.max(0, Math.floor(msLeft / 1000)));
      })
      .catch(() => setError("Could not load reservation"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!reservation || reservation.status !== "pending" || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setReservation((r) => r ? { ...r, status: "released" } : r);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation?.status, secondsLeft]);

  const confirm = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/reservations/${id}/confirm`, { method: "POST" });
    const data = await res.json();
    if (res.status === 410) {
      setError("⏰ Your reservation expired before we could confirm it.");
      setReservation((r) => r ? { ...r, status: "released" } : r);
    } else if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setReservation(data);
    }
    setActionLoading(false);
  }, [id]);

  const cancel = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/reservations/${id}/release`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setReservation(data);
    }
    setActionLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!reservation || !reservation.product) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-zinc-400">Reservation not found.</div>
        <button onClick={() => router.push("/")} className="mt-4 text-sm text-zinc-500 underline">
          Back to products
        </button>
      </div>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isExpired = reservation.status === "released" || secondsLeft <= 0;
  const isConfirmed = reservation.status === "confirmed";
  const isPending = reservation.status === "pending" && !isExpired;

  return (
    <div className="max-w-md mx-auto">
      <button
        onClick={() => router.push("/")}
        className="text-zinc-500 text-sm mb-6 hover:text-zinc-300 transition-colors"
      >
        ← Back to products
      </button>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

        {isConfirmed && (
          <div className="bg-emerald-900 border-b border-emerald-700 px-5 py-3 text-emerald-300 text-sm font-medium">
            ✅ Order confirmed! Your item is on its way.
          </div>
        )}
        {isExpired && !isConfirmed && (
          <div className="bg-red-950 border-b border-red-800 px-5 py-3 text-red-300 text-sm font-medium">
            ⏰ Reservation expired — item released back to stock.
          </div>
        )}
        {isPending && secondsLeft <= 60 && (
          <div className="bg-amber-950 border-b border-amber-800 px-5 py-3 text-amber-300 text-sm font-medium">
            ⚠️ Less than a minute left!
          </div>
        )}

        <div className="p-6">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Checkout</div>
          <h1 className="text-xl font-bold text-white mb-1">{reservation.product.name}</h1>
          <p className="text-zinc-400 text-sm mb-6">{reservation.product.description}</p>

          <div className="space-y-2 text-sm mb-6 border border-zinc-800 rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-zinc-400">Quantity</span>
              <span className="text-zinc-200">{reservation.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Price</span>
              <span className="text-white font-bold text-base">
                ₹{(reservation.product.price * reservation.quantity).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="mb-6 text-center bg-zinc-800 rounded-lg py-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Reserved for</div>
              <div className={`text-4xl font-mono font-bold tabular-nums ${secondsLeft <= 60 ? "text-red-400" : "text-white"}`}>
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {isPending && (
            <div className="flex gap-3">
              <button
                onClick={confirm}
                disabled={actionLoading}
                className="flex-1 bg-white text-zinc-900 font-semibold rounded-lg py-3 text-sm
                  hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Processing..." : "Confirm Purchase"}
              </button>
              <button
                onClick={cancel}
                disabled={actionLoading}
                className="px-5 bg-zinc-800 text-zinc-300 rounded-lg py-3 text-sm
                  hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}

          {(isConfirmed || isExpired) && (
            <button
              onClick={() => router.push("/")}
              className="w-full bg-zinc-800 text-zinc-300 rounded-lg py-3 text-sm hover:bg-zinc-700 transition-colors"
            >
              Back to products
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-700 text-center">
        Reservation ID: {id}
      </div>
    </div>
  );
}