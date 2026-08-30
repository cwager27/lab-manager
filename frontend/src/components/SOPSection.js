import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';

const CELL_PALETTE = [
  '#ffffff', '#f5f5f5', '#e0e0e0', '#bdbdbd',
  '#fff9c4', '#ffee58', '#fdd835', '#f9a825',
  '#c8e6c9', '#81c784', '#43a047', '#2e7d32',
  '#bbdefb', '#64b5f6', '#1e88e5', '#1565c0',
  '#e1bee7', '#ce93d8', '#ab47bc', '#6a1b9a',
  '#ffcdd2', '#ef9a9a', '#e53935', '#b71c1c',
  '#b2ebf2', '#4dd0e1', '#00acc1', '#00838f',
];

function cellPosKey(cell, container) {
  try {
    const tr = cell.parentElement;
    const section = tr.parentElement;
    const table = section.parentElement;
    const tables = Array.from(container.querySelectorAll('table'));
    const ti = tables.indexOf(table);
    const ri = Array.from(section.children).indexOf(tr);
    const ci = Array.from(tr.children).indexOf(cell);
    const si = section.tagName === 'THEAD' ? 'h' : 'b';
    return `t${ti >= 0 ? ti : 0}${si}r${ri}c${ci}`;
  } catch { return `cell${Math.random()}`; }
}

export function TableCellContextMenu({ x, y, onPickColor, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key  = e => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  return (
    <div ref={ref} contentEditable={false} onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9002, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 12px', minWidth: 196 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Cell background color</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 4 }}>
        {CELL_PALETTE.map(c => (
          <button key={c} onClick={() => { onPickColor(c); onClose(); }}
            style={{ width: 22, height: 22, borderRadius: 3, background: c, border: '1.5px solid #ccc', cursor: 'pointer', padding: 0 }} title={c} />
        ))}
        <label title="Custom color" style={{ width: 22, height: 22, borderRadius: 3, border: '1.5px dashed #aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#aaa', position: 'relative' }}>
          +
          <input type="color" onInput={e => { onPickColor(e.target.value); onClose(); }}
            style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }} />
        </label>
      </div>
    </div>
  );
}

