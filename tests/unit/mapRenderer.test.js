import { jest } from '@jest/globals';
import { ForceLayout, DirectionalLayout, SVGMapRenderer } from '../../src/ui/mapRenderer.js';

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

    describe('Cardinal direction labels', () => {
        test('edge label shows abbreviated direction (N for north)', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: { north: 'Garden' } },
                    Garden: { items: [], exits: { south: 'Hall' } },
                },
                connections: [
                    { from: 'Hall', to: 'Garden', label: 'north' },
                    { from: 'Garden', to: 'Hall', label: 'south' },
                ],
            };
            renderer.render(mapData, 'Hall');
            const labels = container.querySelectorAll('.map-edge-label');
            const texts = Array.from(labels).map((l) => l.textContent);
            // Bidirectional edge should show 'N / S' or similar abbreviations
            expect(texts.some((t) => t.includes('N'))).toBe(true);
            renderer.destroy();
        });

        test('up/down edge gets stroke-dasharray attribute', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Cellar: { items: [], exits: { up: 'Kitchen' } },
                    Kitchen: { items: [], exits: { down: 'Cellar' } },
                },
                connections: [
                    { from: 'Cellar', to: 'Kitchen', label: 'up' },
                    { from: 'Kitchen', to: 'Cellar', label: 'down' },
                ],
            };
            renderer.render(mapData, 'Cellar');
            const edges = container.querySelectorAll('.map-edge');
            const dashedEdge = Array.from(edges).find((e) => e.getAttribute('stroke-dasharray'));
            expect(dashedEdge).not.toBeNull();
            renderer.destroy();
        });

        test('up edge label shows arrow symbol', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Cellar: { items: [], exits: { up: 'Kitchen' } },
                    Kitchen: { items: [], exits: {} },
                },
                connections: [{ from: 'Cellar', to: 'Kitchen', label: 'up' }],
            };
            renderer.render(mapData, 'Cellar');
            const labels = container.querySelectorAll('.map-edge-label');
            const texts = Array.from(labels).map((l) => l.textContent);
            expect(texts.some((t) => t.includes('\u2191'))).toBe(true);
            renderer.destroy();
        });

        test('cardinal edge does not get stroke-dasharray attribute', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: { north: 'Garden' } },
                    Garden: { items: [], exits: {} },
                },
                connections: [{ from: 'Hall', to: 'Garden', label: 'north' }],
            };
            renderer.render(mapData, 'Hall');
            const edges = container.querySelectorAll('.map-edge');
            const dashedEdge = Array.from(edges).find((e) => e.getAttribute('stroke-dasharray'));
            expect(dashedEdge).toBeUndefined();
            renderer.destroy();
        });
    });

    describe('Map intelligence visuals', () => {
        test('unvisited room node gets map-node-unvisited class', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: {}, status: 'visited' },
                    Vault: { items: [], exits: {}, status: 'unvisited' },
                },
                connections: [],
            };
            renderer.render(mapData, 'Hall');

            const vaultNode = container.querySelector('[data-room="Vault"]');
            expect(vaultNode.classList.contains('map-node-unvisited')).toBe(true);

            const hallNode = container.querySelector('[data-room="Hall"]');
            expect(hallNode.classList.contains('map-node-unvisited')).toBe(false);

            renderer.destroy();
        });

        test('inaccessible edge gets map-edge-inaccessible class', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: { north: 'Vault' } },
                    Vault: { items: [], exits: {} },
                },
                connections: [
                    {
                        from: 'Hall',
                        to: 'Vault',
                        label: 'north',
                        accessible: false,
                        confirmed: true,
                    },
                ],
            };
            renderer.render(mapData, 'Hall');

            const inaccessible = container.querySelector('.map-edge-inaccessible');
            expect(inaccessible).not.toBeNull();

            renderer.destroy();
        });

        test('inaccessible edge label includes lock symbol', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: { north: 'Vault' } },
                    Vault: { items: [], exits: {} },
                },
                connections: [
                    {
                        from: 'Hall',
                        to: 'Vault',
                        label: 'north',
                        accessible: false,
                    },
                ],
            };
            renderer.render(mapData, 'Hall');

            const labels = container.querySelectorAll('.map-edge-label');
            const lockLabel = Array.from(labels).find((l) =>
                l.textContent.includes('\uD83D\uDD12')
            );
            expect(lockLabel).toBeDefined();

            renderer.destroy();
        });

        test('unconfirmed edge gets map-edge-unconfirmed class and no arrowhead', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: { east: 'Garden' } },
                    Garden: { items: [], exits: {} },
                },
                connections: [
                    {
                        from: 'Hall',
                        to: 'Garden',
                        label: 'east',
                        confirmed: false,
                    },
                ],
            };
            renderer.render(mapData, 'Hall');

            const unconfirmed = container.querySelector('.map-edge-unconfirmed');
            expect(unconfirmed).not.toBeNull();
            expect(unconfirmed.getAttribute('marker-end')).toBeNull();

            renderer.destroy();
        });

        test('unconfirmed edge label has ? suffix', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: { items: [], exits: { east: 'Garden' } },
                    Garden: { items: [], exits: {} },
                },
                connections: [
                    {
                        from: 'Hall',
                        to: 'Garden',
                        label: 'east',
                        confirmed: false,
                    },
                ],
            };
            renderer.render(mapData, 'Hall');

            const labels = container.querySelectorAll('.map-edge-label');
            const questionLabel = Array.from(labels).find((l) => l.textContent.includes('E?'));
            expect(questionLabel).toBeDefined();

            renderer.destroy();
        });

        test('tooltip shows description text', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: {
                        items: [],
                        exits: {},
                        description: 'A grand stone hall lit by torches.',
                    },
                },
                connections: [],
            };
            renderer.render(mapData, 'Hall');

            // Click the node to show tooltip
            const node = container.querySelector('[data-room="Hall"]');
            node.dispatchEvent(new Event('click', { bubbles: true }));

            const desc = container.querySelector('.map-tooltip-description');
            expect(desc).not.toBeNull();
            expect(desc.textContent).toBe('A grand stone hall lit by torches.');

            renderer.destroy();
        });

        test('tooltip shows Not yet visited badge for unvisited rooms', () => {
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Vault: {
                        items: [],
                        exits: {},
                        status: 'unvisited',
                        description: 'A locked vault.',
                    },
                },
                connections: [],
            };
            renderer.render(mapData, null);

            const node = container.querySelector('[data-room="Vault"]');
            node.dispatchEvent(new Event('click', { bubbles: true }));

            const badge = container.querySelector('.map-tooltip-unvisited-badge');
            expect(badge).not.toBeNull();
            expect(badge.textContent).toBe('Not yet visited');

            renderer.destroy();
        });

        test('tooltip truncates long descriptions to 120 chars', () => {
            const longDesc = 'A'.repeat(200);
            const renderer = new SVGMapRenderer(container);
            const mapData = {
                rooms: {
                    Hall: {
                        items: [],
                        exits: {},
                        description: longDesc,
                    },
                },
                connections: [],
            };
            renderer.render(mapData, 'Hall');

            const node = container.querySelector('[data-room="Hall"]');
            node.dispatchEvent(new Event('click', { bubbles: true }));

            const desc = container.querySelector('.map-tooltip-description');
            expect(desc.textContent.length).toBeLessThanOrEqual(123); // 120 + '...'

            renderer.destroy();
        });
    });
});

