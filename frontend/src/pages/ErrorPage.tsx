import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md text-center space-y-6">
        <div className="p-4 bg-gray-100 text-black rounded-full">
          <AlertCircle size={48} />
        </div>

        <h1 className="text-[10rem] md:text-[12rem] font-black leading-none tracking-tighter text-black dark:text-white select-none">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Página não encontrada
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Ops... essa página não existe :/
          </p>
        </div>

        <div className="pt-4">
          <Button asChild variant="default" size="lg" className="px-8 shadow-md hover:shadow-lg transition-all duration-200">
            <Link to="/">
              Voltar para o Início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}