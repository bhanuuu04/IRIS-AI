"use client";

import { UserButton } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        router.push(event.data.path);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0d1117] relative">
      {/* Absolute floating Clerk Profile Button */}
      <div className="absolute z-50 top-4 right-8">
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-12 h-12 border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            }
          }}
        />
      </div>
      
      {/* Vanilla JS Dashboard embedded seamlessly */}
      <iframe 
        src="/dashboard-content.html" 
        className="w-full h-full border-none"
        title="IRIS Dashboard"
      />
    </div>
  );
}
