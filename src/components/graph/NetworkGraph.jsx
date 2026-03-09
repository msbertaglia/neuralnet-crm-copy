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
  fraca: { width: 1, opacity: 0.3 },
  media: { width: 2, opacity: 0.55 },
  forte: { width: 3, opacity: 0.85 },
};

const ORBIT_RADII = [0, 200, 370, 540]; // level 0, 1, 2, 3
const MAX_LEVEL = 3;

/**
 * Compute orbital levels using BFS:
 * - Direct connections (no introduced_by_id): BFS from center up to MAX_LEVEL
 * - Introduced connections (introduced_by_id = C): the introduced person goes to C's level + 1,
 *   with a visual edge drawn from C to the introduced person (not from center)
 */
function computeOrbits(centralContactId, connections) {
  const levels = new Map();
  if (!centralContactId) return levels;

  levels.set(centralContactId, 0);

  // Build direct adjacency map (no introducer)
  const directAdj = new Map();
  connections.forEach(conn => {
    if (conn.introduced_by_id) return;
    const a = conn.contact_a_id, b = conn.contact_b_id;
    if (!directAdj.has(a)) directAdj.set(a, []);
    if (!directAdj.has(b)) directAdj.set(b, []);
    directAdj.get(a).push(b);
    directAdj.get(b).push(a);
  });

  // BFS for direct connections
  const queue = [centralContactId];
  while (queue.length > 0) {
    const current = queue.shift();
    const currentLevel = levels.get(current);
    if (currentLevel >= MAX_LEVEL) continue;
    (directAdj.get(current) || []).forEach(neighbor => {
      if (!levels.has(neighbor)) {
        levels.set(neighbor, currentLevel + 1);
        queue.push(neighbor);
      }
    });
  }

  // Handle introduced connections:
  // (A ↔ B, introduced_by = C) → the introduced person goes to C's level + 1
  connections.forEach(conn => {
    if (!conn.introduced_by_id) return;
    const intId = conn.introduced_by_id;
    const intLevel = levels.get(intId);
    if (intLevel === undefined) return; // introducer not reachable
    const newLevel = intLevel + 1;
    if (newLevel > MAX_LEVEL) return;

    const aId = conn.contact_a_id;
    const bId = conn.contact_b_id;

    // The "introduced" person is the one that did NOT yet know the introducer
    // i.e., the one NOT equal to centralContactId and at a higher level than the introducer
    // We place both A and B if they're unknown, but only if they make sense
    [aId, bId].forEach(id => {
      if (id === intId) return; // introducer itself
      if (!levels.has(id)) {
        levels.set(id, newLevel);
      }
    });
  });

  return levels;
}

