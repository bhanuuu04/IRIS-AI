export default function Footer() {
  return (
    <footer className="relative py-12 border-t border-white/10 mt-auto">
      <div className="flex flex-col items-center justify-between px-6 mx-auto max-w-7xl md:flex-row">
        <div className="mb-4 md:mb-0">
          <span className="text-xl font-bold tracking-widest text-white">IRIS AI</span>
        </div>
        
        <div className="flex flex-col items-center gap-4 text-sm text-white/40 md:flex-row md:gap-8">
          <a href="mailto:contact@iris-ai.com" className="transition-colors hover:text-white">
            contact@iris-ai.com
          </a>
          <span>&copy; {new Date().getFullYear()} IRIS AI. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
