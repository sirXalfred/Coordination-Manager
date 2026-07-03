"use strict";
/**
 * Coordination Manager — Figma Wireframe Generator Plugin
 *
 * This plugin receives a wireframe spec (JSON) via the UI panel and creates
 * the corresponding Figma nodes: frames, rectangles, text, ellipses, with
 * auto-layout, fills, strokes, and corner radii.
 *
 * Usage:
 * 1. Open this plugin in Figma (Plugins > Coordination Manager Wireframes)
 * 2. Paste the JSON spec from the API (/api/figma/wireframe-spec)
 * 3. Click "Generate Wireframes"
 */
figma.showUI(__html__, { width: 480, height: 600 });
// ─── Color Helpers ────────────────────────────────────────────────────
function hexToRgb(hex) {
    // Strip alpha suffix if present (e.g. "#6d28d920")
    const clean = hex.replace('#', '').slice(0, 6);
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return { r, g, b };
}
function hexToOpacity(hex) {
    const clean = hex.replace('#', '');
    if (clean.length === 8) {
        return parseInt(clean.slice(6, 8), 16) / 255;
    }
    return 1;
}
// ─── Node Creation ────────────────────────────────────────────────────
async function createNode(spec, parent) {
    let node;
    switch (spec.type) {
        case 'FRAME': {
            const frame = figma.createFrame();
            frame.name = spec.name;
            frame.resize(spec.width, spec.height);
            // Auto-layout
            if (spec.layoutMode) {
                frame.layoutMode = spec.layoutMode;
                frame.primaryAxisSizingMode = 'FIXED';
                frame.counterAxisSizingMode = 'FIXED';
                if (spec.itemSpacing !== undefined) {
                    frame.itemSpacing = spec.itemSpacing;
                }
                if (spec.padding !== undefined) {
                    if (typeof spec.padding === 'number') {
                        frame.paddingTop = spec.padding;
                        frame.paddingRight = spec.padding;
                        frame.paddingBottom = spec.padding;
                        frame.paddingLeft = spec.padding;
                    }
                    else {
                        frame.paddingTop = spec.padding.top;
                        frame.paddingRight = spec.padding.right;
                        frame.paddingBottom = spec.padding.bottom;
                        frame.paddingLeft = spec.padding.left;
                    }
                }
                if (spec.primaryAxisAlignItems) {
                    frame.primaryAxisAlignItems = spec.primaryAxisAlignItems;
                }
                if (spec.counterAxisAlignItems) {
                    frame.counterAxisAlignItems = spec.counterAxisAlignItems;
                }
            }
            // Fill
            if (spec.fill && spec.fill !== 'transparent') {
                frame.fills = [{ type: 'SOLID', color: hexToRgb(spec.fill), opacity: hexToOpacity(spec.fill) }];
            }
            else {
                frame.fills = [];
            }
            // Stroke
            if (spec.stroke) {
                frame.strokes = [{ type: 'SOLID', color: hexToRgb(spec.stroke) }];
                frame.strokeWeight = spec.strokeWeight || 1;
            }
            // Corner radius
            if (spec.cornerRadius !== undefined) {
                frame.cornerRadius = spec.cornerRadius;
            }
            parent.appendChild(frame);
            // Create children
            if (spec.children) {
                for (const child of spec.children) {
                    await createNode(child, frame);
                }
            }
            node = frame;
            break;
        }
        case 'RECTANGLE': {
            const rect = figma.createRectangle();
            rect.name = spec.name;
            rect.resize(spec.width, spec.height);
            if (spec.fill && spec.fill !== 'transparent') {
                rect.fills = [{ type: 'SOLID', color: hexToRgb(spec.fill), opacity: hexToOpacity(spec.fill) }];
            }
            else if (spec.fill === 'transparent') {
                rect.fills = [];
            }
            if (spec.stroke && spec.stroke !== 'transparent') {
                rect.strokes = [{ type: 'SOLID', color: hexToRgb(spec.stroke) }];
                rect.strokeWeight = spec.strokeWeight || 1;
            }
            if (spec.cornerRadius !== undefined) {
                rect.cornerRadius = spec.cornerRadius;
            }
            parent.appendChild(rect);
            node = rect;
            break;
        }
        case 'TEXT': {
            const text = figma.createText();
            text.name = spec.name;
            // Load font BEFORE setting any text properties
            const fontStyle = spec.fontWeight === 'Bold' ? 'Bold' : spec.fontWeight === 'Medium' ? 'Medium' : 'Regular';
            await figma.loadFontAsync({ family: 'Inter', style: fontStyle });
            text.fontName = { family: 'Inter', style: fontStyle };
            if (spec.fontSize) {
                text.fontSize = spec.fontSize;
            }
            if (spec.text) {
                text.characters = spec.text;
            }
            // Resize after setting text content to avoid measurement issues
            text.resize(spec.width, spec.height);
            if (spec.fill && spec.fill !== 'transparent') {
                text.fills = [{ type: 'SOLID', color: hexToRgb(spec.fill) }];
            }
            // Prevent text from overflowing — use NONE for fixed-size text boxes
            text.textAutoResize = 'NONE';
            parent.appendChild(text);
            node = text;
            break;
        }
        case 'ELLIPSE': {
            const ellipse = figma.createEllipse();
            ellipse.name = spec.name;
            ellipse.resize(spec.width, spec.height);
            if (spec.fill && spec.fill !== 'transparent') {
                ellipse.fills = [{ type: 'SOLID', color: hexToRgb(spec.fill), opacity: hexToOpacity(spec.fill) }];
            }
            else if (spec.fill === 'transparent') {
                ellipse.fills = [];
            }
            parent.appendChild(ellipse);
            node = ellipse;
            break;
        }
        default:
            throw new Error(`Unknown node type: ${spec.type}`);
    }
    // Position (only for non-auto-layout parents)
    if (spec.x !== undefined)
        node.x = spec.x;
    if (spec.y !== undefined)
        node.y = spec.y;
    return node;
}
// ─── Main Generation ──────────────────────────────────────────────────
async function generateWireframes(spec) {
    // Create ONE Figma page for the entire flow
    const page = figma.createPage();
    page.name = `[WF] ${spec.projectName}`;
    await figma.setCurrentPageAsync(page);
    const GAP = 200;
    const ROW_GAP = 600;
    const FRAMES_PER_ROW = 5;
    const rootFrames = [];
    const framePositions = [];
    // Pre-compute the max height of each row so rows don't overlap
    const rowMaxHeights = [];
    for (let idx = 0; idx < spec.pages.length; idx++) {
        const row = Math.floor(idx / FRAMES_PER_ROW);
        const h = spec.pages[idx].frame.height;
        rowMaxHeights[row] = Math.max(rowMaxHeights[row] || 0, h);
    }
    // Accumulate Y offsets per row
    const rowYOffsets = [0];
    for (let r = 1; r < rowMaxHeights.length; r++) {
        rowYOffsets[r] = rowYOffsets[r - 1] + rowMaxHeights[r - 1] + ROW_GAP;
    }
    // Load fonts once for labels
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    for (let idx = 0; idx < spec.pages.length; idx++) {
        const pageSpec = spec.pages[idx];
        const col = idx % FRAMES_PER_ROW;
        const row = Math.floor(idx / FRAMES_PER_ROW);
        const xOffset = col * (pageSpec.frame.width + GAP);
        const yOffset = rowYOffsets[row];
        // Step label above each frame
        const label = figma.createText();
        label.fontName = { family: 'Inter', style: 'Bold' };
        label.fontSize = 20;
        label.characters = pageSpec.name;
        label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        label.x = xOffset;
        label.y = yOffset - 56;
        page.appendChild(label);
        // Description label
        const desc = figma.createText();
        desc.fontName = { family: 'Inter', style: 'Regular' };
        desc.fontSize = 13;
        desc.characters = pageSpec.description;
        desc.fills = [{ type: 'SOLID', color: hexToRgb('#71717a') }];
        desc.x = xOffset;
        desc.y = yOffset - 28;
        page.appendChild(desc);
        // Create the root frame
        const rootNode = await createNode(pageSpec.frame, page);
        rootNode.x = xOffset;
        rootNode.y = yOffset;
        rootFrames.push(rootNode);
        framePositions.push({ x: xOffset, y: yOffset });
    }
    // Add connector arrows between consecutive frames
    for (let i = 0; i < rootFrames.length - 1; i++) {
        const f1 = rootFrames[i];
        const f2 = rootFrames[i + 1];
        const pos1 = framePositions[i];
        const pos2 = framePositions[i + 1];
        const sameRow = Math.floor(i / FRAMES_PER_ROW) === Math.floor((i + 1) / FRAMES_PER_ROW);
        if (sameRow) {
            // Horizontal arrow (same as before)
            const midY = pos1.y + f1.height / 2;
            const shaftX = pos1.x + f1.width + 20;
            const shaftLen = GAP - 60;
            const shaft = figma.createRectangle();
            shaft.name = `Arrow-shaft-${i + 1}`;
            shaft.resize(shaftLen, 3);
            shaft.x = shaftX;
            shaft.y = midY - 1;
            shaft.fills = [{ type: 'SOLID', color: hexToRgb('#6d28d9') }];
            shaft.cornerRadius = 2;
            page.appendChild(shaft);
            // Arrowhead pointing right
            const headX = pos2.x - 20;
            const headSize = 14;
            const arrowhead = figma.createVector();
            arrowhead.name = `Arrow-head-${i + 1}`;
            arrowhead.vectorPaths = [{
                    windingRule: 'NONZERO',
                    data: `M 0 0 L ${headSize} ${headSize / 2} L 0 ${headSize} Z`
                }];
            arrowhead.resize(headSize, headSize);
            arrowhead.x = headX;
            arrowhead.y = midY - headSize / 2;
            arrowhead.fills = [{ type: 'SOLID', color: hexToRgb('#6d28d9') }];
            page.appendChild(arrowhead);
            // Step transition label
            const labelText = spec.pages[i].transitionLabel || '';
            if (labelText) {
                const transLabel = figma.createText();
                transLabel.fontName = { family: 'Inter', style: 'Regular' };
                transLabel.fontSize = 11;
                transLabel.characters = labelText;
                transLabel.fills = [{ type: 'SOLID', color: hexToRgb('#71717a') }];
                transLabel.x = shaftX + shaftLen / 2 - 30;
                transLabel.y = midY + 12;
                page.appendChild(transLabel);
            }
        }
        else {
            // Row-wrap: draw an L-shaped connector (down-right from end of row to start of next row)
            const startX = pos1.x + f1.width / 2;
            const startY = pos1.y + f1.height + 20;
            const endX = pos2.x + f2.width / 2;
            const endY = pos2.y - 40;
            // Vertical segment down from f1
            const vLen = (endY - startY) / 2;
            const vShaft = figma.createRectangle();
            vShaft.name = `Arrow-vshaft-${i + 1}`;
            vShaft.resize(3, Math.abs(vLen));
            vShaft.x = startX;
            vShaft.y = startY;
            vShaft.fills = [{ type: 'SOLID', color: hexToRgb('#6d28d9') }];
            vShaft.cornerRadius = 2;
            page.appendChild(vShaft);
            // Horizontal segment connecting rows
            const hMidY = startY + vLen;
            const hStart = Math.min(startX, endX);
            const hEnd = Math.max(startX, endX);
            const hShaft = figma.createRectangle();
            hShaft.name = `Arrow-hshaft-${i + 1}`;
            hShaft.resize(hEnd - hStart, 3);
            hShaft.x = hStart;
            hShaft.y = hMidY;
            hShaft.fills = [{ type: 'SOLID', color: hexToRgb('#6d28d9') }];
            hShaft.cornerRadius = 2;
            page.appendChild(hShaft);
            // Vertical segment down to f2
            const v2Shaft = figma.createRectangle();
            v2Shaft.name = `Arrow-v2shaft-${i + 1}`;
            v2Shaft.resize(3, Math.abs(vLen));
            v2Shaft.x = endX;
            v2Shaft.y = hMidY;
            v2Shaft.fills = [{ type: 'SOLID', color: hexToRgb('#6d28d9') }];
            v2Shaft.cornerRadius = 2;
            page.appendChild(v2Shaft);
            // Arrowhead pointing down at f2
            const headSize = 14;
            const arrowhead = figma.createVector();
            arrowhead.name = `Arrow-head-${i + 1}`;
            arrowhead.vectorPaths = [{
                    windingRule: 'NONZERO',
                    data: `M 0 0 L ${headSize / 2} ${headSize} L ${headSize} 0 Z`
                }];
            arrowhead.resize(headSize, headSize);
            arrowhead.x = endX - headSize / 2;
            arrowhead.y = endY - headSize + 20;
            arrowhead.fills = [{ type: 'SOLID', color: hexToRgb('#6d28d9') }];
            page.appendChild(arrowhead);
            // Transition label near the horizontal segment
            const labelText = spec.pages[i].transitionLabel || '';
            if (labelText) {
                const transLabel = figma.createText();
                transLabel.fontName = { family: 'Inter', style: 'Regular' };
                transLabel.fontSize = 11;
                transLabel.characters = labelText;
                transLabel.fills = [{ type: 'SOLID', color: hexToRgb('#71717a') }];
                transLabel.x = (hStart + hEnd) / 2 - 30;
                transLabel.y = hMidY + 10;
                page.appendChild(transLabel);
            }
        }
    }
    // Zoom to fit all content
    figma.viewport.scrollAndZoomIntoView(page.children);
    return spec.pages.length;
}
// ─── UI Message Handler ───────────────────────────────────────────────
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'generate' && msg.spec) {
        try {
            figma.ui.postMessage({ type: 'status', message: 'Generating wireframes...' });
            const count = await generateWireframes(msg.spec);
            figma.ui.postMessage({ type: 'success', message: `Created ${count} wireframe page(s)` });
            figma.notify(`Generated ${count} wireframe pages`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            figma.ui.postMessage({ type: 'error', message: errorMsg });
            figma.notify(`Error: ${errorMsg}`, { error: true });
        }
    }
    if (msg.type === 'cancel') {
        figma.closePlugin();
    }
};