// ── ForceLayout directional bias ─────────────────────────────────────────────

describe('ForceLayout directional bias', () => {
    test('north-connected room ends up with lower y than source', () => {
        const nodes = [
            { id: 'Hall', x: 0, y: 0 },
            { id: 'Garden', x: 0, y: 0 },
        ];
        const edges = [{ source: 'Hall', target: 'Garden' }];
        const directionalEdges = [{ source: 'Hall', target: 'Garden', direction: 'north' }];
        const layout = new ForceLayout(nodes, edges, {
            directionalEdges,
            directionalStrength: 0.5,
            iterations: 200,
        });
        const positions = layout.run();
        // Garden (north of Hall) should have a lower y value (higher on screen)
        expect(positions.Garden.y).toBeLessThan(positions.Hall.y);
    });

    test('south-connected room ends up with higher y than source', () => {
        const nodes = [
            { id: 'Hall', x: 0, y: 0 },
            { id: 'Cellar', x: 0, y: 0 },
        ];
        const edges = [{ source: 'Hall', target: 'Cellar' }];
        const directionalEdges = [{ source: 'Hall', target: 'Cellar', direction: 'south' }];
        const layout = new ForceLayout(nodes, edges, {
            directionalEdges,
            directionalStrength: 0.5,
            iterations: 200,
        });
        const positions = layout.run();
        expect(positions.Cellar.y).toBeGreaterThan(positions.Hall.y);
    });

    test('up/down direction produces no positional bias (same as no directional edge)', () => {
        const nodesA = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 10, y: 0 },
        ];
        const nodesB = [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 10, y: 0 },
        ];
        const edges = [{ source: 'A', target: 'B' }];

        const layoutWithUp = new ForceLayout(nodesA, edges, {
            directionalEdges: [{ source: 'A', target: 'B', direction: 'up' }],
            directionalStrength: 0.5,
            iterations: 50,
        });
        const layoutWithNone = new ForceLayout(nodesB, edges, {
            directionalEdges: [],
            directionalStrength: 0.5,
            iterations: 50,
        });

        const posA = layoutWithUp.run();
        const posB = layoutWithNone.run();
        // Both should produce same result since 'up' has no vector
        expect(posA.A.x).toBeCloseTo(posB.A.x, 0);
        expect(posA.A.y).toBeCloseTo(posB.A.y, 0);
    });
});

