import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

export default function ParticleBackground() {

  const particlesInit = async (engine) => {
    await loadFull(engine);
  };

  return (
    <Particles
      init={particlesInit}
      options={{
        background: { color: "transparent" },
        fpsLimit: 60,
        particles: {
          number: { value: 80 },
          color: { value: "#00f7ff" },
          links: {
            enable: true,
            color: "#00f7ff",
            distance: 120,
            opacity: 0.4,
            width: 1
          },
          move: {
            enable: true,
            speed: 1
          },
          opacity: { value: 0.6 },
          size: { value: { min: 1, max: 4 } }
        }
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0
      }}
    />
  );
}