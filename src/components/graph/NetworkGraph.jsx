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

const BASE_ORBIT_RADII = [0, 200, 370, 540, 700, 850]; // nivel 0, 1, 2, 3, 4, 5 (mínimos base)
const MAX_LEVEL = 20; // Allow up to 20 levels of hierarchy
const NODE_MIN_GAP = 18; // minimum pixel gap between node edges on same orbit

/**
 * Compute the minimum orbit radius for a given level so that
 * `count` nodes of `nodeRadius` each don't overlap.
 * Circumference needed = count * (2*nodeRadius + gap)
 * radius = circumference / (2 * PI)
 */
function minOrbitRadius(count, nodeRadius, gap = NODE_MIN_GAP) {
  if (count <= 1) return 0;
  return (count * (2 * nodeRadius + gap)) / (2 * Math.PI);
}

/**
 * Compute orbital levels based on "introduced_by_id" field:
 * - Central contact (Mauro) is level 0
 * - Contacts with introduced_by_id = central are level 1 (N1)
 * - Contacts with introduced_by_id = someone at level 1 are level 2 (N2)
 * - And so on... (N3, N4, N5, ... Nx)
 * 
 * Special cases:
 * - introduced_by_id = "direto" → level 1 (direct, without intermediary)
 * - introduced_by_id = "sem_informacao" → not included in graph
 */