// ── DirectionalLayout ───────────────────────────────────────────────────────

describe('DirectionalLayout', () => {
    test('north room placed above root (lower y)', () => {
        const conns = [{ from: 'Hall', to: 'Garden', label: 'north' }];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('Hall', ['Hall', 'Garden']);
        expect(pos.Garden.y).toBeLessThan(pos.Hall.y);
    });

    test('east room placed right of root (higher x)', () => {
        const conns = [{ from: 'Hall', to: 'Kitchen', label: 'east' }];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('Hall', ['Hall', 'Kitchen']);
        expect(pos.Kitchen.x).toBeGreaterThan(pos.Hall.x);
    });

    test('south room below, west room left', () => {
        const conns = [
            { from: 'Hall', to: 'Cellar', label: 'south' },
            { from: 'Hall', to: 'Parlor', label: 'west' },
        ];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('Hall', ['Hall', 'Cellar', 'Parlor']);
        expect(pos.Cellar.y).toBeGreaterThan(pos.Hall.y);
        expect(pos.Parlor.x).toBeLessThan(pos.Hall.x);
    });

    test('diagonal NE: lower y AND higher x than root', () => {
        const conns = [{ from: 'Hall', to: 'Tower', label: 'northeast' }];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('Hall', ['Hall', 'Tower']);
        expect(pos.Tower.y).toBeLessThan(pos.Hall.y);
        expect(pos.Tower.x).toBeGreaterThan(pos.Hall.x);
    });

    test('up/down: same x/y base, different floor value', () => {
        const conns = [
            { from: 'Hall', to: 'Attic', label: 'up' },
            { from: 'Hall', to: 'Basement', label: 'down' },
        ];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('Hall', ['Hall', 'Attic', 'Basement']);
        expect(pos.Attic.floor).toBe(1);
        expect(pos.Basement.floor).toBe(-1);
        expect(pos.Hall.floor).toBe(0);
    });

    test('conflict resolution: two rooms both north get different cells', () => {
        const conns = [
            { from: 'Hall', to: 'Room A', label: 'north' },
            { from: 'Hall', to: 'Room B', label: 'north' },
        ];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('Hall', ['Hall', 'Room A', 'Room B']);
        // Both should be above Hall
        expect(pos['Room A'].y).toBeLessThan(pos.Hall.y);
        expect(pos['Room B'].y).toBeLessThan(pos.Hall.y);
        // Second nudged further north (lower y)
        expect(pos['Room B'].y).toBeLessThan(pos['Room A'].y);
    });

    test('disconnected subgraph: all rooms get finite positions, no overlap', () => {
        const conns = [
            { from: 'A', to: 'B', label: 'north' },
            { from: 'C', to: 'D', label: 'east' },
        ];
        const layout = new DirectionalLayout(conns);
        const pos = layout.run('A', ['A', 'B', 'C', 'D']);
        // All rooms placed
        expect(Object.keys(pos)).toHaveLength(4);
        for (const name of ['A', 'B', 'C', 'D']) {
            expect(Number.isFinite(pos[name].x)).toBe(true);
            expect(Number.isFinite(pos[name].y)).toBe(true);
        }
        // Disconnected component below main graph
        expect(pos.C.y).toBeGreaterThan(pos.A.y);
    });

    test('single room at origin, empty input returns {}', () => {
        const layout = new DirectionalLayout([]);
        const single = layout.run('Hall', ['Hall']);
        expect(single.Hall.x).toBe(0);
        expect(single.Hall.y).toBe(0);

        const empty = layout.run(null, []);
        expect(empty).toEqual({});
    });

    test('deterministic: same input produces same output', () => {
        const conns = [
            { from: 'Hall', to: 'Garden', label: 'north' },
            { from: 'Hall', to: 'Kitchen', label: 'east' },
            { from: 'Garden', to: 'Shed', label: 'west' },
        ];
        const rooms = ['Hall', 'Garden', 'Kitchen', 'Shed'];
        const layout1 = new DirectionalLayout(conns);
        const layout2 = new DirectionalLayout(conns);
        const pos1 = layout1.run('Hall', rooms);
        const pos2 = layout2.run('Hall', rooms);
        for (const name of rooms) {
            expect(pos1[name].x).toBe(pos2[name].x);
            expect(pos1[name].y).toBe(pos2[name].y);
            expect(pos1[name].floor).toBe(pos2[name].floor);
        }
    });
});

