import type { ReactNode } from "react";

interface EmployeeLayoutProps {
  children: ReactNode;
}

export default function EmployeeLayout({
  children,
}: EmployeeLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        {/* ... header code ... */}
      </header>

      <main>{children}</main>

    
    </div>
  );
}