"use client";


import TambahIndikatorLayout from "./TambahIndikatorLayout";
import dynamic from "next/dynamic";
const TambahIndikatorForm = dynamic(() => import("@/features/master-indikator/TambahIndikatorForm"), { ssr: false });

export default function TambahIndikatorPage() {
  return (
    <TambahIndikatorLayout>
      <TambahIndikatorForm />
    </TambahIndikatorLayout>
  );
}
