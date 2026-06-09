export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} ByteTalk. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}