import { useParams } from "react-router-dom";

export function DocPage() {
  const { "*": path } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Document</h1>
      <p className="text-muted-foreground">{path ?? "No document selected"}</p>
    </div>
  );
}
