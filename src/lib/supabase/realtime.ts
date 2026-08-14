"use client";

import { useEffect } from "react";
import { createClient } from "./client";

let isInitialized = false;

/**
 * Initializes global Supabase Realtime WebSocket listeners
 * for live multi-device synchronization across WashOS.
 */
export function initWashOSRealtime() {
  if (typeof window === "undefined" || isInitialized) return;

  try {
    const supabase = createClient();
    const channel = supabase.channel("washos-live-sync");

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerDataChange = (detail?: { table: string; eventType: string; payload: any }) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("washos_data_change", { detail })
        );
        window.dispatchEvent(
          new CustomEvent("washos_realtime_event", { detail })
        );
      }, 150);
    };

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wash_transactions" },
        (payload) => {
          triggerDataChange({ table: "wash_transactions", eventType: payload.eventType, payload });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "soap_requests" },
        (payload) => {
          triggerDataChange({ table: "soap_requests", eventType: payload.eventType, payload });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        (payload) => {
          triggerDataChange({ table: "inventory", eventType: payload.eventType, payload });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "washer_inventory" },
        (payload) => {
          triggerDataChange({ table: "washer_inventory", eventType: payload.eventType, payload });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_orders" },
        (payload) => {
          triggerDataChange({ table: "purchase_orders", eventType: payload.eventType, payload });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          triggerDataChange({ table: "notifications", eventType: payload.eventType, payload });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          isInitialized = true;
        }
      });
  } catch (err) {
    console.warn("Supabase Realtime not available (offline/demo mode):", err);
  }
}

/**
 * React hook to auto-mount realtime listeners and trigger a callback
 * when live database mutations arrive.
 */
export function useWashOSRealtime(onUpdate?: () => void) {
  useEffect(() => {
    initWashOSRealtime();

    if (onUpdate) {
      const handler = () => onUpdate();
      window.addEventListener("washos_data_change", handler);
      return () => window.removeEventListener("washos_data_change", handler);
    }
  }, [onUpdate]);
}
