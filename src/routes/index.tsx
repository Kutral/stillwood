import { createFileRoute } from "@tanstack/react-router";
import Stillwood from "@/game/Stillwood";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Stillwood />;
}
