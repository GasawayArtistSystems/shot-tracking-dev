// X-Sheet interactive grid: loads /xsheet/<id>, renders an editable frame
// grid, and wires Save / snapshot history / instructor annotation.
// Explicit-save model -- nothing here autosaves. Share-for-Feedback no
// longer has its own button -- the dashboard's Submit Planning modal
// triggers it automatically by loading this page in a hidden iframe with
// ?autoShare=1 (see shareXsheetForFeedback() in
// dashboard_individual_assignments.js), so it runs once at submission time
// instead of needing a separate manual step.
(() => {
  const root = document.getElementById("xsheet-root");
  if (!root) return;

  const individualAssignmentId = root.dataset.individualAssignmentId;
  const API = `/xsheet/${individualAssignmentId}`;

  const BREAKDOWN_COLORS = { BRK: "#166534", TW: "#854d0e" }; // green / yellow (tailwind 800s)
  const CATEGORY_LABELS = {
    blinks: "Blinks", hands: "Hands", tail: "Tail", legs: "Legs", camera: "Camera",
  };

  // Per-cell Sounds symbol mode: a single-frame shorthand for the same
  // symbol_type/direction the multi-frame "Add Symbol" range tool writes --
  // "one per cell" for a single frame, ranges still go through that tool.
  // Sounds is the only column that carries these (plus its phoneme letters);
  // Words/Blocking are plain freeform text.
  const SYMBOL_MODES = {
    hold: { symbol_type: "hold", direction: null },
    accent_settle: { symbol_type: "accent", direction: "settle" },
    accent_up: { symbol_type: "accent", direction: "up" },
    accent_down: { symbol_type: "accent", direction: "down" },
  };
  const SYMBOL_MODE_LABELS = { hold: "Hold", accent_settle: "Accent", accent_up: "Up", accent_down: "Down" };

  function symbolModeFor(sym) {
    if (!sym) return null;
    if (sym.symbol_type === "hold") return "hold";
    if (sym.direction === "up") return "accent_up";
    if (sym.direction === "down") return "accent_down";
    return "accent_settle";
  }

  let state = null; // last loaded sheet payload
  // Working copy of row data keyed by frame number, and symbols list --
  // mutated locally as the student types, only persisted on explicit Save.
  let rowData = {};
  let symbols = [];
  // Frames added via "+ Add Frames at End" that don't have real content yet.
  // Saved as empty xsheet_rows entries so the extended range survives a
  // reload (MAX(frame) already covers it -- no new "row count" column needed).
  let manualFrames = new Set();

  // Column add/rename/remove go through their own API endpoint and then
  // re-GET the whole sheet. That reload would otherwise wipe anything the
  // student has typed but not yet Saved (rowData/symbols/manualFrames are
  // local until Save). Snapshot those, reload, then overlay them back so a
  // structural change never costs unsaved work.
  async function reloadPreservingEdits() {
    const snapRowData = JSON.parse(JSON.stringify(rowData));
    const snapSymbols = symbols.map(s => ({ ...s }));
    const snapManual = new Set(manualFrames);

    await load();

    const colKeys = new Set(state.columns.map(c => c.column_key));
    for (const [frame, cols] of Object.entries(snapRowData)) {
      const merged = { ...(rowData[frame] || {}) };
      for (const [k, v] of Object.entries(cols)) {
        if (colKeys.has(k)) merged[k] = v; // drop data for a removed column
      }
      rowData[frame] = merged;
    }
    const soundsKeys = new Set(
      state.columns.filter(c => c.category === "sounds").map(c => c.column_key)
    );
    symbols = snapSymbols.filter(s => soundsKeys.has(s.column_key));
    for (const f of snapManual) manualFrames.add(f);

    renderTable();
  }

  // The live editing view always shows every frame continuously -- this is
  // only used to chunk "Share for Feedback" captures into 24-frame images
  // (matching how a physical x-sheet spans multiple pages), so a single
  // long sheet doesn't produce one oversized/clipped screenshot.
  const PAGE_SIZE = 24;

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function notify(message, isError) {
    if (window.Swal) {
      Swal.fire({ text: message, icon: isError ? "error" : "success", timer: isError ? undefined : 1500 });
    } else {
      if (isError) console.error(message); else console.log(message);
      alert(message);
    }
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function symbolGlyph(sym) {
    if (sym.symbol_type === "hold") return "│";
    if (sym.direction === "up") return "\\";
    if (sym.direction === "down") return "/";
    return "⌒"; // settle
  }

  function symbolAt(frame, columnKey) {
    return symbols.find(s => s.column_key === columnKey && frame >= s.frame_start && frame <= s.frame_end);
  }

  // Recomputed on every render, not just once at load -- state.row_count is
  // a snapshot from the server, but the student can add rows/symbols past
  // it locally before ever hitting Save, and those need a place to display.
  function effectiveRowCount() {
    let maxFrame = state.row_count || 0;
    for (const frame of Object.keys(rowData)) {
      const n = Number(frame);
      if (Object.values(rowData[frame] || {}).some(v => v !== "" && v != null)) {
        maxFrame = Math.max(maxFrame, n);
      }
    }
    for (const s of symbols) maxFrame = Math.max(maxFrame, s.frame_end);
    for (const f of manualFrames) maxFrame = Math.max(maxFrame, f);
    if (!state.frame_end) {
      // This assignment has no frame range configured (predates the X-sheet
      // migration, or the instructor never set one) -- fall back to a
      // usable default grid instead of a blank table. Assignments with a
      // real frame_end aren't padded past what the instructor set.
      maxFrame = Math.max(maxFrame, 24);
    }
    maxFrame = Math.max(maxFrame, state.frame_start || 1);
    return maxFrame;
  }

  function totalPages() {
    return Math.max(1, Math.ceil(effectiveRowCount() / PAGE_SIZE));
  }

  function renderAddColumnBar() {
    const bar = document.getElementById("xsheet-add-column-bar");
    const totalCols = state.columns.length;
    const atCap = totalCols >= 10;

    bar.innerHTML = `
      <span class="text-gray-400">${totalCols}/10 columns</span>
      <select id="xsheet-add-category" class="bg-gray-700 text-white rounded px-2 py-1" ${atCap ? "disabled" : ""}>
        ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}" style="background:#374151;color:#fff">${v}</option>`).join("")}
      </select>
      <input id="xsheet-add-name" type="text" placeholder="Column name"
             class="bg-gray-700 text-white rounded px-2 py-1" ${atCap ? "disabled" : ""} />
      <button id="xsheet-add-btn" type="button"
              class="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded" ${atCap ? "disabled" : ""}>
        + Add Column
      </button>
    `;

    document.getElementById("xsheet-add-btn").addEventListener("click", async () => {
      const category = document.getElementById("xsheet-add-category").value;
      const display_name = document.getElementById("xsheet-add-name").value.trim() || CATEGORY_LABELS[category];
      try {
        await fetchJSON(`${API}/columns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", category, display_name }),
        });
        await reloadPreservingEdits();
      } catch (e) {
        notify(e.message, true);
      }
    });
  }

  function renderHeader() {
    const thead = document.getElementById("xsheet-thead");
    const tr = document.createElement("tr");
    for (const col of state.columns) {
      const th = document.createElement("th");
      th.className = "border border-gray-700 px-2 py-1 text-left whitespace-nowrap";
      const canEdit = !["frame", "words", "sounds", "blocking"].includes(col.category);
      th.innerHTML = `
        <span class="font-semibold">${col.display_name}</span>
        ${canEdit ? `
          <button data-rename="${col.column_key}" title="Rename" class="ml-1 text-gray-400 hover:text-white">✎</button>
          ${col.category !== "notes" ? `<button data-remove="${col.column_key}" title="Remove" class="ml-1 text-red-400 hover:text-red-300">✕</button>` : ""}
        ` : ""}
      `;
      tr.appendChild(th);
    }
    thead.innerHTML = "";
    thead.appendChild(tr);

    thead.querySelectorAll("[data-rename]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.rename;
        const current = state.columns.find(c => c.column_key === key);
        const name = prompt("New column name:", current.display_name);
        if (!name) return;
        try {
          await fetchJSON(`${API}/columns`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "rename", column_key: key, display_name: name }),
          });
          await reloadPreservingEdits();
        } catch (e) { notify(e.message, true); }
      });
    });
    thead.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this column? This deletes any symbols on it too.")) return;
        try {
          await fetchJSON(`${API}/columns`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "remove", column_key: btn.dataset.remove }),
          });
          await reloadPreservingEdits();
        } catch (e) { notify(e.message, true); }
      });
    });
  }

  function cellForColumn(frame, col) {
    const key = col.column_key;
    const val = (rowData[frame] || {})[key] ?? "";

    if (col.category === "frame") {
      // Right-click target for the insert/delete-frame context menu (owner
      // only -- the menu itself no-ops for staff). data-frame-cell carries
      // the frame the menu should act on.
      return `<td class="xsheet-frame-cell border border-gray-700 px-2 py-1 text-center text-gray-400 cursor-context-menu"
                  data-frame-cell="${frame}" title="Right-click to insert or delete frames here">${frame}</td>`;
    }

    if (col.category === "sounds") {
      const sym = symbolAt(frame, key);
      const isMultiFrameSpan = sym && sym.frame_start !== sym.frame_end;
      if (isMultiFrameSpan) {
        // Part of a range added via the "Add Symbol" tool below -- only
        // editable/removable as a whole from that tool's chip list, not
        // per-cell.
        const isStart = sym.frame_start === frame;
        return `<td class="border border-gray-700 px-2 py-1 text-center text-yellow-300" title="${sym.symbol_type}${sym.direction ? ' ' + sym.direction : ''}">
          ${isStart ? symbolGlyph(sym) : "│"}
        </td>`;
      }

      // One combined dropdown: phoneme letters AND Hold/Accent/Up/Down
      // symbols. Selecting a letter stores a value like before; selecting
      // a symbol mode writes a one-frame symbol instead -- mutually
      // exclusive, same as the range tool below.
      const mode = symbolModeFor(sym);
      const selected = mode || val;
      const letterOpts = ["", ...state.phonemes].map(p =>
        `<option value="${p}" ${p === selected ? "selected" : ""} style="background:#1f2937;color:#fff">${p || "—"}</option>`
      ).join("");
      const symbolOpts = Object.entries(SYMBOL_MODES).map(([m, spec]) =>
        `<option value="${m}" ${m === selected ? "selected" : ""} title="${SYMBOL_MODE_LABELS[m]}" style="background:#374151;color:#fde047">${symbolGlyph(spec)}</option>`
      ).join("");

      return `<td class="border border-gray-700 p-0">
        <select data-frame="${frame}" data-col="${key}" class="xsheet-sounds-cell w-full bg-transparent text-white text-center px-1 py-1">${letterOpts}${symbolOpts}</select>
      </td>`;
    }

    if (col.category === "breakdown_tween") {
      // Options need their own explicit background/color -- the select's
      // text-white class doesn't carry into the browser's native option
      // popup, which otherwise falls back to white-on-white.
      const opts = ["", "BRK", "TW"].map(v =>
        `<option value="${v}" ${v === val ? "selected" : ""} style="background:${BREAKDOWN_COLORS[v] || "#1f2937"};color:#fff">${v || "—"}</option>`
      ).join("");
      const bg = BREAKDOWN_COLORS[val] || "transparent";
      return `<td class="border border-gray-700 p-0" style="background:${bg}">
        <select data-frame="${frame}" data-col="${key}" class="xsheet-cell w-full bg-transparent text-white px-1 py-1">${opts}</select>
      </td>`;
    }

    if (col.category === "blocking") {
      // Plain freeform text, centered -- no dropdown, no symbols.
      return `<td class="border border-gray-700 p-0">
        <input data-frame="${frame}" data-col="${key}" type="text" value="${val}"
               class="xsheet-cell w-full bg-transparent text-white text-center px-1 py-1" />
      </td>`;
    }

    if (col.category === "notes") {
      // Textarea so long notes wrap instead of scrolling off sideways;
      // auto-grows with content via the resize listener wired in renderTable.
      return `<td class="border border-gray-700 p-0">
        <textarea data-frame="${frame}" data-col="${key}" rows="1"
                  class="xsheet-cell xsheet-notes-cell w-full bg-transparent text-white px-1 py-1 resize-none overflow-hidden align-top">${escapeHtml(val)}</textarea>
      </td>`;
    }

    // words / student-added categories: plain text
    return `<td class="border border-gray-700 p-0">
      <input data-frame="${frame}" data-col="${key}" type="text" value="${val}"
             class="xsheet-cell w-full bg-transparent text-white px-1 py-1" />
    </td>`;
  }


  function renderTable() {
    renderHeader();
    const tbody = document.getElementById("xsheet-tbody");
    const rows = [];
    const rowCount = effectiveRowCount();
    for (let frame = state.frame_start || 1; frame <= rowCount; frame++) {
      rows.push(`<tr>${state.columns.map(col => cellForColumn(frame, col)).join("")}</tr>`);
    }
    tbody.innerHTML = rows.join("");

    tbody.querySelectorAll(".xsheet-cell").forEach(el => {
      el.addEventListener("change", () => {
        const frame = el.dataset.frame;
        const col = el.dataset.col;
        rowData[frame] = rowData[frame] || {};
        rowData[frame][col] = el.value;
      });
    });

    tbody.querySelectorAll(".xsheet-notes-cell").forEach(el => {
      const autoGrow = () => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      };
      autoGrow();
      el.addEventListener("input", autoGrow);
    });

    tbody.querySelectorAll(".xsheet-sounds-cell").forEach(el => {
      el.addEventListener("change", () => {
        const frame = Number(el.dataset.frame);
        const col = el.dataset.col;

        // Mutually exclusive: picking a letter or a symbol mode always
        // clears whichever of the two this single frame+column previously held.
        symbols = symbols.filter(s => !(s.column_key === col && s.frame_start === frame && s.frame_end === frame));
        if (rowData[frame]) delete rowData[frame][col];

        const spec = SYMBOL_MODES[el.value];
        if (spec) {
          symbols.push({ column_key: col, frame_start: frame, frame_end: frame, ...spec });
        } else if (el.value) {
          rowData[frame] = rowData[frame] || {};
          rowData[frame][col] = el.value;
        }
        renderTable();
      });
    });

    if (state.is_owner) {
      tbody.querySelectorAll(".xsheet-frame-cell").forEach(el => {
        el.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          openFrameMenu(Number(el.dataset.frameCell), e.clientX, e.clientY);
        });
      });
    }
  }

  function collectRowsForSave() {
    const rows = [];
    for (let frame = state.frame_start || 1; frame <= effectiveRowCount(); frame++) {
      const data = rowData[frame];
      const hasContent = data && Object.values(data).some(v => v !== "" && v != null);
      // Manually-added blank frames still get an (empty) row so the
      // extended range survives a reload, not just this session.
      if (hasContent || manualFrames.has(frame)) {
        rows.push({ frame: Number(frame), data: data || {} });
      }
    }
    return rows;
  }

  async function save() {
    try {
      await fetchJSON(`${API}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: collectRowsForSave(), symbols }),
      });
      notify("X-sheet saved.");
    } catch (e) {
      notify(e.message, true);
    }
  }

  // Draws a page of the sheet directly onto a canvas from rowData/symbols/
  // columns -- no DOM screenshotting at all, so there's nothing for a
  // browser/CSS quirk (native <select> rendering, responsive breakpoints,
  // scrollbars) to get wrong. Fully self-contained per page.
  const EXPORT_STYLE = {
    bg: "#111827",
    headerBg: "#1f2937",
    border: "#374151",
    text: "#e5e7eb",
    dimText: "#9ca3af",
    symbolText: "#fde047",
    font: "13px Arial, sans-serif",
    headerFont: "bold 13px Arial, sans-serif",
  };
  const EXPORT_COL_WIDTH = {
    frame: 50, words: 140, sounds: 90, blocking: 140,
    breakdown_tween: 110, notes: 220,
    blinks: 100, hands: 100, tail: 100, legs: 100, camera: 100,
  };
  const PADDING = 6;
  const LINE_HEIGHT = 14;
  const HEADER_HEIGHT = 30;
  const BASE_ROW_HEIGHT = 24;

  function exportColWidth(col) {
    return EXPORT_COL_WIDTH[col.category] || 120;
  }

  function truncateText(ctx, text, maxWidth) {
    if (!text) return "";
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
    return t + "…";
  }

  function wrapText(ctx, text, maxWidth) {
    if (!text) return [""];
    const words = String(text).split(/\s+/);
    const lines = [];
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  // Same display rules as cellForColumn, but returns plain data (lines to
  // draw, color, alignment, background) instead of interactive markup.
  function exportCellContent(frame, col, ctx, innerWidth) {
    const key = col.column_key;
    const val = (rowData[frame] || {})[key] ?? "";

    if (col.category === "frame") {
      return { lines: [String(frame)], color: EXPORT_STYLE.dimText, align: "center" };
    }

    if (col.category === "sounds") {
      const sym = symbolAt(frame, key);
      const isMultiFrameSpan = sym && sym.frame_start !== sym.frame_end;
      if (isMultiFrameSpan) {
        const isStart = sym.frame_start === frame;
        return { lines: [isStart ? symbolGlyph(sym) : "│"], color: EXPORT_STYLE.symbolText, align: "center" };
      }
      const mode = symbolModeFor(sym);
      if (mode) return { lines: [symbolGlyph(SYMBOL_MODES[mode])], color: EXPORT_STYLE.symbolText, align: "center" };
      return { lines: [val || "—"], color: EXPORT_STYLE.text, align: "center" };
    }

    if (col.category === "breakdown_tween") {
      return { lines: [val || "—"], color: "#fff", align: "center", bg: BREAKDOWN_COLORS[val] };
    }

    if (col.category === "blocking") {
      return { lines: [truncateText(ctx, val, innerWidth)], color: EXPORT_STYLE.text, align: "center" };
    }

    if (col.category === "notes") {
      return { lines: wrapText(ctx, val, innerWidth), color: EXPORT_STYLE.text, align: "left" };
    }

    // words / student-added categories: single line, matching their
    // single-line <input> in the live view.
    return { lines: [truncateText(ctx, val, innerWidth)], color: EXPORT_STYLE.text, align: "left" };
  }

  function renderExportCanvas(pageStart, pageEnd) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const cols = state.columns;
    const colWidths = cols.map(exportColWidth);
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    ctx.font = EXPORT_STYLE.font;
    const rows = [];
    for (let frame = pageStart; frame <= pageEnd; frame++) {
      const cells = cols.map((col, i) => exportCellContent(frame, col, ctx, colWidths[i] - PADDING * 2));
      const lineCount = Math.max(1, ...cells.map(c => c.lines.length));
      rows.push({ cells, rowHeight: Math.max(BASE_ROW_HEIGHT, lineCount * LINE_HEIGHT + PADDING) });
    }
    const totalHeight = HEADER_HEIGHT + rows.reduce((sum, r) => sum + r.rowHeight, 0);

    canvas.width = totalWidth;
    canvas.height = totalHeight;
    // Resizing a canvas resets its context state (fillStyle/font/etc), so
    // everything below is set fresh rather than reused from the pass above.
    ctx.fillStyle = EXPORT_STYLE.bg;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    ctx.fillStyle = EXPORT_STYLE.headerBg;
    ctx.fillRect(0, 0, totalWidth, HEADER_HEIGHT);
    ctx.font = EXPORT_STYLE.headerFont;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let x = 0;
    cols.forEach((col, i) => {
      ctx.fillText(truncateText(ctx, col.display_name, colWidths[i] - PADDING * 2), x + PADDING, HEADER_HEIGHT / 2);
      x += colWidths[i];
    });

    ctx.strokeStyle = EXPORT_STYLE.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    x = 0;
    for (const w of colWidths) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, totalHeight);
      x += w;
    }
    ctx.moveTo(totalWidth - 0.5, 0);
    ctx.lineTo(totalWidth - 0.5, totalHeight);
    ctx.stroke();

    ctx.font = EXPORT_STYLE.font;
    let y = HEADER_HEIGHT;
    for (const row of rows) {
      ctx.strokeStyle = EXPORT_STYLE.border;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(totalWidth, y + 0.5);
      ctx.stroke();

      x = 0;
      row.cells.forEach((cell, i) => {
        const w = colWidths[i];
        if (cell.bg) {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(x, y, w, row.rowHeight);
        }
        ctx.fillStyle = cell.color;
        ctx.textAlign = cell.align;
        ctx.textBaseline = "middle";
        const tx = cell.align === "center" ? x + w / 2 : x + PADDING;
        const textBlockHeight = cell.lines.length * LINE_HEIGHT;
        let ty = y + (row.rowHeight - textBlockHeight) / 2 + LINE_HEIGHT / 2;
        for (const line of cell.lines) {
          ctx.fillText(line, tx, ty);
          ty += LINE_HEIGHT;
        }
        x += w;
      });
      y += row.rowHeight;
    }

    ctx.beginPath();
    ctx.moveTo(0, totalHeight - 0.5);
    ctx.lineTo(totalWidth, totalHeight - 0.5);
    ctx.stroke();

    return canvas;
  }

  async function shareForFeedback() {
    const rowCount = effectiveRowCount();
    const pages = totalPages();

    for (let page = 0; page < pages; page++) {
      const pageStart = (state.frame_start || 1) + page * PAGE_SIZE;
      const pageEnd = Math.min(pageStart + PAGE_SIZE - 1, rowCount);

      const canvas = renderExportCanvas(pageStart, pageEnd);
      const image_data = canvas.toDataURL("image/png");

      await fetchJSON(`${API}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data }),
      });
    }
    // Saved as planning_files rows -- they show up in the same Markup
    // Sidebar as hand-drawn Planning pages, where an instructor can open
    // and annotate them the same way they already do for those.
  }

  async function load() {
    // Fetch first, mutate second: if the request fails, the in-memory
    // sheet (including anything typed but not yet Saved) is left untouched
    // rather than being blanked and then left blank for the next Save.
    const next = await fetchJSON(API);
    state = next;
    rowData = {};
    for (const r of state.rows) rowData[r.frame] = r.data;

    // Drop any symbols left over on columns that can no longer carry them
    // (e.g. Blocking, from before symbols were narrowed to Sounds-only) --
    // otherwise they'd get silently resubmitted on every Save and the
    // server would reject the whole save because of stale data the UI
    // doesn't even expose a way to see or remove anymore.
    const soundsKeys = new Set(state.columns.filter(c => c.category === "sounds").map(c => c.column_key));
    symbols = state.symbols.filter(s => soundsKeys.has(s.column_key)).map(s => ({ ...s }));

    manualFrames = new Set();

    document.getElementById("xsheet-assignment-name").textContent = state.assignment_name;
    const frameHint = document.getElementById("xsheet-frame-hint");
    if (frameHint) frameHint.classList.toggle("hidden", !state.is_owner);
    renderAddColumnBar();
    renderTable();
  }

  document.getElementById("xsheet-save-btn").addEventListener("click", save);
  document.getElementById("xsheet-add-frames-btn").addEventListener("click", () => {
    const input = document.getElementById("xsheet-add-frames-count");
    const n = parseInt(input.value, 10);
    if (!Number.isInteger(n) || n < 1) {
      notify("Enter a valid number of frames to add.", true);
      return;
    }
    const start = effectiveRowCount() + 1;
    for (let f = start; f < start + n; f++) manualFrames.add(f);
    renderTable();
  });

  // Insert N blank frames after a given frame, shifting every later frame's
  // row data and symbol spans down by N. Purely a local remap -- persisted
  // on the next Save like any other edit.
  function insertFrames(afterFrame, count) {
    const shift = f => (f > afterFrame ? f + count : f);

    const shifted = {};
    for (const [frame, cols] of Object.entries(rowData)) {
      shifted[shift(Number(frame))] = cols;
    }
    rowData = shifted;

    symbols = symbols.map(s => ({
      ...s,
      frame_start: shift(s.frame_start),
      frame_end: shift(s.frame_end),
    }));

    const shiftedManual = new Set();
    for (const f of manualFrames) shiftedManual.add(shift(f));
    // The freshly opened gap frames persist as blank rows so the inserted
    // range survives a reload even before anything is typed into it.
    for (let i = 1; i <= count; i++) shiftedManual.add(afterFrame + i);
    manualFrames = shiftedManual;

    renderTable();
  }

  // Remove one frame, pulling every later frame (and symbol span) up by 1.
  // Destructive of whatever was on that frame, so callers confirm first.
  function deleteFrame(frame) {
    const pulled = {};
    for (const [f, cols] of Object.entries(rowData)) {
      const n = Number(f);
      if (n === frame) continue;
      pulled[n > frame ? n - 1 : n] = cols;
    }
    rowData = pulled;

    symbols = symbols
      .map(s => {
        let { frame_start, frame_end } = s;
        if (frame_start > frame) frame_start -= 1;
        if (frame_end >= frame) frame_end -= 1;
        return { ...s, frame_start, frame_end };
      })
      .filter(s => s.frame_end >= s.frame_start);

    const pulledManual = new Set();
    for (const f of manualFrames) {
      if (f === frame) continue;
      pulledManual.add(f > frame ? f - 1 : f);
    }
    manualFrames = pulledManual;

    renderTable();
  }

  // --- Right-click "insert / delete frames" menu (Frame column only) ---
  const frameMenu = document.getElementById("xsheet-context-menu");
  let frameMenuFrame = null; // frame the currently-open menu acts on

  function closeFrameMenu() {
    if (frameMenu) frameMenu.classList.add("hidden");
    frameMenuFrame = null;
  }

  function promptCount(verb) {
    const raw = prompt(`How many frames to ${verb}?`, "1");
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 1) {
      notify("Enter a whole number of 1 or more.", true);
      return null;
    }
    return n;
  }

  const FRAME_MENU_ITEMS = [
    { label: "Insert 1 frame above", run: (f) => insertFrames(f - 1, 1) },
    { label: "Insert 1 frame below", run: (f) => insertFrames(f, 1) },
    { label: "Insert frames above…", run: (f) => { const n = promptCount("insert"); if (n) insertFrames(f - 1, n); } },
    { label: "Insert frames below…", run: (f) => { const n = promptCount("insert"); if (n) insertFrames(f, n); } },
    { divider: true },
    {
      label: "Delete this frame", danger: true,
      run: (f) => {
        if (!confirm(`Delete frame ${f}? Anything on it is removed and every later frame shifts up by one.`)) return;
        deleteFrame(f);
        notify(`Deleted frame ${f}. Save to keep the change.`);
      },
    },
  ];

  function openFrameMenu(frame, x, y) {
    if (!frameMenu) return;
    frameMenuFrame = frame;

    frameMenu.innerHTML = "";
    for (const item of FRAME_MENU_ITEMS) {
      if (item.divider) {
        const hr = document.createElement("div");
        hr.className = "my-1 border-t border-gray-600";
        frameMenu.appendChild(hr);
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;
      btn.className = "block w-full px-3 py-1.5 text-left hover:bg-gray-700 " +
        (item.danger ? "text-red-400 hover:text-red-300" : "");
      btn.addEventListener("click", () => {
        const f = frameMenuFrame;
        closeFrameMenu();
        item.run(f);
      });
      frameMenu.appendChild(btn);
    }

    // Show off-screen first to measure, then clamp inside the viewport.
    frameMenu.classList.remove("hidden");
    frameMenu.style.left = "0px";
    frameMenu.style.top = "0px";
    const rect = frameMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 4);
    const top = Math.min(y, window.innerHeight - rect.height - 4);
    frameMenu.style.left = `${Math.max(4, left)}px`;
    frameMenu.style.top = `${Math.max(4, top)}px`;
  }

  document.addEventListener("click", (e) => {
    if (frameMenu && !frameMenu.contains(e.target)) closeFrameMenu();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeFrameMenu(); });
  window.addEventListener("scroll", closeFrameMenu, true);
  window.addEventListener("resize", closeFrameMenu);

  // Guarded: if a cached/older xsheet.html is served alongside this script,
  // these elements won't exist -- skip wiring rather than throwing and
  // breaking the whole sheet (Save, Add Frames, load()).
  const insertBtn = document.getElementById("xsheet-insert-frames-btn");
  if (insertBtn) insertBtn.addEventListener("click", () => {
    const count = parseInt(document.getElementById("xsheet-insert-count").value, 10);
    const afterFrame = parseInt(document.getElementById("xsheet-insert-after").value, 10);
    const minAfter = (state.frame_start || 1) - 1;
    if (!Number.isInteger(count) || count < 1) {
      notify("Enter a valid number of frames to insert.", true);
      return;
    }
    if (!Number.isInteger(afterFrame) || afterFrame < minAfter || afterFrame > effectiveRowCount()) {
      notify(`Enter a frame between ${minAfter} and ${effectiveRowCount()} to insert after.`, true);
      return;
    }
    insertFrames(afterFrame, count);
    notify(`Inserted ${count} frame${count > 1 ? "s" : ""} after frame ${afterFrame}. Save to keep the change.`);
  });

  // Loaded inside a hidden iframe by the dashboard's Submit Planning flow
  // (shareXsheetForFeedback() in dashboard_individual_assignments.js) to
  // run the same capture Share-for-Feedback used to do, without needing a
  // visible page or a manual click. Report success/failure back to whoever
  // embedded us so that flow knows whether to proceed with the submit.
  const autoShare = new URLSearchParams(window.location.search).get("autoShare") === "1";

  load()
    .then(async () => {
      if (!autoShare) return;
      try {
        await shareForFeedback();
        window.parent.postMessage(
          { type: "xsheet-auto-share", ok: true, individualAssignmentId },
          window.location.origin
        );
      } catch (e) {
        window.parent.postMessage(
          { type: "xsheet-auto-share", ok: false, error: e.message, individualAssignmentId },
          window.location.origin
        );
      }
    })
    .catch(e => {
      notify(e.message, true);
      if (autoShare) {
        window.parent.postMessage(
          { type: "xsheet-auto-share", ok: false, error: e.message, individualAssignmentId },
          window.location.origin
        );
      }
    });
})();
