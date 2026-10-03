"use client";

import { useEffect } from "react";
import { sendGTMEvent } from "@next/third-parties/google";
import { canadaSemFiltroTracking } from "../lib/marketing-tracking";
import { trackSimulatorMetaEvent } from "./SimulatorMetaPixel";

type FunnelPayload = Record<string, string> & { event: string };

function currentUtm() {
  if (typeof window === "undefined") return {};
  const allowedKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(allowedKeys.flatMap((key) => {
    const value = params.get(key)?.trim();
    return value ? [[key, value.slice(0, 120)]] : [];
  }));
}

function sendFunnelEvent(event: string, detail: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  const payload: FunnelPayload = {
    event,
    product: "simulador_canada_sem_filtro",
    page_path: window.location.pathname,
    device_type: window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop",
    ...currentUtm(),
    ...detail,
  };
  sendGTMEvent(payload);
  if (event === "simulator_page_view") {
    trackSimulatorMetaEvent("ViewContent", {
      content_name: canadaSemFiltroTracking.productName,
      content_type: "product",
      content_ids: [canadaSemFiltroTracking.productId],
      value: canadaSemFiltroTracking.productPrice,
      currency: canadaSemFiltroTracking.currency,
    }, "csf_simulator_view_content");
  }
  if (event === "simulator_checkout_started") {
    trackSimulatorMetaEvent("InitiateCheckout", {
      content_name: canadaSemFiltroTracking.productName,
      content_type: "product",
      content_ids: [canadaSemFiltroTracking.productId],
      value: canadaSemFiltroTracking.productPrice,
      currency: canadaSemFiltroTracking.currency,
    });
  }
  window.dispatchEvent(new CustomEvent("simulator:analytics", { detail: payload }));
}

export function SimulatorPageTracking() {
  useEffect(() => {
    sendFunnelEvent("simulator_page_view");
    const trackCheckout = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-cta-placement]") : null;
      if (link) sendFunnelEvent("simulator_checkout_started", { cta_placement: link.dataset.ctaPlacement ?? "" });
    };
    document.addEventListener("click", trackCheckout);
    return () => document.removeEventListener("click", trackCheckout);
  }, []);
  return null;
}
