import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("404 route visited:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The route <span className="font-mono text-foreground">{location.pathname}</span> does not exist.
        </p>
        <Link to="/" className="mt-6 inline-flex text-sm font-semibold text-primary transition-colors hover:text-primary/90">
          Return to the chat
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
