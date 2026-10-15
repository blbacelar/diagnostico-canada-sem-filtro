import Script from "next/script";

const googleAdsId = "AW-18488294475";
const googleTagManagerId = "GTM-P2K5JWSC";

export default function SimulatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Script id="csf-google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${googleTagManagerId}');
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
        strategy="afterInteractive"
      />
      <Script id="csf-google-ads" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${googleAdsId}');
        `}
      </Script>
      <noscript>
        <iframe
          aria-label="Google Tag Manager"
          height="0"
          src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
          style={{ display: "none", visibility: "hidden" }}
          width="0"
        />
      </noscript>
      {children}
    </>
  );
}
