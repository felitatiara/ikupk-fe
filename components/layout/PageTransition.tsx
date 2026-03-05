"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div
      style={{
        transition: "opacity 180ms ease, transform 180ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(4px)",
      }}
    >
      {children}
    </div>
  );
}
