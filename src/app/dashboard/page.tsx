"use client";

export const dynamic = 'force-dynamic';

import { UserButton } from "@clerk/nextjs";
import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        router.push(event.data.path);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  useEffect(() => {
    // Check if payment was just successful
    if (searchParams.get('payment_success') === 'true') {
      // Small delay to ensure iframe is loaded
      setTimeout(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PAYMENT_SUCCESS' }, '*');
        }
      }, 1000);
      
      // Clean up the URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0d1117] relative">
      <div className="absolute z-50 top-4 right-8 transform scale-150 origin-top-right">
        <UserButton 
          appearance={{
            elements: {
              userButtonAvatarBox: "border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            }
          }}
        />
      </div>
      
      {/* Vanilla JS Dashboard embedded seamlessly */}
      <iframe 
        ref={iframeRef}
        src="/dashboard-content.html" 
        className="w-full h-full border-none"
        title="IRIS Dashboard"
      />
    </div>
  );
}
