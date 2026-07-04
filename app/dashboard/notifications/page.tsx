"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";

export default function NotificationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <PageLoader />
      </div>
    </main>
  );
}
