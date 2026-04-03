import { jest } from '@jest/globals';
import { ForceLayout, SVGMapRenderer } from '../../src/ui/mapRenderer.js';

// ── ForceLayout ──────────────────────────────────────────────────────────────

describe('ForceLayout', () => {
    test('should return empty object for empty input', () => {
        const layout = new ForceLayout([], []);
        expect(layout.run()).toEqual({});
    });

    test('should return single node at its initial position', () => {
        const nodes = [{ id: 'A', x: 100, y: 200 }];
        const layout = new ForceLayout(nodes, []);
        const positions = layout.run();
        expect(positions.A).toBeDefined();
        expect(positions.A.x).toBeCloseTo(100, 0);
        expect(positions.A.y).toBeCloseTo(200, 0);
    });

    test('should separate two unconnected nodes', () => {
        const nodes = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 10, y: 0 },
        ];
        const layout = new ForceLayout(nodes, []);
        const positions = layout.run();

        const initialDist = 10;
        const finalDist = Math.sqrt(
            (positions.B.x - positions.A.x) ** 2 + (positions.B.y - positions.A.y) ** 2
        );
        expect(finalDist).toBeGreaterThan(initialDist);
    });

    test('should keep two connected nodes near spring rest length', () => {
        const springLength = 150;
        const nodes = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 300, y: 0 },
        ];
        const edges = [{ source: 'A', target: 'B' }];
        const layout = new ForceLayout(nodes, edges, { springLength });
        const positions = layout.run();

        const dist = Math.sqrt(
            (positions.B.x - positions.A.x) ** 2 + (positions.B.y - positions.A.y) ** 2
        );
        // Should be within 50% of spring length
        expect(dist).toBeGreaterThan(springLength * 0.5);
        expect(dist).toBeLessThan(springLength * 2.0);
    });

    test('should produce deterministic results', () => {
        const nodes = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 150, y: 0 },
            { id: 'C', x: 75, y: 130 },
        ];
        const edges = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'C' },
        ];

        const layout1 = new ForceLayout(nodes, edges);
        const pos1 = layout1.run();

        const layout2 = new ForceLayout(
            nodes.map((n) => ({ ...n })),
            edges.map((e) => ({ ...e }))
        );
        const pos2 = layout2.run();

        expect(pos1.A.x).toBe(pos2.A.x);
        expect(pos1.A.y).toBe(pos2.A.y);
        expect(pos1.B.x).toBe(pos2.B.x);
        expect(pos1.C.y).toBe(pos2.C.y);
    });

    test('should handle disconnected subgraphs', () => {
        const nodes = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 150, y: 0 },
            { id: 'C', x: 300, y: 0 },
            { id: 'D', x: 450, y: 0 },
        ];
        const edges = [
            { source: 'A', target: 'B' },
            { source: 'C', target: 'D' },
        ];
        const layout = new ForceLayout(nodes, edges);
        const positions = layout.run();

        expect(Object.keys(positions)).toHaveLength(4);
        for (const pos of Object.values(positions)) {
            expect(isFinite(pos.x)).toBe(true);
            expect(isFinite(pos.y)).toBe(true);
        }
    });

    test('should handle large graphs without errors', () => {
        const nodes = [];
        const edges = [];
        for (let i = 0; i < 60; i++) {
            nodes.push({ id: `Room${i}`, x: (i % 8) * 150, y: Math.floor(i / 8) * 150 });
            if (i > 0) {
                edges.push({ source: `Room${i - 1}`, target: `Room${i}` });
            }
        }
        const layout = new ForceLayout(nodes, edges);
        const positions = layout.run();

        expect(Object.keys(positions)).toHaveLength(60);
        for (const pos of Object.values(positions)) {
            expect(isNaN(pos.x)).toBe(false);
            expect(isNaN(pos.y)).toBe(false);
        }
    });

    test('should not produce NaN for nodes starting at same position', () => {
        const nodes = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 0, y: 0 },
        ];
        const layout = new ForceLayout(nodes, []);
        const positions = layout.run();

        expect(isNaN(positions.A.x)).toBe(false);
        expect(isNaN(positions.A.y)).toBe(false);
        expect(isNaN(positions.B.x)).toBe(false);
        expect(isNaN(positions.B.y)).toBe(false);
    });

    test('gridPositions should place nodes in a deterministic grid', () => {
        const positions = ForceLayout.gridPositions(['A', 'B', 'C', 'D']);
        expect(positions).toHaveLength(4);
        // 2x2 grid
        expect(positions[0]).toEqual({ id: 'A', x: 0, y: 0 });
        expect(positions[1]).toEqual({ id: 'B', x: 150, y: 0 });
        expect(positions[2]).toEqual({ id: 'C', x: 0, y: 150 });
        expect(positions[3]).toEqual({ id: 'D', x: 150, y: 150 });
    });
});

