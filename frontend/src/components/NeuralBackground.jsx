import { useEffect, useRef } from "react";

export default function NeuralBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const nodeCount = 90;
    const maxDistance = 140;
    const nodes = [];
    const mouse = { x: null, y: null };

    class Node {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
      }

      move() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x <= 0 || this.x >= width) this.vx *= -1;
        if (this.y <= 0 || this.y >= height) this.vy *= -1;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2);
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

      // Mouse interaction
      if (mouse.x && mouse.y) {
        nodes.forEach(node => {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.stroke();
          }
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      nodes.forEach(node => {
        node.move();
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
    <canvas
      ref={canvasRef}
      className="neural-bg"
    />
  );
}