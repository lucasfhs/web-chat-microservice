import { Outlet } from "react-router-dom";
import { Footer } from "./footer";

export function AuthLayout() {
  return (
    <div className="h-screen flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}