// ── SVGMapRenderer RAF throttling ─────────────────────────────────────────────

describe('SVGMapRenderer RAF throttling', () => {
    let container;
    let rafCallbacks;
    let originalRAF;
    let originalCAF;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        rafCallbacks = [];
        originalRAF = globalThis.requestAnimationFrame;
        originalCAF = globalThis.cancelAnimationFrame;

        globalThis.requestAnimationFrame = jest.fn((cb) => {
            const id = rafCallbacks.length;
            rafCallbacks.push(cb);
            return id;
        });
        globalThis.cancelAnimationFrame = jest.fn((id) => {
            rafCallbacks[id] = null;
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        globalThis.requestAnimationFrame = originalRAF;
        globalThis.cancelAnimationFrame = originalCAF;
    });

    test('_scheduleTransform() calls requestAnimationFrame', () => {
        const renderer = new SVGMapRenderer(container);
        renderer._scheduleTransform();
        expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    test('calling _scheduleTransform() twice schedules only one RAF', () => {
        const renderer = new SVGMapRenderer(container);
        renderer._scheduleTransform();
        renderer._scheduleTransform();
        expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    test('_rafId is null after RAF fires', () => {
        const renderer = new SVGMapRenderer(container);
        renderer._scheduleTransform();
        expect(renderer._rafId).not.toBeNull();
        // fire the RAF callback
        rafCallbacks[0]();
        expect(renderer._rafId).toBeNull();
    });

    test('destroy() cancels pending RAF', () => {
        const renderer = new SVGMapRenderer(container);
        renderer._scheduleTransform();
        const pendingId = renderer._rafId;
        renderer.destroy();
        expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(pendingId);
    });

    test('destroy() with no pending RAF does not call cancelAnimationFrame', () => {
        const renderer = new SVGMapRenderer(container);
        renderer.destroy();
        expect(globalThis.cancelAnimationFrame).not.toHaveBeenCalled();
    });
});
