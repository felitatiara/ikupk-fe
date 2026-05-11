"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import TambahIndikatorLayout from "../../tambah/TambahIndikatorLayout";
import dynamic from "next/dynamic";

const CascadeIndikatorForm = dynamic(
  () => import("@/features/master-indikator/CascadeIndikatorForm"),
  { ssr: false },
);

function CascadePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const l0Id = Number(params.id);
  const jenis = searchParams.get("jenis") ?? "IKU";
  const tahun = searchParams.get("tahun") ?? String(new Date().getFullYear());

  return (
    <TambahIndikatorLayout>
      <CascadeIndikatorForm l0Id={l0Id} jenis={jenis} tahun={tahun} />
    </TambahIndikatorLayout>
  );
}

export default function CascadeIndikatorPage() {
  return (
    <Suspense>
      <CascadePageInner />
    </Suspense>
  );
}
