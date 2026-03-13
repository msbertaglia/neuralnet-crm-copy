import { useEffect, useRef, useCallback } from "react";

const STATUS_COLORS = {
  prospect:      "#f59e0b",
  desconhecidos: "#94a3b8",
  empresas:      "#3b82f6",
  familia:       "#ec4899",
  profissional:  "#22c55e",
  outros:        "#8b5cf6",
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

const BASE_ORBIT_RADII = [0, 220]; // nivel 0, 1 — N1 tem mínimo fixo; N2+ são 100% dinâmicos
const MAX_LEVEL = 20; // Allow up to 20 levels of hierarchy
const NODE_MIN_GAP = 35; // minimum pixel gap between node edges on same orbit

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

  // Build a map: contactId -> introducerId (direct parent)
  const parentOf = new Map();
  contacts.forEach(contact => {
   if (!contact.introduced_by_id || contact.introduced_by_id === "sem_informacao") {
     return; // Skip contacts with no introducer
   }

   let introducerId = contact.introduced_by_id;

   // If "direto", treat as directly linked to central contact
   if (contact.introduced_by_id === "direto") {
     introducerId = centralContactId;
   }

   parentOf.set(contact.id, introducerId);
  });

  // Build a map of introducer -> contacts they introduced
  const introducedMap = new Map();
  parentOf.forEach((parentId, contactId) => {
   if (!introducedMap.has(parentId)) {
     introducedMap.set(parentId, []);
   }
   introducedMap.get(parentId).push(contactId);
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

export default function NetworkGraph({ contacts, onNodeClick, onNodeDoubleClick, onSetCenter, centralContactId, originalCentralId, highlightedIds, ancestorIds, filterMode = "completo", layoutModel = "voronoi", orbitDistances = {} }) {
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
  const dragNearCenterRef = useRef(false); // true when dragged node is hovering over center

  const buildGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    // "direto" always means introduced by the original owner of the network, not the transient center
    const directOwnerId = originalCentralId || centralContactId;

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
       const pid = c.introduced_by_id === "direto" ? directOwnerId : c.introduced_by_id;
       parentOf.set(c.id, pid);
     });

     // Helper: get angle of a node relative to canvas center
     const getNodeAngle = (nodeId) => {
       const n = nodesRef.current.find(nd => nd.id === nodeId || nd.contactId === nodeId);
       if (!n) return -Math.PI / 2;
       return Math.atan2(n.y - H / 2, n.x - W / 2);
     };

     // Filter: only include contacts that are in the hierarchy (have a parent in levelMap)
      const hierarchyContacts = contacts.filter(c => levelMap.has(c.id));

      // Level 1..MAX_LEVEL nodes
      for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
        const group = hierarchyContacts.filter(c => levelMap.get(c.id) === lvl);
        if (group.length === 0) continue;

       const nRadius = lvl === 1 ? 26 : lvl === 2 ? 21 : 17;
       const baseR = BASE_ORBIT_RADII[lvl] ?? 0;
       // neededR: minimum orbit radius so that ALL nodes on this level don't overlap
       const neededR = minOrbitRadius(group.length, nRadius);
       const prevLvlNodes = nodes.filter(n => n.level === lvl - 1);
       const prevOrbitR = lvl === 1 ? 0 : (prevLvlNodes[0]?.orbitRadius || 0);
       const prevNodeRadius = lvl === 1 ? 40 : (prevLvlNodes[0]?.radius || nRadius);
       const BASE_INTER_GAP = orbitDistances[lvl] ?? 180;
       const minFromPrev = prevOrbitR + prevNodeRadius + nRadius + BASE_INTER_GAP;
       const hasCustomDistance = orbitDistances[lvl] !== undefined;
       // Always ensure neededR is respected so nodes never overlap
       const orbitR = hasCustomDistance ? Math.max(minFromPrev, neededR) : Math.max(baseR, neededR, minFromPrev);

       // Group children by parent (sorted by creation order)
       const byParent = new Map();
       group.forEach(c => {
         const pid = parentOf.get(c.id) || centralContactId;
         const nodeId = pid === centralContactId ? "__center__" : pid;
         if (!byParent.has(nodeId)) byParent.set(nodeId, []);
         byParent.get(nodeId).push(c);
       });

       const angleMap = new Map();

       const normalizeAngle = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

       // Sort parents by their angular position
       const parentEntries = [...byParent.entries()].map(([parentNodeId, children]) => {
         const parentNode = nodes.find(n => n.id === parentNodeId || n.contactId === parentNodeId);
         let angle = normalizeAngle(-Math.PI / 2);
         if (parentNode?.targetX !== undefined) {
           angle = normalizeAngle(Math.atan2(parentNode.targetY - H / 2, parentNode.targetX - W / 2));
         }
         return {
           children: [...children].sort((a, b) => contacts.indexOf(a) - contacts.indexOf(b)),
           angle
         };
       });
       parentEntries.sort((a, b) => a.angle - b.angle);

       const numParents = parentEntries.length;

       // Helper: spread children within [sectorStart, sectorEnd] with optional padding
       const spreadChildren = (children, sectorStart, sectorEnd, padding = 0.08) => {
         const size = sectorEnd - sectorStart;
         if (children.length === 1) {
           angleMap.set(children[0].id, sectorStart + size / 2);
         } else {
           const pad = size * padding;
           const spread = size - 2 * pad;
           const step = spread / (children.length - 1);
           children.forEach((c, i) => angleMap.set(c.id, sectorStart + pad + i * step));
         }
       };

       // actualOrbitR can be expanded by the 'padrao' layout to fit children in bisector sectors
       let actualOrbitR = orbitR;

       if (layoutModel === "voronoi") {
         // Órbitas concêntricas relativas ao centro, filhos em leque ao redor da direção do pai
         const minAngStep = (2 * nRadius + NODE_MIN_GAP) / actualOrbitR;

         if (numParents <= 1) {
           const fam = parentEntries[0];
           if (fam) {
             const soloParentId = [...byParent.keys()][0];
             const parentIsCenter = soloParentId === "__center__";
             const sorted = [...fam.children].sort((a, b) => contacts.indexOf(a) - contacts.indexOf(b));
             if (parentIsCenter) {
               const step = (2 * Math.PI) / sorted.length;
               sorted.forEach((c, ci) => angleMap.set(c.id, ci * step - Math.PI / 2));
             } else if (sorted.length === 1) {
               angleMap.set(sorted[0].id, fam.angle);
             } else {
               const parentOrbitR = nodes.find(n => n.level === lvl - 1)?.orbitRadius || 0;
               const geomCap = actualOrbitR > parentOrbitR && parentOrbitR > 0
                 ? Math.acos(Math.min(1, parentOrbitR / actualOrbitR)) : Math.PI * 0.40;
               const MAX_HALF = Math.min(Math.PI * 0.40, geomCap);
               const arc = (sorted.length - 1) * minAngStep;
               const halfArc = Math.min(arc / 2, MAX_HALF);
               const step = sorted.length > 1 ? (halfArc * 2) / (sorted.length - 1) : 0;
               sorted.forEach((c, ci) => angleMap.set(c.id, fam.angle - halfArc + ci * step));
             }
           }
         } else {
           parentEntries.forEach(({ children, angle }) => {
             const n = children.length;
             const sorted = [...children].sort((a, b) => contacts.indexOf(a) - contacts.indexOf(b));
             if (n === 1) {
               angleMap.set(sorted[0].id, angle);
             } else {
               const fanSpread = Math.max(minAngStep * (n - 1), Math.min(Math.PI * 0.9, n * 0.42));
               sorted.forEach((c, i) => {
                 const a = angle - fanSpread / 2 + (i / (n - 1)) * fanSpread;
                 angleMap.set(c.id, a);
               });
             }
           });
         }

       } else if (layoutModel === "proporcional") {
         const minAngStep = (2 * nRadius + NODE_MIN_GAP) / orbitR;

         if (numParents <= 1) {
           const fam = parentEntries[0];
           if (fam) {
             const soloParentId = [...byParent.keys()][0];
             const parentIsCenter = soloParentId === "__center__";
             const sorted = [...fam.children].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
             if (parentIsCenter) {
               const step = (2 * Math.PI) / sorted.length;
               sorted.forEach((c, ci) => angleMap.set(c.id, ci * step - Math.PI / 2));
             } else if (sorted.length === 1) {
               angleMap.set(sorted[0].id, fam.angle);
             } else {
               const parentOrbitR = nodes.find(n => n.level === lvl - 1)?.orbitRadius || 0;
               const geomCap = orbitR > parentOrbitR && parentOrbitR > 0
                 ? Math.acos(Math.min(1, parentOrbitR / orbitR)) : Math.PI * 0.40;
               const MAX_HALF = Math.min(Math.PI * 0.40, geomCap);
               const arc = (sorted.length - 1) * minAngStep;
               const halfArc = Math.min(arc / 2, MAX_HALF);
               const step = sorted.length > 1 ? (halfArc * 2) / (sorted.length - 1) : 0;
               sorted.forEach((c, ci) => angleMap.set(c.id, fam.angle - halfArc + ci * step));
             }
           }
         } else {
           // Proportional sectors — strict no-overlap, no-crossing, alphabetical order
           const total = parentEntries.reduce((s, p) => s + p.children.length, 0);
           const sectorSizes = parentEntries.map(p => (p.children.length / total) * 2 * Math.PI);
           let cursor = (parentEntries[0]?.angle ?? -Math.PI / 2) - sectorSizes[0] / 2;
           const sectorStarts = sectorSizes.map(s => { const c = cursor; cursor += s; return c; });

           parentEntries.forEach(({ children, angle }, i) => {
             const sorted = [...children].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
             const n = sorted.length;
             const sectorStart = sectorStarts[i];
             const sectorEnd = sectorStart + sectorSizes[i];
             if (n === 1) {
               const a = Math.max(sectorStart + minAngStep / 2, Math.min(sectorEnd - minAngStep / 2, angle));
               angleMap.set(sorted[0].id, a);
               return;
             }
             const neededArc = minAngStep * (n - 1);
             const halfPad = minAngStep * 0.5;
             let idealStart = angle - neededArc / 2;
             idealStart = Math.max(sectorStart + halfPad, Math.min(sectorEnd - halfPad - neededArc, idealStart));
             sorted.forEach((c, ci) => angleMap.set(c.id, idealStart + ci * minAngStep));
           });
         }

       } else if (layoutModel === "padrao") {
         // Zone-based layout: each parent owns a zone bounded by bisectors to its neighbors.
         // Children are placed WITHIN the parent's zone (clamped), so edges NEVER cross.
         // Uses pure linear arithmetic — no normalizeAngle on intermediate values.
         const STEP_PX = 2 * nRadius + NODE_MIN_GAP;
         const PAD_FRAC = 0.10; // padding fraction on each side of zone

         const familyData = parentEntries.map(({ children, angle }) => {
           const sorted = [...children].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
           return { sorted, angle, n: sorted.length };
         });

         if (numParents <= 1) {
           const fam = familyData[0];
           if (fam && fam.n > 0) {
             const soloParentId = [...byParent.keys()][0];
             const parentIsCenter = soloParentId === "__center__";

             if (parentIsCenter) {
               const step = (2 * Math.PI) / fam.n;
               fam.sorted.forEach((c, ci) => angleMap.set(c.id, ci * step - Math.PI / 2));
             } else if (fam.n === 1) {
               angleMap.set(fam.sorted[0].id, fam.angle);
             } else {
               // Fan outward from the parent node's direction
               const parentAngle = fam.angle;
               const STEP_PX_loc = 2 * nRadius + NODE_MIN_GAP;
               const parentOrbitR = nodes.find(n => n.level === lvl - 1)?.orbitRadius || 0;
               const geomCap = orbitR > parentOrbitR && parentOrbitR > 0
                 ? Math.acos(Math.min(1, parentOrbitR / orbitR))
                 : Math.PI * 0.40;
               const MAX_HALF = Math.min(Math.PI * 0.40, geomCap);
               const idealStep = STEP_PX_loc / orbitR;
               const arc = (fam.n - 1) * idealStep;
               const halfArc = Math.min(arc / 2, MAX_HALF);
               const step = fam.n > 1 ? (halfArc * 2) / (fam.n - 1) : 0;
               fam.sorted.forEach((c, ci) => angleMap.set(c.id, parentAngle - halfArc + ci * step));
             }
           }
         } else {
           // Compute angular gaps between consecutive parents (pure arithmetic, no normalizeAngle)
           // gaps[i] = gap from family[i] to family[(i+1)%n], always positive
           const gaps = familyData.map((fam, i) => {
             const next = familyData[(i + 1) % numParents];
             const diff = next.angle - fam.angle;
             return diff > 0 ? diff : diff + 2 * Math.PI;
           });

           // Expand orbit only if STEP_PX step would require it (no runaway expansion)
           // Max expansion: enough so that even the narrowest zone fits 1 step
           let computedR = orbitR;
           if (!hasCustomDistance) {
             for (let i = 0; i < numParents; i++) {
               const { n } = familyData[i];
               if (n <= 1) continue;
               // left zone half = gaps[(i-1+n)%n]/2, right zone half = gaps[i]/2
               const leftHalf = gaps[(i - 1 + numParents) % numParents] / 2;
               const rightHalf = gaps[i] / 2;
               const zoneArc = (leftHalf + rightHalf) * (1 - 2 * PAD_FRAC);
               if (zoneArc < 0.001) continue;
               // Required radius so children fit with ideal STEP_PX spacing
               const neededR = (n - 1) * STEP_PX / zoneArc;
               if (neededR > computedR) computedR = neededR;
             }
           }
           actualOrbitR = computedR;

           // Compute the parent's orbit radius (orbit of level lvl-1)
           const parentOrbitR = lvl === 1 ? 0 : (nodes.find(n => n.level === lvl - 1)?.orbitRadius || 0);

           familyData.forEach(({ sorted, angle, n }, i) => {
             if (n === 1) {
               angleMap.set(sorted[0].id, angle);
               return;
             }

             // Geometric cap: max angle so that the straight line from child (on actualOrbitR)
             // to parent (on parentOrbitR) never dips inside the parent orbit.
             // Using the inscribed-angle formula: acos(parentOrbitR / actualOrbitR), capped at PI*0.40
             const geomCap = actualOrbitR > parentOrbitR && parentOrbitR > 0
               ? Math.acos(Math.min(1, parentOrbitR / actualOrbitR))
               : Math.PI * 0.40;
             const MAX_HALF_ARC = Math.min(Math.PI * 0.40, geomCap);

             const leftHalf  = Math.min(gaps[(i - 1 + numParents) % numParents] / 2, MAX_HALF_ARC) * (1 - PAD_FRAC);
             const rightHalf = Math.min(gaps[i] / 2, MAX_HALF_ARC) * (1 - PAD_FRAC);
             const leftBound  = angle - leftHalf;
             const rightBound = angle + rightHalf;

             const idealStep = STEP_PX / actualOrbitR;
             const maxStep = (rightBound - leftBound) / Math.max(1, n - 1);
             const step = Math.min(idealStep, maxStep);
             const arc = (n - 1) * step;

             let start = angle - arc / 2;
             start = Math.max(leftBound, Math.min(rightBound - arc, start));

             sorted.forEach((c, ci) => angleMap.set(c.id, start + ci * step));
           });
         }

       } else if (layoutModel === "arvore") {
         // Narrow cone under parent — tree-like
         const coneAngle = Math.PI / 4; // 45° cone per family
         parentEntries.forEach(({ children, angle }) => {
           const half = (coneAngle * Math.min(children.length, 6)) / 2;
           spreadChildren(children, angle - half, angle + half, 0.05);
         });

       } else if (layoutModel === "espiral") {
           const STEP_PX = 2 * nRadius + NODE_MIN_GAP;

           if (lvl === 1 && numParents === 1) {
             // N1: distribute proportionally based on TOTAL subtree size (all descendants)
             // but enforce a minimum sector per node so no overlaps occur
             const subtreeSize = (rootId) => {
               let count = 0;
               const queue = [rootId];
               const visited = new Set([rootId]);
               while (queue.length) {
                 const cur = queue.shift();
                 hierarchyContacts.forEach(c => {
                   if (!visited.has(c.id) && parentOf.get(c.id) === cur) {
                     visited.add(c.id);
                     queue.push(c.id);
                     count++;
                   }
                 });
               }
               return count;
             };

             const n1Children = [...parentEntries[0].children].sort((a, b) => contacts.indexOf(a) - contacts.indexOf(b));
             const n = n1Children.length;
             // Minimum angular step to avoid overlap at this orbit
             const minAngStep = (2 * nRadius + NODE_MIN_GAP) / actualOrbitR;
             const minSector = minAngStep; // minimum sector per node
             const totalMinArc = minSector * n;
             const extraArc = Math.max(0, 2 * Math.PI - totalMinArc); // leftover arc to distribute by weight

             const weights = n1Children.map(c => Math.max(1, subtreeSize(c.id)));
             const totalWeight = weights.reduce((s, w) => s + w, 0);
             // Each node gets minSector + proportional share of extraArc
             const sectors = weights.map(w => minSector + (w / totalWeight) * extraArc);

             let cursor = -Math.PI / 2;
             n1Children.forEach((c, i) => {
               angleMap.set(c.id, cursor + sectors[i] / 2);
               cursor += sectors[i];
             });

           } else if (numParents <= 1) {
             // Single non-center parent: fan outward from parent direction
             const fam = parentEntries[0];
             if (fam) {
               const soloParentId = [...byParent.keys()][0];
               const parentIsCenter = soloParentId === "__center__";
               const sorted = [...fam.children].sort((a, b) => contacts.indexOf(a) - contacts.indexOf(b));
               if (parentIsCenter) {
                 const step = (2 * Math.PI) / sorted.length;
                 sorted.forEach((c, ci) => angleMap.set(c.id, ci * step - Math.PI / 2));
               } else if (sorted.length === 1) {
                 angleMap.set(sorted[0].id, fam.angle);
               } else {
                 const parentOrbitR = nodes.find(n => n.level === lvl - 1)?.orbitRadius || 0;
                 const geomCap = orbitR > parentOrbitR && parentOrbitR > 0
                   ? Math.acos(Math.min(1, parentOrbitR / orbitR)) : Math.PI * 0.40;
                 const MAX_HALF = Math.min(Math.PI * 0.40, geomCap);
                 const minAngStep = STEP_PX / orbitR;
                 const arc = (sorted.length - 1) * minAngStep;
                 const halfArc = Math.min(arc / 2, MAX_HALF);
                 const step = sorted.length > 1 ? (halfArc * 2) / (sorted.length - 1) : 0;
                 sorted.forEach((c, ci) => angleMap.set(c.id, fam.angle - halfArc + ci * step));
               }
             }
           } else {
             // N2+: asymmetric fan around parent direction (multiple parents)
             const familyData = parentEntries.map(({ children, angle }) => {
               const n = children.length;
               const arcPx = n <= 1 ? 0 : (n - 1) * STEP_PX;
               return { children, angle, n, rightPx: arcPx * 0.7, leftPx: arcPx * 0.3 };
             });

             let computedR = orbitR;
             if (!hasCustomDistance) {
               for (let i = 0; i < numParents; i++) {
                 const j = (i + 1) % numParents;
                 const angGap = normalizeAngle(familyData[j].angle - familyData[i].angle);
                 if (angGap < 0.0001) continue;
                 const needed = (familyData[i].rightPx + familyData[j].leftPx + NODE_MIN_GAP) / angGap;
                 if (needed > computedR) computedR = needed;
               }
             }
             actualOrbitR = computedR;

             const minAngStep = STEP_PX / actualOrbitR;
             familyData.forEach(({ children, angle, n }) => {
               if (n === 1) { angleMap.set(children[0].id, angle); return; }
               const startAngle = angle - (n - 1) * minAngStep * 0.3;
               children.forEach((c, ci) => angleMap.set(c.id, startAngle + ci * minAngStep));
             });
           }
           }

       // ── Post-process: enforce minimum angular gap so no nodes overlap ──
       // Sort all placed nodes by angle, then push apart any that are too close.
       {
         const minGap = (2 * nRadius + NODE_MIN_GAP) / actualOrbitR;
         const placed = [...angleMap.entries()].sort((a, b) => a[1] - b[1]);
         if (placed.length > 1) {
           // Iterative relaxation (2 passes is enough for most cases)
           for (let pass = 0; pass < 3; pass++) {
             for (let i = 0; i < placed.length; i++) {
               const next = placed[(i + 1) % placed.length];
               let diff = next[1] - placed[i][1];
               // Handle wrap-around for the last→first pair
               if (i === placed.length - 1) diff += 2 * Math.PI;
               if (diff < minGap) {
                 const push = (minGap - diff) / 2;
                 placed[i][1] -= push;
                 next[1] += push;
               }
             }
           }
           placed.forEach(([id, angle]) => angleMap.set(id, angle));
         }
       }

       // Place nodes using computed angles
       group.forEach(c => {
         const angle = angleMap.get(c.id) ?? -Math.PI / 2;
         const x = W / 2 + actualOrbitR * Math.cos(angle);
         const y = H / 2 + actualOrbitR * Math.sin(angle);
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
           orbitRadius: actualOrbitR,
           targetX: x,
           targetY: y,
           contact: c,
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

      // If "direto", draw edge from original owner (not transient center)
       if (contact.introduced_by_id === "direto") {
         introducerId = directOwnerId;
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
    }, [contacts, centralContactId, originalCentralId, layoutModel, orbitDistances]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;
    const W = canvas.width;
    const H = canvas.height;
    const DAMPING = 0.75;

    const centerNode = nodes.find(n => n.isCenter);

    nodes.forEach(n => {
      // Center node: always snap to canvas center
      if (n.isCenter) {
        n.vx += (W / 2 - n.x) * 0.12;
        n.vy += (H / 2 - n.y) * 0.12;
        if (dragRef.current?.id !== n.id) {
          n.vx *= DAMPING;
          n.vy *= DAMPING;
          n.x += n.vx;
          n.y += n.vy;
        }
        return;
      }

      // Skip physics for node being dragged
      if (dragRef.current?.id === n.id) return;

      // If returning from drag: animate smoothly back to target
      if (n.returning && n.targetX !== undefined) {
        const dtx = n.targetX - n.x;
        const dty = n.targetY - n.y;
        const dist = Math.sqrt(dtx * dtx + dty * dty);
        n.x += dtx * 0.08;
        n.y += dty * 0.08;
        if (dist < 1.5) {
          n.x = n.targetX;
          n.y = n.targetY;
          n.returning = false;
        }
        return;
      }

      // Normal mode: hard-lock to target position (no drift allowed)
      if (n.targetX !== undefined && n.targetY !== undefined) {
        n.x = n.targetX;
        n.y = n.targetY;
        n.vx = 0;
        n.vy = 0;
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

    // Determine node render state
    // "highlight" = matches filter (full color)
    // "ancestor"  = parent of a match (visible grey)
    // "ghost"     = everything else when filters active
    const getNodeState = (nodeContactId) => {
      if (!highlightedIds) return "highlight";
      if (!nodeContactId) return "highlight";
      if (highlightedIds.has(nodeContactId)) return "highlight";
      if (ancestorIds && ancestorIds.has(nodeContactId)) return "ancestor";
      return "ghost";
    };

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    const centerNode = nodesRef.current.find(n => n.isCenter);

    // Orbit rings - use actual computed orbit radii from nodes
    if (centerNode) {
      const ringOpacity = [0, 0.55, 0.45, 0.38, 0.30, 0.24];
      const levelsPresent = [...new Set(nodesRef.current.filter(n => !n.isCenter && n.orbitRadius).map(n => n.level))].sort((a,b)=>a-b);
      for (const lvl of levelsPresent) {
        const sample = nodesRef.current.find(n => n.level === lvl);
        const r = sample?.orbitRadius || (BASE_ORBIT_RADII[lvl] || lvl * 180);
        ctx.beginPath();
        ctx.arc(centerNode.x, centerNode.y, r, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(220,38,38,${ringOpacity[Math.min(lvl, ringOpacity.length - 1)] || 0.16})`;
        ctx.lineWidth = 2.5;
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

      // Edge visibility based on node states
      const srcState = getNodeState(src.contactId);
      const tgtState = getNodeState(tgt.contactId);

      // In parcial mode: only draw edges between two highlighted nodes
      if (filterMode === "parcial" && (srcState !== "highlight" || tgtState !== "highlight")) return;

      const edgeFade = (srcState === "ghost" || tgtState === "ghost" || srcState === "ancestor" || tgtState === "ancestor") ? 0.25 : 1;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (e.isIntroduced) {
        ctx.strokeStyle = `rgba(148,163,184,${s.opacity * 0.7 * edgeFade})`;
        ctx.lineWidth = s.width * 0.8;
        ctx.setLineDash([4, 6]);
      } else if (isCenterEdge) {
        ctx.strokeStyle = `rgba(99,102,241,${s.opacity * edgeFade})`;
        ctx.lineWidth = s.width + 0.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = `rgba(148,163,184,${s.opacity * edgeFade})`;
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
      const nodeState = n.isCenter ? "highlight" : getNodeState(n.contactId);

      // Parcial mode: skip ghost and ancestor nodes
      if (filterMode === "parcial" && (nodeState === "ghost" || nodeState === "ancestor")) return;

      // Ghost and ancestor nodes in completo mode: grey style
      if (nodeState === "ghost" || nodeState === "ancestor") {
        ctx.globalAlpha = nodeState === "ancestor" ? 0.55 : 0.25;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const initials = n.label.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        ctx.fillStyle = "#94a3b8";
        ctx.font = `bold ${Math.round(n.radius * 0.52)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, n.x, n.y);
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#64748b";
        ctx.font = `${n.level >= 3 ? "9" : n.level === 2 ? "10" : "11"}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.label.split(" ").slice(0, 2).join(" "), n.x, n.y + n.radius + 14);
        ctx.globalAlpha = 1;
        return;
      }

      if (n.isCenter) {
        // If a node is being dragged near the center, show a "drop here" indicator
        if (dragNearCenterRef.current) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 18, 0, 2 * Math.PI);
          ctx.strokeStyle = "rgba(34,197,94,0.8)";
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(34,197,94,0.12)";
          ctx.fill();
        }

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
  }, [highlightedIds]);

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
         // Check if dragged node is near center (within center node radius * 2)
         const centerNode = nodesRef.current.find(n => n.isCenter);
         if (centerNode && !dragRef.current.isCenter) {
           const dx = dragRef.current.x - centerNode.x;
           const dy = dragRef.current.y - centerNode.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           dragNearCenterRef.current = dist < centerNode.radius * 2.5;
         }
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
           // Was dragged - check if dropped on center
           if (dragNearCenterRef.current && !node.isCenter && onSetCenter) {
             onSetCenter(node.contact);
             dragNearCenterRef.current = false;
           } else {
             // Return to orbit
             dragNearCenterRef.current = false;
             returnTimerRef.current = setTimeout(() => {
               returnTimerRef.current = null;
               node.returning = true;
             }, 1000);
           }
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

    // Touch support
    let lastTouchDist = null;
    let lastTouchMid = null;
    let touchStartTime = 0;
    let touchStartPos = null;
    let touchMoved = false;
    let lastTapTime = 0;

    const getTouchDist = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchMid = (t1, t2) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onTouchStart = (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartTime = Date.now();
        touchStartPos = { x: t.clientX, y: t.clientY };
        touchMoved = false;
        const node = getNodeAtPos(t.clientX, t.clientY);
        if (node) {
          dragRef.current = node;
          dragMovedRef.current = false;
          if (returnTimerRef.current) { clearTimeout(returnTimerRef.current); returnTimerRef.current = null; }
          node.returning = false;
        } else {
          isPanningRef.current = true;
          panStartRef.current = { x: t.clientX - transformRef.current.x, y: t.clientY - transformRef.current.y };
        }
        lastTouchDist = null;
        lastTouchMid = null;
      } else if (e.touches.length === 2) {
        dragRef.current = null;
        isPanningRef.current = false;
        lastTouchDist = getTouchDist(e.touches[0], e.touches[1]);
        lastTouchMid = getTouchMid(e.touches[0], e.touches[1]);
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const mid = getTouchMid(e.touches[0], e.touches[1]);
        if (lastTouchDist !== null) {
          const scaleFactor = dist / lastTouchDist;
          const rect = canvas.getBoundingClientRect();
          const mx = mid.x - rect.left;
          const my = mid.y - rect.top;
          const { x: tx, y: ty, scale } = transformRef.current;
          const newScale = Math.min(3, Math.max(0.2, scale * scaleFactor));
          transformRef.current = {
            x: mx - (mx - tx) * (newScale / scale),
            y: my - (my - ty) * (newScale / scale),
            scale: newScale,
          };
        }
        lastTouchDist = dist;
        lastTouchMid = mid;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        if (touchStartPos) {
          const dx = Math.abs(t.clientX - touchStartPos.x);
          const dy = Math.abs(t.clientY - touchStartPos.y);
          if (dx > 5 || dy > 5) touchMoved = true;
        }
        if (dragRef.current) {
          dragMovedRef.current = true;
          const rect = canvas.getBoundingClientRect();
          const { x: tx, y: ty, scale } = transformRef.current;
          dragRef.current.x = (t.clientX - rect.left - tx) / scale;
          dragRef.current.y = (t.clientY - rect.top - ty) / scale;
          dragRef.current.vx = 0;
          dragRef.current.vy = 0;
          const centerNode = nodesRef.current.find(n => n.isCenter);
          if (centerNode && !dragRef.current.isCenter) {
            const ddx = dragRef.current.x - centerNode.x;
            const ddy = dragRef.current.y - centerNode.y;
            dragNearCenterRef.current = Math.sqrt(ddx * ddx + ddy * ddy) < centerNode.radius * 2.5;
          }
        } else if (isPanningRef.current && panStartRef.current) {
          transformRef.current.x = t.clientX - panStartRef.current.x;
          transformRef.current.y = t.clientY - panStartRef.current.y;
        }
      }
    };

    const onTouchEnd = (e) => {
      e.preventDefault();
      lastTouchDist = null;
      lastTouchMid = null;
      if (e.touches.length === 0) {
        if (dragRef.current) {
          const node = dragRef.current;
          const moved = dragMovedRef.current;
          dragRef.current = null;
          dragMovedRef.current = false;
          if (!moved) {
            const now = Date.now();
            if (now - lastTapTime < 350) {
              lastTapTime = 0;
              if (onNodeDoubleClick) onNodeDoubleClick(node.contact);
              else if (onNodeClick && !node.isCenter) onNodeClick(node.contact);
            } else {
              lastTapTime = now;
              setTimeout(() => {
                if (lastTapTime !== 0 && Date.now() - lastTapTime >= 300) {
                  if (onNodeClick && !node.isCenter) onNodeClick(node.contact);
                  lastTapTime = 0;
                }
              }, 350);
            }
          } else {
            if (dragNearCenterRef.current && !node.isCenter && onSetCenter) {
              onSetCenter(node.contact);
              dragNearCenterRef.current = false;
            } else {
              dragNearCenterRef.current = false;
              returnTimerRef.current = setTimeout(() => { returnTimerRef.current = null; node.returning = true; }, 1000);
            }
          }
        }
        isPanningRef.current = false;
        panStartRef.current = null;
      } else if (e.touches.length === 1) {
        // Went from 2 fingers to 1: restart pan
        const t = e.touches[0];
        isPanningRef.current = true;
        panStartRef.current = { x: t.clientX - transformRef.current.x, y: t.clientY - transformRef.current.y };
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [onNodeClick, onNodeDoubleClick]);

  return (
    <canvas ref={canvasRef} className="w-full h-full" style={{ background: "transparent" }} />
  );
}