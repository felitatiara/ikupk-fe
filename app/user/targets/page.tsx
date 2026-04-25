"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TargetsUser() {
  const router = useRouter();
  useEffect(() => { router.replace("/user/iku-pk"); }, [router]);
  return null;
}
