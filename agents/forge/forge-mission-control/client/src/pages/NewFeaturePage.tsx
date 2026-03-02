import { Link } from "react-router-dom";
import { Puzzle } from "lucide-react";

export function NewFeaturePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <Puzzle className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <h1 className="text-xl font-semibold text-foreground">New Feature</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Coming soon — New Feature creation will be available in Phase 3.
        </p>
      </div>
      <Link
        to="/product/features"
        className="text-sm text-primary hover:underline"
      >
        ← Back to Feature Board
      </Link>
    </div>
  );
}
