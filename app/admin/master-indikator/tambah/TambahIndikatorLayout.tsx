import dynamic from "next/dynamic";

const TambahIndikatorForm = dynamic(() => import("@/features/master-indikator/TambahIndikatorForm"), { ssr: false });

export default function TambahIndikatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 32 }}>
      <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 24 }}>
        {children}
      </div>
    </div>
  );
}
