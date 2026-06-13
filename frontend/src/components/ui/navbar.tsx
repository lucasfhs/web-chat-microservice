import { Link, NavLink } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navbar() {
    return (
        <header className="border-b border-border">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">

                <div className="flex items-center gap-4">
                    <Link
                        to="/rooms"
                        className="text-xl font-bold"
                    >
                        ByteTalk
                    </Link>

                    <Separator
                        orientation="vertical"
                        className="h-6"
                    />

                    <nav className="flex items-center gap-4">
                        <NavLink to="/rooms">
                            Salas
                        </NavLink>
                    </nav>
                </div>

                <Avatar>
                    <AvatarFallback>LP</AvatarFallback>
                </Avatar>

            </div>
        </header>
    );
}