export function useTableCellColors(containerRef, canEdit, storageKey) {
  const [cellMenu, setCellMenu] = useState(null);

  const applyStoredColors = useCallback(() => {
    if (!containerRef.current || !storageKey) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (!Object.keys(stored).length) return;
      containerRef.current.querySelectorAll('td, th').forEach(cell => {
        const k = cellPosKey(cell, containerRef.current);
        if (stored[k]) cell.style.backgroundColor = stored[k];
      });
    } catch {}
  }, [containerRef, storageKey]); // eslint-disable-line

  useLayoutEffect(() => { applyStoredColors(); }); // eslint-disable-line

  useEffect(() => {
    if (!canEdit) return;
    const container = containerRef.current;
    if (!container) return;
    function handler(e) {
      const cell = e.target.closest('td, th');
      if (!cell || !container.contains(cell)) return;
      e.preventDefault();
      e.stopPropagation();
      const cells = new Set([cell]);
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const table = cell.closest('table');
        if (table) table.querySelectorAll('td, th').forEach(c => {
          try { if (sel.containsNode(c, true)) cells.add(c); } catch {}
        });
      }
      setCellMenu({ x: e.clientX, y: e.clientY, cells: [...cells] });
    }
    container.addEventListener('contextmenu', handler, true);
    return () => container.removeEventListener('contextmenu', handler, true);
  }, [canEdit, containerRef]); // eslint-disable-line

  function pickCellColor(color) {
    if (!cellMenu) return;
    const stored = {};
    try { Object.assign(stored, JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch {}
    cellMenu.cells.forEach(cell => {
      cell.style.backgroundColor = color;
      if (storageKey && containerRef.current) stored[cellPosKey(cell, containerRef.current)] = color;
    });
    if (storageKey) try { localStorage.setItem(storageKey, JSON.stringify(stored)); } catch {}
    setCellMenu(null);
  }

  return { cellMenu, closeCellMenu: () => setCellMenu(null), pickCellColor };
}

export const PALETTE = [
  '#ffffff', '#f5f5f5',
  '#e8f5e9', '#d4edda',
  '#e3f2fd', '#cce5ff',
  '#f3e5f5', '#e2d9f3',
  '#fffde7', '#fff3e0',
  '#fce4ec', '#e0f7fa',
];

// ── Shared SectionContextMenu ─────────────────────────────────────────────────
export function SectionContextMenu({ x, y, onAddAbove, onAddBelow, onMoveUp, onMoveDown, onDelete, onAddSubsection, onChangeBgColor, onClose }) {
  const ref = useRef(null);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key  = e => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const Btn = ({ label, action, disabled, danger }) => (
    <button
      onClick={() => { if (!disabled && action) { action(); onClose(); } }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      style={{ display: 'block', width: '100%', padding: '7px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: disabled ? 'default' : 'pointer', color: danger ? '#e74c3c' : 'var(--text-primary)', opacity: disabled ? 0.45 : 1 }}>
      {label}
    </button>
  );
  const Sep = () => <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />;

  return (
    <div ref={ref} contentEditable={false} onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9000, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 210 }}>
      <Btn label="Add section above" action={onAddAbove} />
      <Btn label="Add section below" action={onAddBelow} />
      {onAddSubsection && <Btn label="Add subsection" action={onAddSubsection} />}
      <Sep />
      <Btn label="Move section up"   action={onMoveUp}   disabled={!onMoveUp} />
      <Btn label="Move section down" action={onMoveDown} disabled={!onMoveDown} />
      <Sep />
      {/* Background color */}
      <button
        onClick={() => setShowColors(v => !v)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
        Change background color
        <span style={{ fontSize: 10 }}>{showColors ? '▲' : '▼'}</span>
      </button>
      {showColors && (
        <div style={{ padding: '4px 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => { onChangeBgColor(c); onClose(); }}
              style={{ width: 22, height: 22, borderRadius: 4, background: c, border: '1.5px solid #ccc', cursor: 'pointer', padding: 0, flexShrink: 0 }} title={c} />
          ))}
          <label title="Custom color" style={{ width: 22, height: 22, borderRadius: 4, border: '1.5px dashed #aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#aaa', position: 'relative', flexShrink: 0 }}>
            +
            <input type="color" onInput={e => { onChangeBgColor(e.target.value); onClose(); }}
              style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }} />
          </label>
        </div>
      )}
      {onDelete && (
        <>
          <Sep />
          <Btn label="Delete section" action={onDelete} danger />
        </>
      )}
    </div>
  );
}

// ── Subsection context menu ───────────────────────────────────────────────────
function SubsectionCtxMenu({ x, y, onChangeBgColor, onDelete, onClose }) {
  const ref = useRef(null);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key  = e => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const Sep = () => <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />;

  return (
    <div ref={ref} contentEditable={false} onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9001, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 210 }}>
      <button
        onClick={() => setShowColors(v => !v)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
        Change subsection color
        <span style={{ fontSize: 10 }}>{showColors ? '▲' : '▼'}</span>
      </button>
      {showColors && (
        <div style={{ padding: '4px 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => { onChangeBgColor(c); onClose(); }}
              style={{ width: 22, height: 22, borderRadius: 4, background: c, border: '1.5px solid #ccc', cursor: 'pointer', padding: 0, flexShrink: 0 }} title={c} />
          ))}
          <label title="Custom color" style={{ width: 22, height: 22, borderRadius: 4, border: '1.5px dashed #aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#aaa', position: 'relative', flexShrink: 0 }}>
            +
            <input type="color" onInput={e => { onChangeBgColor(e.target.value); onClose(); }}
              style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }} />
          </label>
        </div>
      )}
      <Sep />
      <button
        onClick={() => { onDelete(); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{ display: 'block', width: '100%', padding: '7px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', color: '#e74c3c' }}>
        Delete subsection
      </button>
    </div>
  );
}

