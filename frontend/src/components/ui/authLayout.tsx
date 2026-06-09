import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="h-screen flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