// ── SVGMapRenderer ───────────────────────────────────────────────────────────

describe('SVGMapRenderer', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should create SVG element in container', () => {
        const renderer = new SVGMapRenderer(container);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.getAttribute('class')).toBe('map-svg');
        renderer.destroy();
    });

    test('should render nodes as rect+text groups', () => {
        const renderer = new SVGMapRenderer(container);
        const mapData = {
            rooms: {
                'Room A': { items: [], exits: { north: 'Room B' } },
                'Room B': { items: [], exits: { south: 'Room A' } },
                'Room C': { items: [], exits: {} },
            },
            connections: [
                { from: 'Room A', to: 'Room B', label: 'north' },
                { from: 'Room B', to: 'Room A', label: 'south' },
            ],
        };
        renderer.render(mapData, null);

        const nodes = container.querySelectorAll('.map-node');
        expect(nodes.length).toBe(3);

        // Each node should have a rect and text
        nodes.forEach((node) => {
            expect(node.querySelector('rect')).not.toBeNull();
            expect(node.querySelector('text')).not.toBeNull();
        });

        renderer.destroy();
    });

    test('should render edges as line elements', () => {
        const renderer = new SVGMapRenderer(container);
        const mapData = {
            rooms: {
                'Room A': { items: [], exits: { north: 'Room B' } },
                'Room B': { items: [], exits: { south: 'Room A' } },
            },
            connections: [
                { from: 'Room A', to: 'Room B', label: 'north' },
                { from: 'Room B', to: 'Room A', label: 'south' },
            ],
        };
        renderer.render(mapData, null);

        // Bidirectional pair should be deduplicated to 1 edge
        const edges = container.querySelectorAll('.map-edge');
        expect(edges.length).toBe(1);

        renderer.destroy();
    });

    test('should highlight current room with .map-node-current', () => {
        const renderer = new SVGMapRenderer(container);
        const mapData = {
            rooms: {
                'Room A': { items: [], exits: {} },
                'Room B': { items: [], exits: {} },
            },
            connections: [],
        };
        renderer.render(mapData, 'Room A');

        const current = container.querySelector('.map-node-current');
        expect(current).not.toBeNull();
        expect(current.getAttribute('data-room')).toBe('Room A');

        // Room B should not be highlighted
        const allNodes = container.querySelectorAll('.map-node');
        const nonCurrent = Array.from(allNodes).filter(
            (n) => !n.classList.contains('map-node-current')
        );
        expect(nonCurrent.length).toBe(1);

        renderer.destroy();
    });

    test('should show empty state for zero rooms', () => {
        const renderer = new SVGMapRenderer(container);
        renderer.render({ rooms: {}, connections: [] }, null);

        const textEl = container.querySelector('.map-label');
        expect(textEl).not.toBeNull();
        expect(textEl.textContent).toContain('No rooms discovered');

        renderer.destroy();
    });

    test('should create arrowhead marker in defs', () => {
        const renderer = new SVGMapRenderer(container);
        const marker = container.querySelector('marker#arrowhead');
        expect(marker).not.toBeNull();
        expect(marker.querySelector('path')).not.toBeNull();

        renderer.destroy();
    });

    test('should update on re-render without duplicating SVG', () => {
        const renderer = new SVGMapRenderer(container);
        const mapData1 = {
            rooms: { 'Room A': { items: [], exits: {} } },
            connections: [],
        };
        renderer.render(mapData1, null);

        const mapData2 = {
            rooms: {
                'Room A': { items: [], exits: {} },
                'Room B': { items: [], exits: {} },
            },
            connections: [],
        };
        renderer.render(mapData2, null);

        // Still only one SVG element
        const svgs = container.querySelectorAll('svg');
        expect(svgs.length).toBe(1);

        // Should now have 2 nodes
        const nodes = container.querySelectorAll('.map-node');
        expect(nodes.length).toBe(2);

        renderer.destroy();
    });

    test('should dismiss tooltip on background click', () => {
        const renderer = new SVGMapRenderer(container);
        const mapData = {
            rooms: { 'Room A': { items: [], exits: { north: 'Room B' } } },
            connections: [],
        };
        renderer.render(mapData, null);

        // Show tooltip by clicking node
        const node = container.querySelector('.map-node');
        node.dispatchEvent(new Event('click', { bubbles: true }));

        let tooltip = container.querySelector('.map-tooltip');
        expect(tooltip).not.toBeNull();

        // Click SVG background to dismiss
        renderer.svg.dispatchEvent(new Event('click', { bubbles: false }));
        tooltip = container.querySelector('.map-tooltip');
        expect(tooltip).toBeNull();

        renderer.destroy();
    });

    test('should call onRoomClick when exit button clicked', () => {
        const onRoomClick = jest.fn();
        const renderer = new SVGMapRenderer(container, { onRoomClick });
        const mapData = {
            rooms: {
                'Room A': { items: [], exits: { north: 'Room B' } },
            },
            connections: [],
        };
        renderer.render(mapData, null);

        // Click the node to show tooltip
        const node = container.querySelector('.map-node');
        node.dispatchEvent(new Event('click', { bubbles: true }));

        // Find and click the exit button
        const exitBtn = container.querySelector('.map-tooltip-exit-btn');
        expect(exitBtn).not.toBeNull();
        expect(exitBtn.textContent).toBe('Go north');
        exitBtn.dispatchEvent(new Event('click', { bubbles: true }));

        expect(onRoomClick).toHaveBeenCalledWith('north');

        renderer.destroy();
    });

    test('should handle rooms with XSS-attempt names safely', () => {
        const renderer = new SVGMapRenderer(container);
        const xssName = '<img onerror=alert(1)>';
        const mapData = {
            rooms: {
                [xssName]: { items: [], exits: {} },
            },
            connections: [],
        };
        renderer.render(mapData, null);

        // Should be rendered as text, not as HTML
        const label = container.querySelector('.map-label');
        // Name is truncated at 16 chars, but still rendered as text not HTML
        expect(label.textContent).toContain('<img onerror=ale');

        // No img elements should have been created
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBe(0);

        renderer.destroy();
    });

    test('destroy removes SVG from container', () => {
        const renderer = new SVGMapRenderer(container);
        expect(container.querySelector('svg')).not.toBeNull();

        renderer.destroy();
        expect(container.querySelector('svg')).toBeNull();
    });

    test('should truncate long room names in labels', () => {
        const renderer = new SVGMapRenderer(container);
        const longName = 'The Very Long Room Name That Exceeds Sixteen';
        const mapData = {
            rooms: { [longName]: { items: [], exits: {} } },
            connections: [],
        };
        renderer.render(mapData, null);

        const label = container.querySelector('.map-label');
        expect(label.textContent).toBe('The Very Long Ro...');

        renderer.destroy();
    });
});
