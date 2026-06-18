import React from "react";
import { Sidebar, type SidebarPageID } from "./Sidebar";

interface DashboardLayoutProps {
  activePage: SidebarPageID;
  onNavigate: (page: SidebarPageID) => void;
  callActive?: boolean;
  children: React.ReactNode;
}

export function DashboardLayout({ activePage, onNavigate, callActive, children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar activePage={activePage} onNavigate={onNavigate} callActive={callActive} />
      <main className="dashboard-main">
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}
