import { useParams } from "react-router-dom";

export function WorkerDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Worker Detail</h1>
      <p className="text-muted-foreground">{id ?? "No worker selected"}</p>
    </div>
  );
}