// ── SubsectionBlock ───────────────────────────────────────────────────────────
export function SubsectionBlock({ sub, canEdit, onContentChange, onChangeBgColor, onDelete }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const cbRef = useRef(onContentChange);
  const [ctx, setCtx] = useState(null);

  useEffect(() => { cbRef.current = onContentChange; });
  useEffect(() => { if (ref.current) ref.current.innerHTML = sub.content || ''; }, []); // eslint-disable-line
  useEffect(() => {
    if (!ref.current || !canEdit) return;
    const el = ref.current;
    const observer = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => cbRef.current(el.innerHTML), 600);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    return () => { observer.disconnect(); clearTimeout(timer.current); };
  }, [canEdit]); // eslint-disable-line

  const bg = sub.bgColor || '#e8f5e9';

  return (
    <div style={{ position: 'relative', margin: '12px 0' }}
      onMouseDown={ctx ? () => setCtx(null) : undefined}>
      <div
        ref={ref}
        contentEditable={canEdit || undefined}
        suppressContentEditableWarning={canEdit}
        onContextMenu={canEdit ? e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY }); } : undefined}
        style={{ background: bg, border: `1px solid ${darken(bg)}`, borderRadius: 8, padding: '14px 16px', outline: 'none', minHeight: 40, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75 }}
      />
      {ctx && canEdit && (
        <SubsectionCtxMenu
          x={ctx.x} y={ctx.y}
          onChangeBgColor={color => onChangeBgColor(color)}
          onDelete={onDelete}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  );
}

// Slightly darken a hex color for borders
function darken(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`;
  } catch { return '#ccc'; }
}

// ── Tab input modal (replaces window.prompt) ──────────────────────────────────
export function TabInputModal({ title, defaultValue = '', onConfirm, onClose }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  function handleConfirm() { if (value.trim()) { onConfirm(value.trim()); onClose(); } }
  return (
    <div onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div contentEditable={false} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '24px', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{title}</div>
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)', background: 'var(--bg-primary)', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!value.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: value.trim() ? 'pointer' : 'default', opacity: value.trim() ? 1 : 0.5 }}>OK</button>
        </div>
      </div>
    </div>
  );
}

export function TabConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div contentEditable={false} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '24px', width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#e74c3c', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export function PillTabs({ tabs, active, onSelect, onContextMenu }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          onContextMenu={onContextMenu ? e => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, t.id); } : undefined}
          style={{ padding: '10px 20px', border: 'none', background: active === t.id ? 'var(--purple-primary)' : 'transparent', fontSize: 13, fontWeight: active === t.id ? 600 : 400, color: active === t.id ? 'white' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabContextMenu({ x, y, onAddLeft, onAddRight, onRename, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key  = e => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const Btn = ({ label, action, danger }) => (
    <button onClick={() => { action(); onClose(); }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      style={{ display: 'block', width: '100%', padding: '7px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', color: danger ? '#e74c3c' : 'var(--text-primary)' }}>
      {label}
    </button>
  );

  return (
    <div ref={ref} contentEditable={false} onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9010, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 190 }}>
      <Btn label="Add tab to left"  action={onAddLeft} />
      <Btn label="Add tab to right" action={onAddRight} />
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
      <Btn label="Rename tab" action={onRename} />
      {onDelete && <><div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} /><Btn label="Delete tab" action={onDelete} danger /></>}
    </div>
  );
}

// ── Subsection state helpers (call these in each SOP component) ───────────────
export function makeSubsectionHandlers(setSections) {
  return {
    addSubsection: (sectionId) => {
      const subId = `sub_${Date.now()}`;
      setSections(prev => prev.map(sec => sec.id === sectionId
        ? { ...sec, subsections: [...(sec.subsections || []), { id: subId, bgColor: '#e8f5e9', content: '' }] }
        : sec
      ));
    },
    deleteSubsection: (sectionId, subId) => {
      setSections(prev => prev.map(sec => sec.id === sectionId
        ? { ...sec, subsections: (sec.subsections || []).filter(s => s.id !== subId) }
        : sec
      ));
    },
    updateSubsectionContent: (sectionId, subId, content) => {
      setSections(prev => prev.map(sec => sec.id === sectionId
        ? { ...sec, subsections: (sec.subsections || []).map(s => s.id === subId ? { ...s, content } : s) }
        : sec
      ));
    },
    updateSubsectionBgColor: (sectionId, subId, bgColor) => {
      setSections(prev => prev.map(sec => sec.id === sectionId
        ? { ...sec, subsections: (sec.subsections || []).map(s => s.id === subId ? { ...s, bgColor } : s) }
        : sec
      ));
    },
    updateSectionBgColor: (sectionId, bgColor) => {
      setSections(prev => prev.map(sec => sec.id === sectionId ? { ...sec, bgColor } : sec));
    },
  };
}
