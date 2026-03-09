import { useEffect, useRef, useCallback } from "react";

const STATUS_COLORS = {
  ativo: "#22c55e",
  inativo: "#94a3b8",
  prospect: "#f59e0b",
  parceiro: "#3b82f6",
  cliente: "#8b5cf6",
  investidor: "#ec4899",
};

const NEXT_STEP_COLORS = {
  pendente: "#f59e0b",
  aguardando: "#3b82f6",
  atrasado: "#ef4444",
  concluido: "#22c55e",
  sem_proximo_passo: "#94a3b8",
};

const CONNECTION_STRENGTH = {
  fraca: { width: 1, opacity: 0.4 },
  media: { width: 2, opacity: 0.6 },
  forte: { width: 3, opacity: 0.9 },
};

const CENTER_NODE_ID = "__center__";

export default function NetworkGraph({ contacts, connections, onNodeClick, onNodeDoubleClick, centerUser }) {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const dragRef = useRef(null);
  const animFrameRef = useRef(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef(null);
  const hoveredRef = useRef(null);

  const buildGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !contacts.length) return;
    const W = canvas.width;
    const H = canvas.height;

    const centerLabel = centerUser?.full_name || "Você";

    // Center node (the logged-in user)
    const existingCenter = nodesRef.current.find(n => n.id === CENTER_NODE_ID);
    const centerNode = {
      id: CENTER_NODE_ID,
      label: centerLabel,
      company: "",
      status: "ativo",
      nextStepStatus: "sem_proximo_passo",
      photoUrl: null,
      x: existingCenter ? existingCenter.x : W / 2,
      y: existingCenter ? existingCenter.y : H / 2,
      vx: 0,
      vy: 0,
      radius: 38,
      isCenter: true,
      contact: null,
    };

    const nodes = [centerNode, ...contacts.map((c, i) => {
      const angle = (2 * Math.PI * i) / contacts.length;
      const radius = Math.min(W, H) * 0.35;
      const existing = nodesRef.current.find(n => n.id === c.id);
      return {
        id: c.id,
        label: c.nickname || c.name,
        company: c.company || "",
        status: c.status || "prospect",
        nextStepStatus: c.next_step_status || "sem_proximo_passo",
        photoUrl: c.photo_url || null,
        x: existing ? existing.x : W / 2 + radius * Math.cos(angle),
        y: existing ? existing.y : H / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: 28,
        contact: c,
      };
    })];

    // Edges between contacts
    const contactEdges = connections.map(conn => ({
      id: conn.id,
      sourceId: conn.contact_a_id,
      targetId: conn.contact_b_id,
      strength: conn.strength || "media",
      type: conn.connection_type || "profissional",
      isCenterEdge: false,
    }));

    // Edges from center to all contacts
    const centerEdges = contacts.map(c => ({
      id: `center-${c.id}`,
      sourceId: CENTER_NODE_ID,
      targetId: c.id,
      strength: "fraca",
      type: "",
      isCenterEdge: true,
    }));

    const edges = [...centerEdges, ...contactEdges];

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [contacts, connections]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;

    const W = canvas.width;
    const H = canvas.height;
    const REPULSION = 3500;
    const ATTRACTION = 0.015;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.001;

    for (let i = 0; i < nodes.length; i++) {
      // Pin the center node strongly
      if (nodes[i].isCenter) {
        nodes[i].vx += (W / 2 - nodes[i].x) * 0.1;
        nodes[i].vy += (H / 2 - nodes[i].y) * 0.1;
        continue;
      }
      nodes[i].vx += (W / 2 - nodes[i].x) * CENTER_GRAVITY;
      nodes[i].vy += (H / 2 - nodes[i].y) * CENTER_GRAVITY;

      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    edges.forEach(e => {
      const src = nodes.find(n => n.id === e.sourceId);
      const tgt = nodes.find(n => n.id === e.targetId);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = e.isCenterEdge ? 220 : 180;
      const force = (dist - idealDist) * ATTRACTION;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.vx += fx;
      src.vy += fy;
      tgt.vx -= fx;
      tgt.vy -= fy;
    });

    nodes.forEach(n => {
      if (dragRef.current && dragRef.current.id === n.id) return;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(n.radius, Math.min(W - n.radius, n.x));
      n.y = Math.max(n.radius, Math.min(H - n.radius, n.y));
    });
  }, []);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x: tx, y: ty, scale } = transformRef.current;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    // Draw edges
    edgesRef.current.forEach(e => {
      const src = nodesRef.current.find(n => n.id === e.sourceId);
      const tgt = nodesRef.current.find(n => n.id === e.targetId);
      if (!src || !tgt) return;
      const s = CONNECTION_STRENGTH[e.strength] || CONNECTION_STRENGTH.media;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      if (e.isCenterEdge) {
        ctx.strokeStyle = `rgba(99,102,241,0.2)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
      } else {
        ctx.strokeStyle = `rgba(148,163,184,${s.opacity})`;
        ctx.lineWidth = s.width;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Mid label (only for contact-contact edges)
      if (!e.isCenterEdge && e.type) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.fillStyle = "rgba(100,116,139,0.8)";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.type, mx, my - 4);
      }
    });

    // Draw nodes (center last so it's on top)
    const sortedNodes = [...nodesRef.current].sort((a, b) => (a.isCenter ? 1 : 0) - (b.isCenter ? 1 : 0));
    sortedNodes.forEach(n => {
      const isHovered = hoveredRef.current === n.id;

      if (n.isCenter) {
        // Draw center node (you)
        ctx.shadowColor = "#6366f1";
        ctx.shadowBlur = 30;

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 8, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(99,102,241,0.15)";
        ctx.fill();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Main circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
        const grad = ctx.createRadialGradient(n.x, n.y - 10, 4, n.x, n.y, n.radius);
        grad.addColorStop(0, "#4f46e5");
        grad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#818cf8";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Initials
        const initials = n.label.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        ctx.fillStyle = "#e0e7ff";
        ctx.font = `bold ${n.radius * 0.55}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, n.x, n.y);
        ctx.textBaseline = "alphabetic";

        // Name below
        ctx.fillStyle = "#a5b4fc";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        const shortName = n.label.split(" ").slice(0, 2).join(" ");
        ctx.fillText(shortName, n.x, n.y + n.radius + 17);
        ctx.fillStyle = "#6366f1";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText("Você", n.x, n.y + n.radius + 28);
        return;
      }

      const statusColor = STATUS_COLORS[n.status] || "#94a3b8";
      const nextColor = NEXT_STEP_COLORS[n.nextStepStatus] || "#94a3b8";

      // Shadow
      if (isHovered) {
        ctx.shadowColor = statusColor;
        ctx.shadowBlur = 20;
      }

      // Outer ring (next step status)
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 6, 0, 2 * Math.PI);
      ctx.fillStyle = nextColor + "33";
      ctx.fill();
      ctx.strokeStyle = nextColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? "#1e293b" : "#0f172a";
      ctx.fill();
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Avatar / initials
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius - 3, 0, 2 * Math.PI);
      ctx.clip();

      if (n.photoUrl) {
        if (!n._img) {
          n._img = new Image();
          n._img.src = n.photoUrl;
          n._img.onload = () => {};
        }
        if (n._img.complete && n._img.naturalWidth > 0) {
          ctx.drawImage(n._img, n.x - n.radius + 3, n.y - n.radius + 3, (n.radius - 3) * 2, (n.radius - 3) * 2);
        } else {
          drawInitials(ctx, n);
        }
      } else {
        drawInitials(ctx, n);
      }
      ctx.restore();

      // Name label
      ctx.fillStyle = isHovered ? "#f8fafc" : "#cbd5e1";
      ctx.font = `${isHovered ? "bold " : ""}11px Inter, sans-serif`;
      ctx.textAlign = "center";
      const shortName = n.label.split(" ").slice(0, 2).join(" ");
      ctx.fillText(shortName, n.x, n.y + n.radius + 16);

      if (n.company) {
        ctx.fillStyle = "#64748b";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText(n.company, n.x, n.y + n.radius + 27);
      }
    });

    ctx.restore();
  }, []);

  function drawInitials(ctx, n) {
    const statusColor = STATUS_COLORS[n.status] || "#94a3b8";
    const gradient = ctx.createRadialGradient(n.x, n.y - 5, 2, n.x, n.y, n.radius);
    gradient.addColorStop(0, statusColor + "44");
    gradient.addColorStop(1, statusColor + "11");
    ctx.fillStyle = gradient;
    ctx.fillRect(n.x - n.radius + 3, n.y - n.radius + 3, (n.radius - 3) * 2, (n.radius - 3) * 2);

    const initials = n.label.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    ctx.fillStyle = statusColor;
    ctx.font = `bold ${n.radius * 0.6}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, n.x, n.y);
    ctx.textBaseline = "alphabetic";
  }

  const loop = useCallback(() => {
    simulate();
    drawGraph();
    animFrameRef.current = requestAnimationFrame(loop);
  }, [simulate, drawGraph]);

  const getNodeAtPos = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transformRef.current;
    const wx = (clientX - rect.left - tx) / scale;
    const wy = (clientY - rect.top - ty) / scale;
    return nodesRef.current.find(n => {
      const dx = n.x - wx;
      const dy = n.y - wy;
      return Math.sqrt(dx * dx + dy * dy) < n.radius + 8;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    observer.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [loop]);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let clickTimeout = null;

    const onMouseDown = (e) => {
      const node = getNodeAtPos(e.clientX, e.clientY);
      if (node) {
        dragRef.current = node;
      } else {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      }
    };

    const onMouseMove = (e) => {
      const node = getNodeAtPos(e.clientX, e.clientY);
      hoveredRef.current = node ? node.id : null;
      canvas.style.cursor = node ? "pointer" : (isPanningRef.current ? "grabbing" : "grab");

      if (dragRef.current) {
        const canvas2 = canvasRef.current;
        const rect = canvas2.getBoundingClientRect();
        const { x: tx, y: ty, scale } = transformRef.current;
        dragRef.current.x = (e.clientX - rect.left - tx) / scale;
        dragRef.current.y = (e.clientY - rect.top - ty) / scale;
        dragRef.current.vx = 0;
        dragRef.current.vy = 0;
      } else if (isPanningRef.current && panStartRef.current) {
        transformRef.current.x = e.clientX - panStartRef.current.x;
        transformRef.current.y = e.clientY - panStartRef.current.y;
      }
    };

    const onMouseUp = (e) => {
      if (dragRef.current) {
        const node = dragRef.current;
        dragRef.current = null;
        // detect click vs drag
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          if (onNodeDoubleClick) onNodeDoubleClick(node.contact);
        } else {
          clickTimeout = setTimeout(() => {
            clickTimeout = null;
            if (onNodeClick && !node.isCenter) onNodeClick(node.contact);
          }, 250);
        }
      }
      isPanningRef.current = false;
      panStartRef.current = null;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      const canvas2 = canvasRef.current;
      const rect = canvas2.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x: tx, y: ty, scale } = transformRef.current;
      const newScale = Math.min(3, Math.max(0.2, scale * delta));
      transformRef.current = {
        x: mx - (mx - tx) * (newScale / scale),
        y: my - (my - ty) * (newScale / scale),
        scale: newScale,
      };
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onNodeClick, onNodeDoubleClick]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}