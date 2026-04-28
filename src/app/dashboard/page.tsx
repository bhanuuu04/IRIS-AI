import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="w-full h-screen overflow-hidden bg-[#0d1117] relative">
      {/* Absolute floating Clerk Profile Button */}
      <div className="absolute z-50 top-6 right-8">
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
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
