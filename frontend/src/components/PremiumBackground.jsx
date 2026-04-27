import { useEffect, useRef } from "react";

export default function PremiumBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const nodes = [];
    const nodeCount = 100;
    const maxDistance = 160;

    const mouse = { x: width / 2, y: height / 2 };

    class Node {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.z = Math.random() * 2;
        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = (Math.random() - 0.5) * 0.6;
      }

      move() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x <= 0 || this.x >= width) this.vx *= -1;
        if (this.y <= 0 || this.y >= height) this.vy *= -1;
      }

      draw() {
        const size = 2 + this.z;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,255,255,0.9)";
        ctx.fill();
      }
    }

    for (let i = 0; i < nodeCount; i++) {
      nodes.push(new Node());
    }

    function connect() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,255,255,${1 - dist / maxDistance})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      nodes.forEach(node => {
        node.move();

        // Parallax depth
        node.x += (mouse.x - width / 2) * 0.0003 * node.z;
        node.y += (mouse.y - height / 2) * 0.0003 * node.z;

        node.draw();
      });

      connect();
      requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

  }, []);

  return (
    <>
      <div className="gradient-mesh" />
      <canvas ref={canvasRef} className="premium-bg" />
    </>
  );
}