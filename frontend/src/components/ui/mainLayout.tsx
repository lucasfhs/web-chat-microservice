import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
