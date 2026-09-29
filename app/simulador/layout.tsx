import { GoogleTagManager } from "@next/third-parties/google";
import { SimulatorMetaPixel } from "../../components/SimulatorMetaPixel";
import { canadaSemFiltroTracking } from "../../lib/marketing-tracking";

export default function SimulatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <GoogleTagManager gtmId={canadaSemFiltroTracking.googleTagManagerId} />
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
