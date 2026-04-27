import { useEffect, useRef } from "react";

export default function CinematicOverlay() {
  const overlayRef = useRef(null);

  useEffect(() => {
    const el = overlayRef.current;

    let pos = 0;

    const animate = () => {
      pos += 0.5;
      el.style.backgroundPosition = `0 ${pos}px`;
      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <div
      ref={overlayRef}
      className="cinematic-overlay"
    />
  );
}