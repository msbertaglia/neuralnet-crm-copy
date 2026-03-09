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
  fraca: { width: 1, opacity: 0.35 },
  media: { width: 2, opacity: 0.6 },
  forte: { width: 3.5, opacity: 0.9 },
};

const CENTER_NODE_ID = "__center__";
const ORBIT_UNIT = 210; // px per level

// Compute level (degrees of separation) for each contact from the center
function computeLevels(centralContactId, connections, contacts) {
  const levels = new Map();
  if (!centralContactId) {
    contacts.forEach(c => levels.set(c.id, 1));
    return levels;
  }
  levels.set(centralContactId, 0);

  // First pass: connections directly involving center contact
  connections.forEach(conn => {
    const aId = conn.contact_a_id;
    const bId = conn.contact_b_id;
    const intId = conn.introduced_by_id;
    const involveCenter = aId === centralContactId || bId === centralContactId;

    if (involveCenter && centralContactId) {
      const otherId = aId === centralContactId ? bId : aId;
      if (!intId) {
        // Truly direct — level 1
        if (!levels.has(otherId) || levels.get(otherId) > 1) levels.set(otherId, 1);
      } else {
        // Introduced: introducer = level 1, the introduced contact = level 2
        if (!levels.has(intId) || levels.get(intId) > 1) levels.set(intId, 1);
        if (!levels.has(otherId) || levels.get(otherId) > 2) levels.set(otherId, 2);
      }
    }
  });

  // Also: any introducer referenced in any connection inherits level from the node they introduced to
  connections.forEach(conn => {
    if (!conn.introduced_by_id) return;
    const intId = conn.introduced_by_id;
    const la = levels.get(conn.contact_a_id);
    const lb = levels.get(conn.contact_b_id);
    const minLevel = Math.min(la ?? 99, lb ?? 99);
    if (minLevel < 99) {
      // Introducer sits at same level as the "closer" of the two contacts they connected
      if (!levels.has(intId) || levels.get(intId) > minLevel) {
        levels.set(intId, minLevel);
      }
    }
  });

  // If no centralContactId (center is "Você"), put everyone at level 1 initially
  if (!centralContactId) {
    contacts.forEach(c => { if (!levels.has(c.id)) levels.set(c.id, 1); });
  }

  // BFS propagation through non-center connections
  let changed = true;
  let itr = 0;
  while (changed && itr < 20) {
    changed = false;
    itr++;
    connections.forEach(conn => {
      const la = levels.get(conn.contact_a_id);
      const lb = levels.get(conn.contact_b_id);
      if (la !== undefined && (lb === undefined || lb > la + 1)) {
        levels.set(conn.contact_b_id, la + 1);
        changed = true;
      }
      if (lb !== undefined && (la === undefined || la > lb + 1)) {
        levels.set(conn.contact_a_id, lb + 1);
        changed = true;
      }
    });
  }

  // Orphaned contacts get a far level
  contacts.forEach(c => {
    if (!levels.has(c.id)) levels.set(c.id, 4);
  });

  return levels;
}

