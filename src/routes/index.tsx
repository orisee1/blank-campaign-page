import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campanha" },
      { name: "description", content: "Campanha" },
      { property: "og:title", content: "Campanha" },
      { property: "og:description", content: "Campanha" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Campanha
      </h1>
    </main>
  );
}
