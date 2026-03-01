import { useParams } from "react-router-dom";

export function BacklogItemPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Backlog Item</h1>
      <p className="text-muted-foreground">{id ?? "No item selected"}</p>
    </div>
  );
}
