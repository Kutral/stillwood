import { useEffect, useState } from "react";
import { attachInput } from "./input";
import { resumeAudioIfNeeded, unlockAudio } from "./audio";
import { useGame } from "./store";
import { BootScreen, Overlays } from "./ui/Overlays";
import ForestScene from "./ForestScene";

export default function Stillwood() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const detach = attachInput();
    const onVis = () => {
      if (document.visibilityState === "visible") resumeAudioIfNeeded();
    };
    document.addEventListener("visibilitychange", onVis);

    const params = new URLSearchParams(window.location.search);
    if (params.has("qa")) {
      unlockAudio();
      useGame.getState().start();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyC" && useGame.getState().phase === "playing") {
        useGame.getState().cycleCamera();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      detach();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {ready ? (
        <div className="absolute inset-0">
          <ForestScene />
        </div>
      ) : (
        <BootScreen />
      )}
      {ready ? <Overlays /> : null}
    </main>
  );
}
