const SVG_NS = 'http://www.w3.org/2000/svg';

// Cardinal direction unit vectors (SVG coords: y increases downward)
const DIRECTION_VECTORS = {
    north: [0, -1],
    south: [0, 1],
    east: [1, 0],
    west: [-1, 0],
    northeast: [0.707, -0.707],
    northwest: [-0.707, -0.707],
    southeast: [0.707, 0.707],
    southwest: [-0.707, 0.707],
    // up/down/in/out: no positional bias (rendered as dashed lines instead)
};

// Abbreviated direction labels for edge display
function abbreviateDirection(label) {
    const abbr = {
        north: 'N',
        south: 'S',
        east: 'E',
        west: 'W',
        northeast: 'NE',
        northwest: 'NW',
        southeast: 'SE',
        southwest: 'SW',
        up: '\u2191',
        down: '\u2193',
        in: 'in',
        out: 'out',
    };
    return abbr[label?.toLowerCase()] ?? label ?? '';
}

// ── ForceLayout ──────────────────────────────────────────────────────────────

export class ForceLayout {
    constructor(nodes, edges, options = {}) {
        this.nodes = nodes; // [{ id, x, y }]
        this.edges = edges; // [{ source, target }]
        this.repulsion = options.repulsion ?? 5000;
        this.springLength = options.springLength ?? 150;
        this.springStiffness = options.springStiffness ?? 0.05;
        this.damping = options.damping ?? 0.9;
        this.iterations = options.iterations ?? 150;
        this.gravity = options.gravity ?? 0.01;
        this.directionalStrength = options.directionalStrength ?? 0.03;
        this.directionalEdges = options.directionalEdges ?? []; // [{ source, target, direction }]
    }

    run() {
        if (this.nodes.length === 0) {
            return {};
        }

        // Build working copies with velocity
        const state = this.nodes.map((n) => ({
            id: n.id,
            x: n.x,
            y: n.y,
            vx: 0,
            vy: 0,
        }));
        const idIndex = {};
        state.forEach((n, i) => {
            idIndex[n.id] = i;
        });

        for (let iter = 0; iter < this.iterations; iter++) {
            // Reset forces
            const forces = state.map(() => ({ fx: 0, fy: 0 }));

            // Repulsion (all pairs)
            for (let i = 0; i < state.length; i++) {
                for (let j = i + 1; j < state.length; j++) {
                    let dx = state[j].x - state[i].x;
                    let dy = state[j].y - state[i].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1) {
                        // Avoid zero-distance: nudge deterministically
                        dx = 1;
                        dy = 0;
                        dist = 1;
                    }
                    const force = this.repulsion / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    forces[i].fx -= fx;
                    forces[i].fy -= fy;
                    forces[j].fx += fx;
                    forces[j].fy += fy;
                }
            }

            // Spring attraction (along edges)
            for (const edge of this.edges) {
                const si = idIndex[edge.source];
                const ti = idIndex[edge.target];
                if (si === undefined || ti === undefined) {
                    continue;
                }
                const dx = state[ti].x - state[si].x;
                const dy = state[ti].y - state[si].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const displacement = dist - this.springLength;
                const force = this.springStiffness * displacement;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                forces[si].fx += fx;
                forces[si].fy += fy;
                forces[ti].fx -= fx;
                forces[ti].fy -= fy;
            }

            // Directional bias (north-up alignment)
            for (const de of this.directionalEdges) {
                const vec = DIRECTION_VECTORS[de.direction?.toLowerCase()];
                if (!vec) {
                    continue; // up/down/in/out: no positional bias
                }
                const si = idIndex[de.source];
                const ti = idIndex[de.target];
                if (si === undefined || ti === undefined) {
                    continue;
                }
                const prefDx = vec[0] * this.springLength;
                const prefDy = vec[1] * this.springLength;
                const actualDx = state[ti].x - state[si].x;
                const actualDy = state[ti].y - state[si].y;
                const biasFx = (prefDx - actualDx) * this.directionalStrength;
                const biasFy = (prefDy - actualDy) * this.directionalStrength;
                forces[si].fx -= biasFx;
                forces[si].fy -= biasFy;
                forces[ti].fx += biasFx;
                forces[ti].fy += biasFy;
            }

            // Gravity toward centroid
            if (state.length > 1) {
                let cx = 0;
                let cy = 0;
                for (const n of state) {
                    cx += n.x;
                    cy += n.y;
                }
                cx /= state.length;
                cy /= state.length;
                for (let i = 0; i < state.length; i++) {
                    forces[i].fx += (cx - state[i].x) * this.gravity;
                    forces[i].fy += (cy - state[i].y) * this.gravity;
                }
            }

            // Apply forces with damping
            for (let i = 0; i < state.length; i++) {
                state[i].vx = (state[i].vx + forces[i].fx) * this.damping;
                state[i].vy = (state[i].vy + forces[i].fy) * this.damping;
                state[i].x += state[i].vx;
                state[i].y += state[i].vy;
            }
        }