function computeOrbits(centralContactId, contacts) {
  const levels = new Map();
  if (!centralContactId) return levels;

  levels.set(centralContactId, 0);

  // Build a map of introducer -> contacts they introduced
  const introducedMap = new Map();
  contacts.forEach(contact => {
    if (!contact.introduced_by_id || contact.introduced_by_id === "sem_informacao") {
      return; // Skip contacts with no introducer or empty introducer
    }
    
    let introducerId = contact.introduced_by_id;
    
    // If "direto", treat as directly linked to central contact
    if (contact.introduced_by_id === "direto") {
      introducerId = centralContactId;
    }
    
    if (!introducedMap.has(introducerId)) {
      introducedMap.set(introducerId, []);
    }
    introducedMap.get(introducerId).push(contact.id);
  });

  // BFS to assign levels based on introducer hierarchy
  const queue = [centralContactId];
  const visited = new Set([centralContactId]);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentLevel = levels.get(current);
    
    // Get all contacts introduced by current contact
    const introduced = introducedMap.get(current) || [];
    introduced.forEach(contactId => {
      if (!visited.has(contactId) && currentLevel < MAX_LEVEL) {
        levels.set(contactId, currentLevel + 1);
        visited.add(contactId);
        queue.push(contactId);
      }
    });
  }

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
  const dragMovedRef = useRef(false); // track if mouse actually moved while dragging
  const returnTimerRef = useRef(null); // timer before snapping back

  const buildGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    const levelMap = computeOrbits(centralContactId, contacts);
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

    // Build parent lookup: contactId -> parentId
     const parentOf = new Map();
     contacts.forEach(c => {
       if (!c.introduced_by_id || c.introduced_by_id === "sem_informacao") return;
       const pid = c.introduced_by_id === "direto" ? centralContactId : c.introduced_by_id;
       parentOf.set(c.id, pid);
     });

     // Helper: get angle of a node relative to canvas center
     const getNodeAngle = (nodeId) => {
       const n = nodesRef.current.find(nd => nd.id === nodeId || nd.contactId === nodeId);
       if (!n) return -Math.PI / 2;
       return Math.atan2(n.y - H / 2, n.x - W / 2);
     };

     // Level 1..MAX_LEVEL nodes
     // Group children by parent so we can spread them around parent's angle
     for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
       const group = contacts.filter(c => levelMap.get(c.id) === lvl);
       if (group.length === 0) continue;

       // Node radius for this level
       const nRadius = lvl === 1 ? 26 : lvl === 2 ? 21 : 17;
       // Base orbit radius (minimum preset)
       const baseR = BASE_ORBIT_RADII[lvl] || lvl * 180;
       // Minimum radius needed to avoid overlap
       const neededR = minOrbitRadius(group.length, nRadius);
       // Previous level's orbit radius (to avoid nesting inside inner orbit)
       const prevOrbitR = lvl === 1 ? 0 : (nodes.find(n => n.level === lvl - 1)?.orbitRadius || (BASE_ORBIT_RADII[lvl - 1] || (lvl - 1) * 180));
       const minFromPrev = prevOrbitR + nRadius * 2 + 40;
       const orbitR = Math.max(baseR, neededR, minFromPrev);

       // Group by parent
       const byParent = new Map();
       group.forEach(c => {
         const pid = parentOf.get(c.id) || "__center__";
         if (!byParent.has(pid)) byParent.set(pid, []);
         byParent.get(pid).push(c);
       });

       byParent.forEach((children, pid) => {
         const parentAngle = getNodeAngle(pid === centralContactId ? "__center__" : pid);
         const spread = Math.min(Math.PI * 0.8, (2 * Math.PI) / (group.length || 1) * children.length);
         children.forEach((c, i) => {
           const offset = children.length === 1 ? 0 : (i / (children.length - 1) - 0.5) * spread;
           const angle = parentAngle + offset;
           const x = W / 2 + orbitR * Math.cos(angle);
           const y = H / 2 + orbitR * Math.sin(angle);
           // Only reuse existing position if same level (avoid keeping wrong-orbit positions)
           const existing = nodesRef.current.find(n => n.id === c.id && n.level === lvl);
           nodes.push({
             id: c.id,
             contactId: c.id,
             label: c.nickname || c.name,
             company: c.company || "",
             status: c.status || "prospect",
             nextStepStatus: c.next_step_status || "sem_proximo_passo",
             photoUrl: c.photo_url || null,
             x: existing ? existing.x : x,
             y: existing ? existing.y : y,
             vx: 0, vy: 0,
             radius: nRadius,
             level: lvl,
             orbitRadius: orbitR,
             targetX: x,
             targetY: y,
             contact: c,
           });
         });
       });
     }

    const visibleIds = new Set(nodes.map(n => n.contactId || n.id));
    const edges = [];
    const addedEdges = new Set();

    // Create edges based on introduced_by_id hierarchy
    contacts.forEach(contact => {
      if (!contact.introduced_by_id || contact.introduced_by_id === "sem_informacao") {
        return; // Skip contacts with no introducer
      }

      let introducerId = contact.introduced_by_id;
      
      // If "direto", draw edge from center
      if (contact.introduced_by_id === "direto") {
        introducerId = centralContactId;
      }

      if (!visibleIds.has(introducerId) || !visibleIds.has(contact.id)) {
        return;
      }

      const srcNodeId = introducerId === centralContactId ? "__center__" : introducerId;
      const tgtNodeId = contact.id;
      const key = [srcNodeId, tgtNodeId].sort().join("|");
      
      if (!addedEdges.has(key)) {
        addedEdges.add(key);
        edges.push({
          id: `intro-${contact.id}`,
          sourceId: srcNodeId,
          targetId: tgtNodeId,
          strength: "media",
          type: "hierarquica",
          isCenterEdge: srcNodeId === "__center__",
          isIntroduced: true,
        });
      }
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [contacts, centralContactId]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;
    const W = canvas.width;
    const H = canvas.height;
    const REPULSION = 4500;
    const ORBIT_STRENGTH = 0.08; // Stronger to keep on orbit
    const TARGET_STRENGTH = 0.05; // Pull towards target position
    const DAMPING = 0.80;

    const centerNode = nodes.find(n => n.isCenter);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.isCenter) {
        n.vx += (W / 2 - n.x) * 0.12;
        n.vy += (H / 2 - n.y) * 0.12;
        continue;
      }

      // Pull towards target position on orbit (slow return after drag)
      if (n.returning && n.targetX !== undefined && n.targetY !== undefined) {
        const dtx = n.targetX - n.x;
        const dty = n.targetY - n.y;
        const distToTarget = Math.sqrt(dtx * dtx + dty * dty);
        n.vx += dtx * TARGET_STRENGTH * 0.4; // slow return speed
        n.vy += dty * TARGET_STRENGTH * 0.4;
        if (distToTarget < 2) n.returning = false;
      } else if (!n.returning && n.targetX !== undefined && n.targetY !== undefined) {
        const dtx = n.targetX - n.x;
        const dty = n.targetY - n.y;
        n.vx += dtx * TARGET_STRENGTH;
        n.vy += dty * TARGET_STRENGTH;
      }

      // Orbit radius maintenance
      if (centerNode) {
        const dcx = n.x - centerNode.x;
        const dcy = n.y - centerNode.y;
        const dist = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
        const err = dist - n.orbitRadius;
        const force = err * ORBIT_STRENGTH;
        n.vx -= (dcx / dist) * force;
        n.vy -= (dcy / dist) * force;
      }

      // Repulsion (softer)
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const dx = m.x - n.x;
        const dy = m.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const sameLevel = n.level === m.level;
        const force = (REPULSION * (sameLevel ? 1.2 : 0.8)) / (dist * dist);
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

      // Hard-constrain non-center nodes to their orbit radius (skip while returning, orbit force handles it)
      if (!n.isCenter && !n.returning && centerNode && n.orbitRadius) {
        const dcx = n.x - centerNode.x;
        const dcy = n.y - centerNode.y;
        const dist = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
        // Snap radial distance to orbitRadius
        n.x = centerNode.x + (dcx / dist) * n.orbitRadius;
        n.y = centerNode.y + (dcy / dist) * n.orbitRadius;
        // Remove radial velocity component
        const radialVel = n.vx * (dcx / dist) + n.vy * (dcy / dist);
        n.vx -= radialVel * (dcx / dist);
        n.vy -= radialVel * (dcy / dist);
      } else {
        n.x = Math.max(n.radius + 4, Math.min(W - n.radius - 4, n.x));
        n.y = Math.max(n.radius + 4, Math.min(H - n.radius - 4, n.y));
      }
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

    // Orbit rings - use actual computed orbit radii from nodes
    if (centerNode) {
      const ringOpacity = [0, 0.15, 0.12, 0.10, 0.08, 0.06];
      const levelsPresent = [...new Set(nodesRef.current.filter(n => !n.isCenter && n.orbitRadius).map(n => n.level))].sort((a,b)=>a-b);
      for (const lvl of levelsPresent) {
        const sample = nodesRef.current.find(n => n.level === lvl);
        const r = sample?.orbitRadius || (BASE_ORBIT_RADII[lvl] || lvl * 180);
        ctx.beginPath();
        ctx.arc(centerNode.x, centerNode.y, r, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(99,102,241,${ringOpacity[Math.min(lvl, ringOpacity.length - 1)] || 0.03})`;
        ctx.lineWidth = 0.6; // Very thin line
        ctx.stroke();
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
     let lastClickTime = 0;

     const onMouseDown = (e) => {
       const node = getNodeAtPos(e.clientX, e.clientY);
       if (node) {
         dragRef.current = node;
         dragMovedRef.current = false;
         // Cancel any pending return
         if (returnTimerRef.current) {
           clearTimeout(returnTimerRef.current);
           returnTimerRef.current = null;
         }
         node.returning = false;
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
         dragMovedRef.current = true;
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
         const moved = dragMovedRef.current;
         dragRef.current = null;
         dragMovedRef.current = false;

         if (!moved) {
           // It was a click - check for double click
           const now = Date.now();
           if (now - lastClickTime < 350) {
             // Double click → open ficha
             lastClickTime = 0;
             if (onNodeDoubleClick) onNodeDoubleClick(node.contact);
             else if (onNodeClick && !node.isCenter) onNodeClick(node.contact);
           } else {
             lastClickTime = now;
           }
         } else {
           // Was dragged - wait 1s then return to orbit
           returnTimerRef.current = setTimeout(() => {
             returnTimerRef.current = null;
             node.returning = true;
           }, 1000);
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