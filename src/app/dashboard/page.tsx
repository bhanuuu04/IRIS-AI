"use client";

import { UserButton } from "@clerk/nextjs";
import { useEffect, useRef, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Inner component that uses useSearchParams ───────────────────────────────
// Must be wrapped in <Suspense> at the parent level to avoid the prerender error.
function PaymentSuccessHandler({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('payment_success') === 'true') {
      setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PAYMENT_SUCCESS' }, '*');
        }
      }, 1000);
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, iframeRef]);

  return null;
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentView, setCurrentView] = useState('dashboard');

  // Listen for navigation messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE') {
        router.push(event.data.path);
      } else if (event.data?.type === 'VIEW_CHANGED') {
        setCurrentView(event.data.view);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0d1117] relative">
      {/* Suspense boundary required for useSearchParams */}
      <Suspense fallback={null}>
        <PaymentSuccessHandler iframeRef={iframeRef} />
      </Suspense>

      {/* Clerk Profile Button */}
      {currentView === 'dashboard' && (
        <div className="absolute z-50 top-4 right-8 transform scale-150 origin-top-right">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
              },
            }}
          />
        </div>
      )}

      {/* Vanilla JS Dashboard */}
      <iframe
        ref={iframeRef}
        src="/dashboard-content.html"
        className="w-full h-full border-none"
        title="IRIS Dashboard"
      />
    </div>
  );
}