export default function NetworkGraph({ contacts, connections, onNodeClick, onNodeDoubleClick, centralContactId }) {
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
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    const levelMap = computeOrbits(centralContactId, connections);
    const centerContact = contacts.find(c => c.id === centralContactId);

    const nodes = [];

    if (!centerContact) {
      nodesRef.current = [];
      edgesRef.current = [];
      return;
    }

    // Center node
    const existingCenter = nodesRef.current.find(n => n.isCenter);
    nodes.push({
      id: "__center__",
      contactId: centerContact.id,
      label: centerContact.nickname || centerContact.name,
      company: centerContact.company || "",
      status: centerContact.status || "ativo",
      nextStepStatus: centerContact.next_step_status || "sem_proximo_passo",
      photoUrl: centerContact.photo_url || null,
      x: existingCenter ? existingCenter.x : W / 2,
      y: existingCenter ? existingCenter.y : H / 2,
      vx: 0, vy: 0,
      radius: 40,
      isCenter: true,
      level: 0,
      contact: centerContact,
    });

    // Level 1..MAX_LEVEL nodes
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      const group = contacts.filter(c => levelMap.get(c.id) === lvl);
      const orbitR = ORBIT_RADII[lvl] || lvl * 180;
      group.forEach((c, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        const existing = nodesRef.current.find(n => n.id === c.id);
        nodes.push({
          id: c.id,
          contactId: c.id,
          label: c.nickname || c.name,
          company: c.company || "",
          status: c.status || "prospect",
          nextStepStatus: c.next_step_status || "sem_proximo_passo",
          photoUrl: c.photo_url || null,
          x: existing ? existing.x : W / 2 + orbitR * Math.cos(angle),
          y: existing ? existing.y : H / 2 + orbitR * Math.sin(angle),
          vx: 0, vy: 0,
          radius: lvl === 1 ? 26 : lvl === 2 ? 21 : 17,
          level: lvl,
          orbitRadius: orbitR,
          contact: c,
        });
      });
    }

    const visibleIds = new Set(nodes.map(n => n.contactId || n.id));
    const edges = [];
    const addedEdges = new Set();

    connections.forEach(conn => {
      const aId = conn.contact_a_id;
      const bId = conn.contact_b_id;

      if (!conn.introduced_by_id) {
        // Direct connection: draw edge between the two parties
        if (!visibleIds.has(aId) || !visibleIds.has(bId)) return;
        const srcNodeId = aId === centralContactId ? "__center__" : aId;
        const tgtNodeId = bId === centralContactId ? "__center__" : bId;
        const key = [srcNodeId, tgtNodeId].sort().join("|");
        if (addedEdges.has(key)) return;
        addedEdges.add(key);
        const isCenterEdge = srcNodeId === "__center__" || tgtNodeId === "__center__";
        edges.push({
          id: conn.id,
          sourceId: srcNodeId,
          targetId: tgtNodeId,
          strength: conn.strength || "media",
          type: conn.connection_type || "",
          isCenterEdge,
        });
      } else {
        // Introduced connection: draw edge from introducer → introduced person
        const intId = conn.introduced_by_id;
        if (!visibleIds.has(intId)) return;

        // The introduced person is whichever of A/B is at the higher level (further from center)
        const intLevel = levelMap.get(intId) ?? 99;
        const aLevel = levelMap.get(aId) ?? 99;
        const bLevel = levelMap.get(bId) ?? 99;

        // Draw edge: introducer → the party that is further away (introduced)
        const introducedId = aLevel > bLevel ? aId : bId;
        if (!visibleIds.has(introducedId)) return;
        const srcNodeId = intId === centralContactId ? "__center__" : intId;
        const tgtNodeId = introducedId === centralContactId ? "__center__" : introducedId;
        const key = [srcNodeId, tgtNodeId].sort().join("|");
        if (addedEdges.has(key)) return;
        addedEdges.add(key);
        edges.push({
          id: `intro-${conn.id}`,
          sourceId: srcNodeId,
          targetId: tgtNodeId,
          strength: conn.strength || "media",
          type: conn.connection_type || "",
          isCenterEdge: srcNodeId === "__center__" || tgtNodeId === "__center__",
          isIntroduced: true,
        });
      }
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [contacts, connections, centralContactId]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;
    const W = canvas.width;
    const H = canvas.height;
    const REPULSION = 4500;
    const ORBIT_STRENGTH = 0.045;
    const DAMPING = 0.80;

    const centerNode = nodes.find(n => n.isCenter);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.isCenter) {
        n.vx += (W / 2 - n.x) * 0.12;
        n.vy += (H / 2 - n.y) * 0.12;
        continue;
      }

      // Orbit attraction
      if (centerNode) {
        const dcx = n.x - centerNode.x;
        const dcy = n.y - centerNode.y;
        const dist = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
        const err = dist - n.orbitRadius;
        const force = err * ORBIT_STRENGTH;
        n.vx -= (dcx / dist) * force;
        n.vy -= (dcy / dist) * force;
      }

      // Repulsion
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const dx = m.x - n.x;
        const dy = m.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const sameLevel = n.level === m.level;
        const force = (REPULSION * (sameLevel ? 1.5 : 1.0)) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        n.vx -= fx; n.vy -= fy;
        m.vx += fx; m.vy += fy;
      }
    }

    nodes.forEach(n => {
      if (dragRef.current && dragRef.current.id === n.id) return;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(n.radius + 4, Math.min(W - n.radius - 4, n.x));
      n.y = Math.max(n.radius + 4, Math.min(H - n.radius - 4, n.y));
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

    const centerNode = nodesRef.current.find(n => n.isCenter);

    // Orbit rings
    if (centerNode) {
      const ringOpacity = [0, 0.12, 0.08, 0.05];
      for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
        const r = ORBIT_RADII[lvl] || lvl * 180;
        ctx.beginPath();
        ctx.arc(centerNode.x, centerNode.y, r, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(99,102,241,${ringOpacity[lvl] || 0.04})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 12]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(99,102,241,0.18)";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`N${lvl}`, centerNode.x + r + 6, centerNode.y - 5);
      }
    }

    // Edges
    edgesRef.current.forEach(e => {
      const src = nodesRef.current.find(n => n.id === e.sourceId);
      const tgt = nodesRef.current.find(n => n.id === e.targetId);
      if (!src || !tgt) return;
      const s = CONNECTION_STRENGTH[e.strength] || CONNECTION_STRENGTH.media;
      const isCenterEdge = e.isCenterEdge || src.isCenter || tgt.isCenter;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (e.isIntroduced) {
        // Introduced: dashed, softer
        ctx.strokeStyle = `rgba(148,163,184,${s.opacity * 0.7})`;
        ctx.lineWidth = s.width * 0.8;
        ctx.setLineDash([4, 6]);
      } else if (isCenterEdge) {
        ctx.strokeStyle = `rgba(99,102,241,${s.opacity})`;
        ctx.lineWidth = s.width + 0.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = `rgba(148,163,184,${s.opacity})`;
        ctx.lineWidth = s.width;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Nodes (center last)
    const sorted = [...nodesRef.current].sort((a, b) => (a.isCenter ? 1 : 0) - (b.isCenter ? 1 : 0));
    sorted.forEach(n => {
      const isHovered = hoveredRef.current === n.id;

      if (n.isCenter) {
        // Glow ring
        ctx.shadowColor = "#6366f1";
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 9, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(99,102,241,0.12)";
        ctx.fill();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2;
        ctx.stroke();

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

        const initials = n.label.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        ctx.fillStyle = "#e0e7ff";
        ctx.font = `bold ${Math.round(n.radius * 0.52)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, n.x, n.y);
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = "#a5b4fc";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.label.split(" ").slice(0, 2).join(" "), n.x, n.y + n.radius + 18);
        ctx.fillStyle = "#6366f1";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText("Centro", n.x, n.y + n.radius + 29);
        return;
      }

      const statusColor = STATUS_COLORS[n.status] || "#94a3b8";
      const nextColor = NEXT_STEP_COLORS[n.nextStepStatus] || "#94a3b8";
      const alpha = n.level === 1 ? 1 : n.level === 2 ? 0.78 : 0.6;

      if (isHovered) { ctx.shadowColor = statusColor; ctx.shadowBlur = 18; }

      // Outer ring (next step)
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 5, 0, 2 * Math.PI);
      ctx.fillStyle = nextColor + "22";
      ctx.fill();
      ctx.strokeStyle = nextColor + Math.round(alpha * 200).toString(16).padStart(2, "0");
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? "#1e293b" : "#0f172a";
      ctx.fill();
      ctx.strokeStyle = statusColor + Math.round(alpha * 230).toString(16).padStart(2, "0");
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Avatar / initials
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius - 3, 0, 2 * Math.PI);
      ctx.clip();
      if (n.photoUrl) {
        if (!n._img) { n._img = new Image(); n._img.src = n.photoUrl; }
        if (n._img.complete && n._img.naturalWidth > 0) {
          ctx.drawImage(n._img, n.x - n.radius + 3, n.y - n.radius + 3, (n.radius - 3) * 2, (n.radius - 3) * 2);
        } else {
          drawInitials(ctx, n, alpha);
        }
      } else {
        drawInitials(ctx, n, alpha);
      }
      ctx.restore();

      // Name
      ctx.fillStyle = isHovered ? "#f8fafc" : `rgba(203,213,225,${alpha})`;
      ctx.font = `${isHovered ? "bold " : ""}${n.level >= 3 ? "9" : n.level === 2 ? "10" : "11"}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(n.label.split(" ").slice(0, 2).join(" "), n.x, n.y + n.radius + 14);

      if (n.company && n.level === 1) {
        ctx.fillStyle = "rgba(100,116,139,0.7)";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText(n.company, n.x, n.y + n.radius + 24);
      }
    });

    ctx.restore();
  }, []);

  function drawInitials(ctx, n, alpha = 1) {
    const statusColor = STATUS_COLORS[n.status] || "#94a3b8";
    const gradient = ctx.createRadialGradient(n.x, n.y - 5, 2, n.x, n.y, n.radius);
    gradient.addColorStop(0, statusColor + "44");
    gradient.addColorStop(1, statusColor + "11");
    ctx.fillStyle = gradient;
    ctx.fillRect(n.x - n.radius + 3, n.y - n.radius + 3, (n.radius - 3) * 2, (n.radius - 3) * 2);
    const initials = n.label.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    ctx.fillStyle = statusColor + Math.round(alpha * 255).toString(16).padStart(2, "0");
    ctx.font = `bold ${Math.round(n.radius * 0.58)}px Inter, sans-serif`;
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

  useEffect(() => { buildGraph(); }, [buildGraph]);

  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [loop]);

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
        const rect = canvas.getBoundingClientRect();
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
      const rect = canvas.getBoundingClientRect();
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
    <canvas ref={canvasRef} className="w-full h-full" style={{ background: "transparent" }} />
  );
}