        // Return position map
        const positions = {};
        for (const n of state) {
            positions[n.id] = { x: n.x, y: n.y };
        }
        return positions;
    }

    /**
     * Create initial grid positions for a set of room names.
     * Deterministic: rooms placed in grid order, 150px spacing.
     */
    static gridPositions(roomNames, spacing = 150) {
        const cols = Math.ceil(Math.sqrt(roomNames.length)) || 1;
        return roomNames.map((name, i) => ({
            id: name,
            x: (i % cols) * spacing,
            y: Math.floor(i / cols) * spacing,
        }));
    }
}

// ── SVGMapRenderer ───────────────────────────────────────────────────────────

export class SVGMapRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.onRoomClick = options.onRoomClick || (() => {});
        this.svg = null;
        this.viewport = null;
        this.tooltip = null;
        this.transform = { x: 0, y: 0, scale: 1 };
        this._isPanning = false;
        this._panStart = null;
        this._hasRendered = false;

        // Bound handlers for cleanup
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onWheel = this._onWheel.bind(this);

        this._createSVG();
    }

    _createSVG() {
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'map-svg');
        this.svg.setAttribute('role', 'img');
        this.svg.setAttribute('aria-label', 'Visual map of discovered rooms');

        // Defs: arrowhead markers
        const defs = document.createElementNS(SVG_NS, 'defs');

        const marker = document.createElementNS(SVG_NS, 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('orient', 'auto-start-reverse');
        const arrowPath = document.createElementNS(SVG_NS, 'path');
        arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrowPath.setAttribute('fill', '#4a627a');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);

        // Second marker for bidirectional reverse end
        const markerRev = document.createElementNS(SVG_NS, 'marker');
        markerRev.setAttribute('id', 'arrowhead-start');
        markerRev.setAttribute('viewBox', '0 0 10 10');
        markerRev.setAttribute('refX', '0');
        markerRev.setAttribute('refY', '5');
        markerRev.setAttribute('markerWidth', '8');
        markerRev.setAttribute('markerHeight', '8');
        markerRev.setAttribute('orient', 'auto-start-reverse');
        const arrowPathRev = document.createElementNS(SVG_NS, 'path');
        arrowPathRev.setAttribute('d', 'M 10 0 L 0 5 L 10 10 z');
        arrowPathRev.setAttribute('fill', '#4a627a');
        markerRev.appendChild(arrowPathRev);
        defs.appendChild(markerRev);

        this.svg.appendChild(defs);

        this.viewport = document.createElementNS(SVG_NS, 'g');
        this.viewport.setAttribute('class', 'map-viewport');
        this.svg.appendChild(this.viewport);

        this._setupPanZoom();
        this.container.appendChild(this.svg);
    }

    render(mapData, currentRoom) {
        // Clear viewport
        while (this.viewport.firstChild) {
            this.viewport.removeChild(this.viewport.firstChild);
        }
        this._dismissTooltip();

        const rooms = mapData.rooms || {};
        const connections = mapData.connections || [];
        const roomNames = Object.keys(rooms);

        if (roomNames.length === 0) {
            this._renderEmpty();
            return;
        }

        // Build layout
        const nodes = ForceLayout.gridPositions(roomNames);
        const edges = this._deduplicateEdges(connections);
        const directionalEdges = edges.map((e) => ({
            source: e.from,
            target: e.to,
            direction: e.label,
        }));
        const layout = new ForceLayout(
            nodes,
            edges.map((e) => ({ source: e.from, target: e.to })),
            {
                directionalEdges,
            }
        );
        const positions = layout.run();

        // Draw edges first (so they appear behind nodes)
        for (const edge of edges) {
            this._drawEdge(positions, edge, rooms);
        }

        // Draw nodes
        for (const name of roomNames) {
            const pos = positions[name];
            if (!pos) {
                continue;
            }
            this._drawNode(name, pos, name === currentRoom, rooms[name]);
        }

        // Fit view on first render only
        if (!this._hasRendered) {
            this._fitToView(positions);
            this._hasRendered = true;
        }
    }

    _renderEmpty() {
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', '50%');
        text.setAttribute('y', '50%');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('class', 'map-label');
        text.textContent = 'No rooms discovered yet';
        this.viewport.appendChild(text);
    }

    /**
     * Deduplicate bidirectional connections.
     * Returns array of { from, to, label, bidirectional }
     */
    _deduplicateEdges(connections) {
        const edgeMap = new Map();
        for (const conn of connections) {
            const key = [conn.from, conn.to].sort().join('|||');
            if (edgeMap.has(key)) {
                const existing = edgeMap.get(key);
                existing.bidirectional = true;
                // Add the reverse label
                if (conn.from !== existing.from) {
                    existing.reverseLabel = conn.label;
                } else {
                    existing.reverseLabel = existing.label;
                    existing.label = conn.label;
                }
            } else {
                edgeMap.set(key, {
                    from: conn.from,
                    to: conn.to,
                    label: conn.label,
                    bidirectional: false,
                    reverseLabel: null,
                });
            }
        }
        return Array.from(edgeMap.values());
    }

    _drawEdge(positions, edge, _rooms) {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        if (!fromPos || !toPos) {
            return;
        }

        // Compute node dimensions to offset line endpoints
        const fromWidth = this._nodeWidth(edge.from);
        const toWidth = this._nodeWidth(edge.to);
        const nodeHeight = 30;

        // Direction vector
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        // Offset endpoints to the edges of the rectangles
        const fromOffsetX = (fromWidth / 2) * Math.abs(nx);
        const fromOffsetY = (nodeHeight / 2) * Math.abs(ny);
        const toOffsetX = (toWidth / 2) * Math.abs(nx);
        const toOffsetY = (nodeHeight / 2) * Math.abs(ny);

        const fromOffset = Math.min(
            Math.sqrt(fromOffsetX * fromOffsetX + fromOffsetY * fromOffsetY),
            dist / 2 - 5
        );
        const toOffset = Math.min(
            Math.sqrt(toOffsetX * toOffsetX + toOffsetY * toOffsetY),
            dist / 2 - 5
        );

        const x1 = fromPos.x + nx * fromOffset;
        const y1 = fromPos.y + ny * fromOffset;
        const x2 = toPos.x - nx * toOffset;
        const y2 = toPos.y - ny * toOffset;

        const isVertical =
            ['up', 'down', 'in', 'out'].includes(edge.label?.toLowerCase()) ||
            ['up', 'down', 'in', 'out'].includes(edge.reverseLabel?.toLowerCase());

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', isVertical ? 'map-edge map-edge-vertical' : 'map-edge');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('marker-end', 'url(#arrowhead)');
        if (edge.bidirectional) {
            line.setAttribute('marker-start', 'url(#arrowhead-start)');
        }
        if (isVertical) {
            line.setAttribute('stroke-dasharray', '5,4');
        }
        this.viewport.appendChild(line);

        // Direction label at midpoint (abbreviated)
        if (edge.label) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const labelText = document.createElementNS(SVG_NS, 'text');
            labelText.setAttribute('class', 'map-edge-label');
            labelText.setAttribute('x', String(midX));
            labelText.setAttribute('y', String(midY - 6));
            labelText.setAttribute('text-anchor', 'middle');
            const abbrev = abbreviateDirection(edge.label);
            const reverseAbbrev = edge.reverseLabel ? abbreviateDirection(edge.reverseLabel) : null;
            labelText.textContent = reverseAbbrev ? `${abbrev} / ${reverseAbbrev}` : abbrev;
            this.viewport.appendChild(labelText);
        }
    }

    _nodeWidth(name) {
        const displayName = name.length > 16 ? name.substring(0, 16) + '...' : name;
        return Math.max(displayName.length * 7 + 24, 60);
    }

    _drawNode(name, pos, isCurrent, roomData) {
        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('class', isCurrent ? 'map-node map-node-current' : 'map-node');
        group.setAttribute('data-room', name);

        const displayName = name.length > 16 ? name.substring(0, 16) + '...' : name;
        const width = this._nodeWidth(name);
        const height = 30;

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(pos.x - width / 2));
        rect.setAttribute('y', String(pos.y - height / 2));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        group.appendChild(rect);

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'map-label');
        text.setAttribute('x', String(pos.x));
        text.setAttribute('y', String(pos.y));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.textContent = displayName;
        group.appendChild(text);

        // Click handler
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showTooltip(name, roomData, pos);
        });

        // Keyboard accessibility
        group.setAttribute('role', 'button');
        group.setAttribute('tabindex', '0');
        group.setAttribute('aria-label', `Room: ${name}${isCurrent ? ' (current)' : ''}`);
        group.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._showTooltip(name, roomData, pos);
            }
        });

        this.viewport.appendChild(group);
    }

    _showTooltip(roomName, roomData, pos) {
        this._dismissTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'map-tooltip';

        const title = document.createElement('h4');
        title.textContent = roomName;
        tooltip.appendChild(title);

        // Items
        if (roomData && Array.isArray(roomData.items) && roomData.items.length > 0) {
            const itemsLabel = document.createElement('div');
            itemsLabel.style.marginBottom = '4px';
            itemsLabel.style.fontSize = '11px';
            itemsLabel.style.color = '#95a5a6';
            itemsLabel.textContent = 'Items: ' + roomData.items.join(', ');
            tooltip.appendChild(itemsLabel);
        }

        // Exit buttons
        const exits = roomData?.exits;
        if (exits && typeof exits === 'object') {
            const exitEntries = Array.isArray(exits)
                ? exits.map((e) => (typeof e === 'object' ? [e.direction, e.room] : [e, '']))
                : Object.entries(exits);

            if (exitEntries.length > 0) {
                const exitsDiv = document.createElement('div');
                exitsDiv.style.marginTop = '6px';
                exitsDiv.style.display = 'flex';
                exitsDiv.style.flexWrap = 'wrap';
                exitsDiv.style.gap = '4px';

                for (const [direction] of exitEntries) {
                    const btn = document.createElement('button');
                    btn.className = 'map-tooltip-exit-btn';
                    btn.textContent = `Go ${direction}`;
                    btn.setAttribute('aria-label', `Go ${direction}`);
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.onRoomClick(direction);
                        this._dismissTooltip();
                    });
                    exitsDiv.appendChild(btn);
                }
                tooltip.appendChild(exitsDiv);
            }
        }

        // Position tooltip relative to the SVG container
        const svgRect = this.svg.getBoundingClientRect
            ? this.svg.getBoundingClientRect()
            : { left: 0, top: 0 };
        const screenX = pos.x * this.transform.scale + this.transform.x + svgRect.left;
        const screenY = pos.y * this.transform.scale + this.transform.y + svgRect.top - 10;
        tooltip.style.left = `${screenX}px`;
        tooltip.style.top = `${screenY}px`;

        this.tooltip = tooltip;
        this.container.appendChild(tooltip);
    }

    _dismissTooltip() {
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
        this.tooltip = null;
    }

    _setupPanZoom() {
        this.svg.addEventListener('mousedown', this._onMouseDown);
        this.svg.addEventListener('mousemove', this._onMouseMove);
        this.svg.addEventListener('mouseup', this._onMouseUp);
        this.svg.addEventListener('mouseleave', this._onMouseUp);
        this.svg.addEventListener('wheel', this._onWheel, { passive: false });

        // Dismiss tooltip on SVG background click
        this.svg.addEventListener('click', () => {
            this._dismissTooltip();
        });
    }

    _onMouseDown(e) {
        // Only pan on direct SVG or viewport clicks (not nodes)
        if (e.target === this.svg || e.target === this.viewport) {
            this._isPanning = true;
            this._panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
            this.svg.style.cursor = 'grabbing';
        }
    }

    _onMouseMove(e) {
        if (!this._isPanning || !this._panStart) {
            return;
        }
        this.transform.x = e.clientX - this._panStart.x;
        this.transform.y = e.clientY - this._panStart.y;
        this._applyTransform();
    }

    _onMouseUp() {
        this._isPanning = false;
        this._panStart = null;
        if (this.svg) {
            this.svg.style.cursor = '';
        }
    }

    _onWheel(e) {
        e.preventDefault();
        const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.max(0.3, Math.min(3.0, this.transform.scale * scaleFactor));

        // Zoom toward cursor position
        const svgRect = this.svg.getBoundingClientRect
            ? this.svg.getBoundingClientRect()
            : { left: 0, top: 0 };
        const cursorX = e.clientX - svgRect.left;
        const cursorY = e.clientY - svgRect.top;

        const ratio = newScale / this.transform.scale;
        this.transform.x = cursorX - (cursorX - this.transform.x) * ratio;
        this.transform.y = cursorY - (cursorY - this.transform.y) * ratio;
        this.transform.scale = newScale;

        this._applyTransform();
    }

    _applyTransform() {
        if (this.viewport) {
            this.viewport.setAttribute(
                'transform',
                `translate(${this.transform.x},${this.transform.y}) scale(${this.transform.scale})`
            );
        }
    }

    _fitToView(positions) {
        const values = Object.values(positions);
        if (values.length === 0) {
            return;
        }

        const padding = 50;
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of values) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        const width = maxX - minX + padding * 2 || 300;
        const height = maxY - minY + padding * 2 || 300;
        this.svg.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${width} ${height}`);

        // Reset transform for a clean fit
        this.transform = { x: 0, y: 0, scale: 1 };
        this._applyTransform();
    }

    destroy() {
        this._dismissTooltip();
        if (this.svg) {
            this.svg.removeEventListener('mousedown', this._onMouseDown);
            this.svg.removeEventListener('mousemove', this._onMouseMove);
            this.svg.removeEventListener('mouseup', this._onMouseUp);
            this.svg.removeEventListener('mouseleave', this._onMouseUp);
            this.svg.removeEventListener('wheel', this._onWheel);
            if (this.svg.parentNode) {
                this.svg.parentNode.removeChild(this.svg);
            }
        }
        this.svg = null;
        this.viewport = null;
    }
}
