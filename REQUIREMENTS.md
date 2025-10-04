# 🏎️ Heat: Pedal to the Metal — Custom Track Creator (Bezier-Based)

## 🎯 Overview

A web app for designing and sharing custom _Heat: Pedal to the Metal_ tracks.  
Tracks are built using **Bezier curves**, then **discretized into Spaces** that align with official game rules (Corners, Speed Limits, Slipstream, Blocking, etc.).

---

## ⚙️ A. Data Model / Canonical Representation

- **Centerline** stored as a connected chain of cubic Bezier segments.
- **Discretized Spaces**:
  - Sample the centerline at fixed at length and conver to Spaces
  - Each Space includes:
    - Index (Space #)
    - 1–N **Spots** (minimum: Race Line + outer Spots)
    - Metadata:
      - `isCornerLine`
      - `speedLimit`
      - `isStartFinish`
      - `legendLine`
      - `innerLineSide`
      - etc
- **Corners**:
  - Defined at specific Space indices.
  - Each has a `speedLimit` (integer value).
- **Serialization (JSON)**:
  - Includes both geometric (Bezier control points) and gameplay data (Spaces, Corners, metadata).

---

## 🧩 B. Editor Features

### 1. Bezier Curve Drawing

- **Edit, delete, or move control points.**
  - You can drag points around, when clicking a point you get the bezier handles, that you can edit
  - When you click on the spline add a point at that part of the splice
  - There is a button to remove selected point

### 2. Discretization Tools

- **Sample to Spaces**:
  - Define target # of Spaces per lap.
  - Generate discrete Spaces along curve.
  - The Spaces need to be the same length.
- **Visual Overlay**:
  - Show discrete Space divisions on the Bezier.
  - Show a thicker InnerLine on one side of the track
  - Show a number that indicate the number of Spaces left to the next Corner

### 3. Corner Placement

- Place **Corner Lines** manually
- Set **Speed Limit** for each corner.
- Visual badges for corner speed limits.
- Set which side is the Inner Side of the track
  - the Inner Side is from this corner to the next one
  - The Innder Side is a thicker outside line

### 4. Track Metadata

- Mark **Start/Finish Line** manually, can move around
- Board metadata manually or automaticlly calculated:
  - Number of Laps (set manually)
  - Corners per lap (calculated)
  - Spaces per lap (calculated)
  - Heat/Stress card counts (set manually)

---

## 🧠 C. Gameplay Validation Engine

### 1. Movement Simulation

- Move a car forward by _N_ Spaces (based on card sum).
- Cars may **pass through** others but cannot end in a full Space.
- If ending Space is full, place the car in the **closest previous available Space**.

### 2. Corner Check Logic

- Detect all **Corner Lines crossed** during the move.
- For each:
  - Compare car’s total **Speed** (cards + Boost) to the corner’s **Speed Limit**.
  - If exceeded:
    - Pay Heat = (Speed − Limit).
    - If not enough Heat → **Spin Out** (move back before the corner, add Stress, set to 1st Gear).
- Apply corners in crossing order.

### 3. Slipstream

- If a car ends its move **adjacent to or behind** another car:
  - May move +2 Spaces forward.
  - Slipstream **does not** count toward Speed for Corner Checks.

### 4. Boost

- Boost adds to Speed for Corner Check calculations.

### 5. Validation Rules

- Ensure:
  - Track forms a closed loop.
  - No self-intersections.
  - All corners placed at valid Space boundaries.
  - Start/Finish line defined.

---

## 🎨 D. UI & Visualization

- Overlay discrete **Spaces** and **Spots** on Bezier path.
- Highlight **Race Line**.
- Visualize **Corner Lines** with Speed Limit badges.
- Toggle overlays:
  - Spaces grid
  - Corners
  - Start/Finish
- Interactive **Turn Simulator**:
  - Select car and input speed.
  - Step through the move.
  - Show:
    - Heat payments
    - Slipstream options
    - Spinouts
    - Final placement

---

## 🧪 E. Testing & Export

### 1. Validation Tools

- Check for:
  - Loop closure
  - Overlapping segments
  - Corner boundaries
  - Missing metadata

### 2. Test Runner

- Simulate turns or laps with AI drivers.
- Identify problematic corners (too tight, too forgiving).

### 3. Export Formats

- **Visual:**
  - PNG, PDF, SVG with grid and corner markers.
- **Data:**
  - JSON with:
    - Bezier control points
    - Space positions
    - Corner metadata
    - Start/Finish and lap data
- **Printable Layout:**
  - Auto-tile for A4/A3 pages.

---

## 💡 F. Optional / Advanced Features

- **Auto-suggest Corner Speed Limits** based on curvature.
- **Heat Management Visualizer** (color-coded by intensity).
- **Playtest AI** to evaluate pacing.
- **Expansion Support**:
  - Weather tokens
  - Chicanes
  - Tunnels
- **Community Features**:
  - Online gallery
  - Sharing links
  - Versioned edits

---

## 🧰 G. Technical Implementation Notes

| Layer           | Recommendation                                 |
| --------------- | ---------------------------------------------- |
| **Frontend**    | React, SvelteKit, or Next.js                   |
| **Graphics**    | Canvas API, Pixi.js, or Three.js               |
| **Geometry**    | Bezier.js or Paper.js for curve math           |
| **Backend**     | Node.js + Express/NestJS or Firebase Functions |
| **Database**    | Firestore, Supabase, or MongoDB                |
| **Auth**        | Firebase Auth / Supabase Auth / Auth0          |
| **Export**      | jsPDF, html2canvas, or SVG.js                  |
| **File Format** | JSON (Bezier + Spaces + Corners + Metadata)    |

---

## 🧭 H. MVP Scope (Recommended Build Order)

1. **Bezier Curve Editor** – Draw and edit centerline.
2. **Space Discretization** – Sample curve into Spaces and Spots.
3. **Corner Lines** – Manual placement + Speed Limits.
4. **Track Validation** – Closed loop, no overlaps, valid corners.
5. **Export** – PNG/SVG and JSON.
6. _(Later)_ Add Heat visualization, AI simulation, and online sharing.
