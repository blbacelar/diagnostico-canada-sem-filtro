"use client";

import Script from "next/script";
import { canadaSemFiltroTracking } from "../lib/marketing-tracking";

type MetaEventParameters = Record<string, string | number | string[]>;

declare global {
  interface Window {
    fbq?: (action: "track" | "trackCustom", eventName: string, parameters?: MetaEventParameters) => void;
  }
}

function isPixelEnabled() {
  if (typeof window === "undefined") return false;
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  return !isLocalhost || new URLSearchParams(window.location.search).get("pixel_test") === "1";
}

function hasTrackedInSession(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberInSession(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Tracking should never interrupt the purchase flow when storage is unavailable.
  }
}

export function trackSimulatorMetaEvent(eventName: "ViewContent" | "InitiateCheckout", parameters: MetaEventParameters, onceKey?: string) {
  if (!isPixelEnabled() || typeof window.fbq !== "function" || (onceKey && hasTrackedInSession(onceKey))) return;
  window.fbq("track", eventName, parameters);
  if (onceKey) rememberInSession(onceKey);
}

export function SimulatorMetaPixel() {
  const trackViewContent = () => {
    trackSimulatorMetaEvent("ViewContent", {
      content_name: canadaSemFiltroTracking.productName,
      content_type: "product",
      content_ids: [canadaSemFiltroTracking.productId],
      value: canadaSemFiltroTracking.productPrice,
      currency: canadaSemFiltroTracking.currency,
    }, "csf_simulator_view_content");
  };

  return (
    <Script id="csf-meta-pixel" strategy="afterInteractive" onReady={trackViewContent}>
      {`
        (function(f,b,e,v,n,t,s){
          var local=/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(window.location.hostname);
          if(local && !new URLSearchParams(window.location.search).has('pixel_test')) return;
          if(f.fbq){f.fbq('init','${canadaSemFiltroTracking.metaPixelId}');f.fbq('track','PageView');return;}
          n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
          t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
          f.fbq('init','${canadaSemFiltroTracking.metaPixelId}');f.fbq('track','PageView');
        })(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      `}
    </Script>
  );
}
