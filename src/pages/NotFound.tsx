import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-slate-500">Die gewünschte Seite wurde nicht gefunden.</p>
      <Link to="/"><Button>Zurück zum Dashboard</Button></Link>
    </div>
  );
}