export default function NetworkGraph({ contacts, connections, onNodeClick, onNodeDoubleClick, centerUser, centralContactId }) {
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

    const centerContact = centralContactId ? contacts.find(c => c.id === centralContactId) : null;
    const centerLabel = centerContact ? (centerContact.nickname || centerContact.name) : (centerUser?.full_name || "Você");

    // Compute levels
    const levelMap = computeLevels(centralContactId, connections, contacts);

    // Center node
    const existingCenter = nodesRef.current.find(n => n.id === CENTER_NODE_ID);
    const centerNode = {
      id: CENTER_NODE_ID,
      label: centerLabel,
      company: centerContact?.company || "",
      status: centerContact?.status || "ativo",
      nextStepStatus: centerContact?.next_step_status || "sem_proximo_passo",
      photoUrl: centerContact?.photo_url || null,
      x: existingCenter ? existingCenter.x : W / 2,
      y: existingCenter ? existingCenter.y : H / 2,
      vx: 0,
      vy: 0,
      radius: 38,
      isCenter: true,
      level: 0,
      orbitRadius: 0,
      contact: centerContact || null,
    };

    const otherContacts = centerContact ? contacts.filter(c => c.id !== centralContactId) : contacts;

    // Group contacts by level for angular distribution
    const byLevel = {};
    otherContacts.forEach(c => {
      const lvl = levelMap.get(c.id) || 4;
      if (!byLevel[lvl]) byLevel[lvl] = [];
      byLevel[lvl].push(c);
    });

    const nodes = [centerNode];
    Object.entries(byLevel).forEach(([lvlStr, group]) => {
      const lvl = Number(lvlStr);
      const orbitR = lvl * ORBIT_UNIT;
      group.forEach((c, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        const existing = nodesRef.current.find(n => n.id === c.id);
        nodes.push({
          id: c.id,
          label: c.nickname || c.name,
          company: c.company || "",
          status: c.status || "prospect",
          nextStepStatus: c.next_step_status || "sem_proximo_passo",
          photoUrl: c.photo_url || null,
          x: existing ? existing.x : W / 2 + orbitR * Math.cos(angle),
          y: existing ? existing.y : H / 2 + orbitR * Math.sin(angle),
          vx: 0,
          vy: 0,
          radius: Math.max(18, 28 - (lvl - 1) * 2), // slightly smaller per level
          level: lvl,
          orbitRadius: orbitR,
          contact: c,
        });
      });
    });

    // Build edges from real connection records
    const usedImpliedPairs = new Set();
    const contactEdges = connections.map(conn => {
      const srcNode = conn.contact_a_id === centralContactId ? CENTER_NODE_ID : conn.contact_a_id;
      const tgtNode = conn.contact_b_id === centralContactId ? CENTER_NODE_ID : conn.contact_b_id;
      const srcLevel = srcNode === CENTER_NODE_ID ? 0 : (levelMap.get(srcNode) || 1);
      const tgtLevel = tgtNode === CENTER_NODE_ID ? 0 : (levelMap.get(tgtNode) || 1);
      const levelDiff = Math.abs(srcLevel - tgtLevel);
      return {
        id: conn.id,
        sourceId: srcNode,
        targetId: tgtNode,
        strength: conn.strength || "media",
        type: conn.connection_type || "profissional",
        isCenterEdge: false,
        isImplied: false,
        isDirect: levelDiff <= 1,
        hasIntroducer: !!conn.introduced_by_id,
      };
    });

    // Add implied edges from introduction paths (introducer ↔ introduced contact)
    const impliedEdges = [];
    connections.forEach(conn => {
      if (!conn.introduced_by_id) return;
      const intId = conn.introduced_by_id;
      // The "introduced" contact is the one that's NOT the center and NOT the introducer
      const aIsCenter = conn.contact_a_id === centralContactId;
      const bIsCenter = conn.contact_b_id === centralContactId;
      const introducedId = aIsCenter ? conn.contact_b_id : bIsCenter ? conn.contact_a_id : conn.contact_b_id;
      const pairKey = [intId, introducedId].sort().join("|");
      if (usedImpliedPairs.has(pairKey)) return;
      // Only add if there's no existing connection record for this pair
      const alreadyExists = connections.find(c =>
        (c.contact_a_id === intId && c.contact_b_id === introducedId) ||
        (c.contact_b_id === intId && c.contact_a_id === introducedId)
      );
      if (!alreadyExists && nodes.find(n => n.id === intId) && nodes.find(n => n.id === introducedId)) {
        usedImpliedPairs.add(pairKey);
        impliedEdges.push({
          id: `implied-${conn.id}`,
          sourceId: intId,
          targetId: introducedId,
          strength: "media",
          type: "",
          isCenterEdge: false,
          isImplied: true,
          isDirect: true,
          hasIntroducer: false,
        });
      }
    });

    const edges = [...contactEdges, ...impliedEdges];

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [contacts, connections, centralContactId, centerUser]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;

    const W = canvas.width;
    const H = canvas.height;
    const REPULSION = 3800;
    const ORBIT_STRENGTH = 0.035;
    const EDGE_ATTRACTION = 0.008;
    const DAMPING = 0.82;

    const centerNode = nodes.find(n => n.isCenter);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.isCenter) {
        // Pin center
        n.vx += (W / 2 - n.x) * 0.1;
        n.vy += (H / 2 - n.y) * 0.1;
        continue;
      }

      // Orbit force: pull toward target orbit radius from center
      if (centerNode) {
        const dcx = n.x - centerNode.x;
        const dcy = n.y - centerNode.y;
        const distFromCenter = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
        const targetOrbit = n.orbitRadius;
        const orbitError = distFromCenter - targetOrbit;
        const orbitForce = orbitError * ORBIT_STRENGTH;
        n.vx -= (dcx / distFromCenter) * orbitForce;
        n.vy -= (dcy / distFromCenter) * orbitForce;
      }

      // Repulsion between all nodes
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const dx = m.x - n.x;
        const dy = m.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // Stronger repulsion between same-level nodes
        const sameLevel = n.level === m.level;
        const repMult = sameLevel ? 1.4 : 1.0;
        const force = (REPULSION * repMult) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        n.vx -= fx;
        n.vy -= fy;
        m.vx += fx;
        m.vy += fy;
      }
    }

    // Edge spring forces (gentle, to cluster connected nodes angularly)
    edges.forEach(e => {
      if (e.isImplied) return; // implied edges don't affect physics
      const src = nodes.find(n => n.id === e.sourceId);
      const tgt = nodes.find(n => n.id === e.targetId);
      if (!src || !tgt || src.isCenter || tgt.isCenter) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Only angular attraction (tangential), not radial
      const force = EDGE_ATTRACTION * dist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.vx += fx * 0.5;
      src.vy += fy * 0.5;
      tgt.vx -= fx * 0.5;
      tgt.vy -= fy * 0.5;
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

    const centerNode = nodesRef.current.find(n => n.isCenter);
    const maxLevel = Math.max(...nodesRef.current.filter(n => !n.isCenter).map(n => n.level || 1), 1);

    // Draw orbit rings
    if (centerNode) {
      for (let lvl = 1; lvl <= maxLevel; lvl++) {
        const orbitR = lvl * ORBIT_UNIT;
        ctx.beginPath();
        ctx.arc(centerNode.x, centerNode.y, orbitR, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(99,102,241,${0.05 + (lvl === 1 ? 0.04 : 0)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 10]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Level label
        ctx.fillStyle = "rgba(99,102,241,0.2)";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`N${lvl}`, centerNode.x + orbitR + 5, centerNode.y - 4);
      }
    }

    // Draw edges
    edgesRef.current.forEach(e => {
      const src = nodesRef.current.find(n => n.id === e.sourceId);
      const tgt = nodesRef.current.find(n => n.id === e.targetId);
      if (!src || !tgt) return;

      const s = CONNECTION_STRENGTH[e.strength] || CONNECTION_STRENGTH.media;
      const srcLevel = src.isCenter ? 0 : (src.level || 1);
      const tgtLevel = tgt.isCenter ? 0 : (tgt.level || 1);
      const levelDiff = Math.abs(srcLevel - tgtLevel);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (e.isImplied) {
        // Implied introduction path — subtle dashed purple
        ctx.strokeStyle = `rgba(99,102,241,0.25)`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
      } else if (e.hasIntroducer) {
        // Connection made through an introducer — always dashed (indirect)
        ctx.strokeStyle = `rgba(148,163,184,0.25)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 7]);
      } else if (srcLevel === 0 || tgtLevel === 0) {
        // Direct center connection (no introducer) — vivid solid
        ctx.strokeStyle = `rgba(99,102,241,${s.opacity})`;
        ctx.lineWidth = s.width + 0.5;
        ctx.setLineDash([]);
      } else {
        // Contact-to-contact direct connection
        ctx.strokeStyle = `rgba(148,163,184,${s.opacity})`;
        ctx.lineWidth = s.width;
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.setLineDash([]);

      // Edge type label (only for direct contact-contact edges)
      if (!e.isImplied && !e.isCenterEdge && e.type && levelDiff <= 1) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.fillStyle = "rgba(100,116,139,0.7)";
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.type, mx, my - 4);
      }
    });

    // Draw nodes (center last)
    const sortedNodes = [...nodesRef.current].sort((a, b) => (a.isCenter ? 1 : 0) - (b.isCenter ? 1 : 0));
    sortedNodes.forEach(n => {
      const isHovered = hoveredRef.current === n.id;

      if (n.isCenter) {
        ctx.shadowColor = "#6366f1";
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 8, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(99,102,241,0.15)";
        ctx.fill();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2.5;
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
        ctx.font = `bold ${n.radius * 0.55}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, n.x, n.y);
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = "#a5b4fc";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.label.split(" ").slice(0, 2).join(" "), n.x, n.y + n.radius + 17);
        ctx.fillStyle = "#6366f1";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText(centralContactId ? "Centro" : "Você", n.x, n.y + n.radius + 28);
        return;
      }

      const statusColor = STATUS_COLORS[n.status] || "#94a3b8";
      const nextColor = NEXT_STEP_COLORS[n.nextStepStatus] || "#94a3b8";
      // Fade out higher-level nodes slightly
      const levelAlpha = Math.max(0.4, 1 - (n.level - 1) * 0.15);

      if (isHovered) {
        ctx.shadowColor = statusColor;
        ctx.shadowBlur = 20;
      }

      // Outer ring (next step)
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 5, 0, 2 * Math.PI);
      ctx.fillStyle = nextColor + "33";
      ctx.fill();
      ctx.strokeStyle = nextColor + Math.round(levelAlpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 2;
      ctx.stroke();

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? "#1e293b" : "#0f172a";
      ctx.fill();
      ctx.strokeStyle = statusColor + Math.round(levelAlpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 2.5;
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
        }
        if (n._img.complete && n._img.naturalWidth > 0) {
          ctx.drawImage(n._img, n.x - n.radius + 3, n.y - n.radius + 3, (n.radius - 3) * 2, (n.radius - 3) * 2);
        } else {
          drawInitials(ctx, n, levelAlpha);
        }
      } else {
        drawInitials(ctx, n, levelAlpha);
      }
      ctx.restore();

      // Name label
      const nameAlpha = Math.round(levelAlpha * (isHovered ? 255 : 200)).toString(16).padStart(2, "0");
      ctx.fillStyle = isHovered ? "#f8fafc" : `#cbd5e1${nameAlpha}`;
      ctx.font = `${isHovered ? "bold " : ""}${n.level > 2 ? "9" : "11"}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(n.label.split(" ").slice(0, 2).join(" "), n.x, n.y + n.radius + 14);

      if (n.company && n.level <= 2) {
        ctx.fillStyle = "#64748b";
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
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    ctx.fillStyle = statusColor + alphaHex;
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
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}