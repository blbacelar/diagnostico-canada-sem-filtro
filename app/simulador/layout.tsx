import { GoogleTagManager } from "@next/third-parties/google";
import Script from "next/script";
import { SimulatorMetaPixel } from "../../components/SimulatorMetaPixel";
import { canadaSemFiltroTracking } from "../../lib/marketing-tracking";

export default function SimulatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <GoogleTagManager gtmId={canadaSemFiltroTracking.googleTagManagerId} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${canadaSemFiltroTracking.googleAdsId}`}
        strategy="afterInteractive"
      />
      <Script id="csf-google-ads" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${canadaSemFiltroTracking.googleAdsId}');
        `}
      </Script>
      <noscript>
        <iframe
          aria-label="Google Tag Manager"
          height="0"
          src={`https://www.googletagmanager.com/ns.html?id=${canadaSemFiltroTracking.googleTagManagerId}`}
          style={{ display: "none", visibility: "hidden" }}
          width="0"
        />
      </noscript>
      <SimulatorMetaPixel />
      {children}
    </>
  );
}
