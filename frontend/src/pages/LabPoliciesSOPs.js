import { useState, useRef, useCallback, useEffect } from 'react';
import { TabInputModal, TabConfirmModal, PillTabs, TabContextMenu, SectionContextMenu, SubsectionBlock, makeSubsectionHandlers } from '../components/SOPSection';
import { useResizableColumns, ColResizer } from '../lib/useResizableColumns';
import { FileText, Clock, Printer, X, Plus, ExternalLink, Trash2, Link, Search } from 'lucide-react';
import LabPolicies from './LabPolicies';
import MeetingStandards from './MeetingStandards';
import BenchlingPolicy from './BenchlingPolicy';
import TissueCultureSOP from './TissueCultureSOP';
import OrderingSOP from './OrderingSOP';
import SampleNamingNomenclature from './SampleNamingNomenclature';
import MutationalSignaturesSOP from './MutationalSignaturesSOP';

// ── Shared toolbar (always visible) ──────────────────────────────────────────
function SOPToolbar({ editorRef, canEdit }) {
  const [fontColor, setFontColor] = useState('#000000');
  const [hlColor, setHlColor] = useState('#ffff00');
  const [fontSize, setFontSize] = useState('13');
  const [inputVal, setInputVal] = useState('13');
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ r: 0, c: 0 });
  const saveTimer = useRef(null);
  const savedRange = useRef(null);
  const linkWrapRef = useRef(null);
  const tablePickerRef = useRef(null);

  // Track current selection font size
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const node = sel.anchorNode;
      if (!editorRef.current || !editorRef.current.contains(node)) return;
      const el = node.nodeType === 3 ? node.parentElement : node;
      const size = Math.round(parseFloat(window.getComputedStyle(el).fontSize)) || 13;
      const str = String(size);
      setFontSize(str);
      setInputVal(str);
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [editorRef]);

  // Close link popover on outside click
  useEffect(() => {
    if (!showLink) return;
    const handler = e => { if (linkWrapRef.current && !linkWrapRef.current.contains(e.target)) setShowLink(false); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLink]);

  // Close table picker on outside click
  useEffect(() => {
    if (!showTablePicker) return;
    const handler = e => { if (tablePickerRef.current && !tablePickerRef.current.contains(e.target)) setShowTablePicker(false); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTablePicker]);

  function insertTable(rows, cols) {
    const ths = 'border:1px solid #5a1a8a;padding:8px 12px;min-width:60px;background:#7030a0;color:#ffffff;font-weight:700;text-align:left;';
    const tds = 'border:1px solid #ddd;padding:8px 12px;min-width:60px;color:#000000;vertical-align:top;';
    const headerRow = `<tr>${Array(cols).fill(`<th style="${ths}">&nbsp;</th>`).join('')}</tr>`;
    const dataRows = Array(Math.max(rows - 1, 0)).fill(`<tr>${Array(cols).fill(`<td style="${tds}">&nbsp;</td>`).join('')}</tr>`).join('');
    const tableHtml = `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${headerRow}${dataRows}</table><p><br></p>`;
    document.execCommand('insertHTML', false, tableHtml);
    setShowTablePicker(false);
    scheduleAutoSave();
  }

  function scheduleAutoSave() {
    if (!editorRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const id = editorRef.current?.dataset?.sopid;
      if (id) {
        try { localStorage.setItem(`sop_html_${id}`, editorRef.current.innerHTML); } catch {}
      }
    }, 600);
  }

  function cmd(command, value = null) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    scheduleAutoSave();
  }

  function applyFontSize(px) {
    const clamped = Math.max(6, Math.min(96, px));
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.getRangeAt(0).collapsed) return;
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('[size="7"]').forEach(el => {
      el.removeAttribute('size');
      el.style.fontSize = clamped + 'px';
    });
    const str = String(clamped);
    setFontSize(str);
    setInputVal(str);
    scheduleAutoSave();
  }

  function commitSize(val) {
    const n = parseInt(val, 10);
    if (!isNaN(n)) applyFontSize(n);
    else setInputVal(fontSize);
    editorRef.current?.focus();
  }

  function applyLink() {
    if (!savedRange.current || !linkUrl.trim()) return;
    const url = linkUrl.trim();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
    const text = savedRange.current.toString() || url;
    const isAnchor = url.startsWith('#');
    document.execCommand('insertHTML', false,
      `<a href="${url}"${isAnchor ? '' : ' target="_blank" rel="noopener noreferrer"'} style="color:var(--purple-primary)">${text}</a>`
    );
    setShowLink(false);
    setLinkUrl('');
    savedRange.current = null;
    scheduleAutoSave();
  }

  const tb = { padding: '4px 8px', fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-primary)' };
  const sep = <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px', display: 'inline-block', flexShrink: 0 }} />;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', padding: '5px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '6px 6px 0 0', position: 'sticky', top: 0, zIndex: 100 }}>
      {canEdit && (
        <>
          <button onMouseDown={e => { e.preventDefault(); cmd('bold'); }} style={{ ...tb, fontWeight: 900 }} title="Bold">B</button>
          <button onMouseDown={e => { e.preventDefault(); cmd('italic'); }} style={tb} title="Italic"><em>I</em></button>
          <button onMouseDown={e => { e.preventDefault(); cmd('underline'); }} style={{ ...tb, textDecoration: 'underline' }} title="Underline">U</button>
          {sep}
          {/* Font size: − [size] + */}
          <button
            onMouseDown={e => { e.preventDefault(); applyFontSize((parseInt(fontSize, 10) || 13) - 1); }}
            style={{ ...tb, padding: '4px 6px', fontWeight: 400 }} title="Decrease font size">−</button>
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={e => commitSize(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitSize(e.target.value); } }}
            style={{ width: 36, textAlign: 'center', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, padding: '3px 4px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            title="Font size"
          />
          <button
            onMouseDown={e => { e.preventDefault(); applyFontSize((parseInt(fontSize, 10) || 13) + 1); }}
            style={{ ...tb, padding: '4px 6px', fontWeight: 400 }} title="Increase font size">+</button>
          {sep}
          {/* Font color */}
          <label title="Font color" style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...tb, padding: '3px 7px', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1 }}>A</span>
              <span style={{ width: 14, height: 3, borderRadius: 1, background: fontColor, display: 'block' }} />
            </span>
            <input
              type="color"
              value={fontColor}
              onChange={e => {
                setFontColor(e.target.value);
                cmd('foreColor', e.target.value);
              }}
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }}
            />
          </label>
          {/* Highlight color */}
          <label title="Highlight color" style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...tb, padding: '3px 7px', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1, background: hlColor, padding: '0 2px', borderRadius: 1 }}>A</span>
            </span>
            <input
              type="color"
              value={hlColor}
              onChange={e => {
                setHlColor(e.target.value);
                cmd('hiliteColor', e.target.value);
              }}
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }}
            />
          </label>
          {sep}
          {/* Undo / Redo */}
          <button onMouseDown={e => { e.preventDefault(); cmd('undo'); }} style={tb} title="Undo (Cmd+Z)">↩</button>
          <button onMouseDown={e => { e.preventDefault(); cmd('redo'); }} style={tb} title="Redo (Cmd+Y)">↪</button>
          {sep}
          {/* Insert table */}
          <div ref={tablePickerRef} style={{ position: 'relative' }}>
            <button
              onMouseDown={e => { e.preventDefault(); setShowTablePicker(s => !s); setTableHover({ r: 0, c: 0 }); }}
              style={tb}
              title="Insert table"
            >⊞</button>
            {showTablePicker && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>
                  {tableHover.r > 0 && tableHover.c > 0 ? `${tableHover.r} × ${tableHover.c}` : 'Select table size'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 2 }}>
                  {Array.from({ length: 8 }, (_, r) =>
                    Array.from({ length: 8 }, (_, c) => (
                      <div
                        key={`${r}-${c}`}
                        onMouseEnter={() => setTableHover({ r: r + 1, c: c + 1 })}
                        onMouseDown={e => { e.preventDefault(); insertTable(r + 1, c + 1); }}
                        style={{ width: 18, height: 18, borderRadius: 2, border: '1px solid', borderColor: (r < tableHover.r && c < tableHover.c) ? 'var(--purple-primary)' : 'var(--border)', background: (r < tableHover.r && c < tableHover.c) ? 'rgba(112,48,160,0.15)' : 'var(--bg-secondary)', cursor: 'pointer' }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {sep}
          {/* Link */}
          <div ref={linkWrapRef} style={{ position: 'relative' }}>
            <button
              onMouseDown={e => {
                e.preventDefault();
                const sel = window.getSelection();
                if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
                  savedRange.current = sel.getRangeAt(0).cloneRange();
                }
                setLinkUrl('');
                setShowLink(s => !s);
              }}
              style={tb}
              title="Insert link"
            >
              <Link size={13} />
            </button>
            {showLink && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--purple-primary)', borderRadius: 8, padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 300, whiteSpace: 'nowrap' }}>
                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="Search or paste a link"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setShowLink(false); }}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text-primary)', minWidth: 200 }}
                  autoFocus
                />
                <button
                  onClick={applyLink}
                  style={{ fontSize: 12, background: 'none', border: 'none', cursor: linkUrl.trim() ? 'pointer' : 'default', color: linkUrl.trim() ? 'var(--text-primary)' : 'var(--text-muted)', padding: '2px 4px', flexShrink: 0 }}
                >Apply</button>
              </div>
            )}
          </div>
          {sep}
        </>
      )}
      <button onClick={() => {
        const el = editorRef.current;
        if (!el) return;
        // Clone so we can rewrite relative image src → absolute without mutating the live DOM
        const clone = el.cloneNode(true);
        clone.querySelectorAll('img').forEach(img => {
          if (img.src && !img.src.startsWith('data:')) {
            img.src = new URL(img.getAttribute('src'), window.location.href).href;
          }
        });
        const html = clone.innerHTML;
        const base = `${window.location.protocol}//${window.location.host}`;
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>Print</title>
          <base href="${base}">
          <style>
            body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 32px 48px; line-height: 1.7; }
            h1, h2, h3 { margin: 16px 0 8px; }
            img { max-width: 100%; height: auto; display: block; }
            table { border-collapse: collapse; width: 100%; margin: 12px 0; }
            td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 12px; }
            th { background: #f5f5f5; font-weight: 700; }
            ul, ol { padding-left: 24px; margin: 6px 0; }
            a { color: inherit; text-decoration: underline; }
            @media print { body { margin: 0; } }
          </style>
        </head><body>${html}</body></html>`);
        win.document.close();
        win.focus();
        // Wait for images to load before printing
        win.onload = () => { win.print(); win.close(); };
        setTimeout(() => { if (!win.closed) { win.print(); win.close(); } }, 2500);
      }} style={tb} title="Print / Download PDF"><Printer size={13} /></button>
    </div>
  );
}

// ── Rich-text editor wrapper ──────────────────────────────────────────────────
function SOPEditorWrapper({ id, children, canEdit, noHtmlRestore = false }) {
  const [savedHtml] = useState(() => {
    if (noHtmlRestore) return null;
    try { return localStorage.getItem(`sop_html_${id}`) || null; } catch { return null; }
  });
  const editorRef = useRef(null);
  const saveTimer = useRef(null);

  function scheduleAutoSave() {
    if (!canEdit || !editorRef.current || noHtmlRestore) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(`sop_html_${id}`, editorRef.current.innerHTML); } catch {}
    }, 600);
  }

  return (
    <div>
      <SOPToolbar editorRef={editorRef} canEdit={canEdit} />
      {savedHtml ? (
        <div
          ref={editorRef}
          data-sopid={id}
          contentEditable={canEdit || undefined}
          suppressContentEditableWarning={canEdit}
          onInput={canEdit ? scheduleAutoSave : undefined}
          style={{ outline: 'none', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '8px 4px' }}
          dangerouslySetInnerHTML={{ __html: savedHtml }}
        />
      ) : (
        <div
          ref={editorRef}
          data-sopid={id}
          contentEditable={canEdit || undefined}
          suppressContentEditableWarning={canEdit}
          onInput={canEdit ? scheduleAutoSave : undefined}
          style={{ outline: 'none', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '8px 4px' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Shared: floating context menu ────────────────────────────────────────────
function TableContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key  = e => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  // Clamp so menu never goes off-screen
  const style = {
    position: 'fixed', left: x, top: y, zIndex: 9999,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    minWidth: 220, overflow: 'hidden', padding: '4px 0',
  };

  return (
    <div ref={ref} style={style} onMouseDown={e => e.stopPropagation()}>
      {items.map((item, i) => item === '---'
        ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        : (
          <button key={i} onClick={() => { item.action(); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: item.danger ? '#e74c3c' : 'var(--text-primary)', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ width: 18, fontSize: 15, textAlign: 'center' }}>{item.icon}</span>{item.label}
          </button>
        )
      )}
    </div>
  );
}

// ── Shared: uncontrolled contentEditable cell ─────────────────────────────────
function EditableCell({ html, onChange, onFocus, style, tag: Tag = 'div' }) {
  const ref = useRef(null);
  // Initial mount: set innerHTML (uncontrolled)
  useEffect(() => { if (ref.current) ref.current.innerHTML = html ?? ''; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // When html prop changes externally (e.g. column insert/delete shifts cells), re-sync
  // but skip if the cell has focus so we don't interrupt an in-progress edit
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = html ?? '';
    }
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Tag ref={ref} contentEditable suppressContentEditableWarning
      onBlur={() => onChange && onChange(ref.current.innerHTML)}
      onFocus={onFocus}
      style={{ outline: 'none', minHeight: 20, cursor: 'text', ...style }}
    />
  );
}

// ── Context menu for adding blocks (section or table) ────────────────────────
function AddBlockMenu({ x, y, onAddSection, onAddTable, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key  = e => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const menuBtn = (onClick, label, danger) => (
    <button onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      style={{ display: 'block', width: '100%', padding: '7px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', color: danger ? '#e74c3c' : 'var(--text-primary)' }}>
      {label}
    </button>
  );

  return (
    <div ref={ref} contentEditable={false} onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9000, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 160 }}>
      {onAddSection && menuBtn(() => { onAddSection(); onClose(); }, 'Add text section')}
      {onAddTable && menuBtn(() => { onAddTable(); onClose(); }, 'Add table')}
      {onDelete && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {menuBtn(() => { onDelete(); onClose(); }, 'Delete', true)}
        </>
      )}
    </div>
  );
}

// ── Reusable table block editor ───────────────────────────────────────────────
function BlockTableEditor({ block, canEdit, onUpdate, onDelete }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [contextMenu, setContextMenu]   = useState(null);
  const cellRefs = useRef({});
  const tableRef = useRef(null);

  const cols = block.columns || ['Item', 'Description'];
  const rows = block.rows || [];

  function updateCell(ri, ci, val)  { onUpdate({ ...block, rows: rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r) }); }
  function updateHeader(ci, val)    { onUpdate({ ...block, columns: cols.map((c, i) => i === ci ? val : c) }); }
  function insertRowAt(ri)          { onUpdate({ ...block, rows: [...rows.slice(0, ri), cols.map(() => ''), ...rows.slice(ri)] }); }
  function deleteRowAt(ri)          { onUpdate({ ...block, rows: rows.filter((_, i) => i !== ri) }); }
  function insertColAt(ci)          { onUpdate({ ...block, columns: [...cols.slice(0, ci), 'New column', ...cols.slice(ci)], rows: rows.map(r => [...r.slice(0, ci), '', ...r.slice(ci)]) }); }
  function deleteColAt(ci)          { if (cols.length <= 1) return; onUpdate({ ...block, columns: cols.filter((_, i) => i !== ci), rows: rows.map(r => r.filter((_, i) => i !== ci)) }); }
  function clearCell(ri, ci)        { updateCell(ri, ci, ''); if (cellRefs.current[`${ri}-${ci}`]) cellRefs.current[`${ri}-${ci}`].innerHTML = ''; }

  function handleCellContextMenu(e, ri, ci) {
    e.preventDefault();
    setSelectedCell({ ri, ci });
    setContextMenu({ x: e.clientX, y: e.clientY, ri, ci });
  }

  const ctxItems = (ri, ci) => [
    { icon: <Plus size={13} />, label: 'Insert 1 row above',    action: () => insertRowAt(ri) },
    { icon: <Plus size={13} />, label: 'Insert 1 row below',    action: () => insertRowAt(ri + 1) },
    { icon: <Plus size={13} />, label: 'Insert 1 column left',  action: () => insertColAt(ci) },
    { icon: <Plus size={13} />, label: 'Insert 1 column right', action: () => insertColAt(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete row',    action: () => deleteRowAt(ri),    danger: true },
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteColAt(ci),    danger: true },
    { icon: <X size={13} />,      label: 'Clear cell',    action: () => clearCell(ri, ci) },
  ];

  const tdStyle = (ri, ci) => ({
    padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
    verticalAlign: 'top',
    background: selectedCell?.ri === ri && selectedCell?.ci === ci ? '#EEF2FF' : selectedCell?.ri === ri ? '#F5F7FF' : undefined,
    outline: selectedCell?.ri === ri && selectedCell?.ci === ci ? '2px solid #4F8EF7' : undefined,
    outlineOffset: -2,
  });

  return (
    <div onMouseDown={e => { if (!e.target.closest('td') && !e.target.closest('button')) setSelectedCell(null); }}>
      {canEdit && (
        <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
          <button onClick={() => insertRowAt(rows.length)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}><Plus size={12} /> Add row</button>
          <button onClick={() => insertColAt(cols.length)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}><Plus size={12} /> Add column</button>
          {onDelete && <button onClick={onDelete} style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer' }}>Delete table</button>}
        </div>
      )}
      <div ref={tableRef} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto' }}
        onKeyDown={e => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCell && document.activeElement?.dataset?.cell !== `${selectedCell.ri}-${selectedCell.ci}`) {
            e.preventDefault(); clearCell(selectedCell.ri, selectedCell.ci);
          }
          if (e.key === 'Escape') setSelectedCell(null);
        }}
        tabIndex={-1}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'var(--purple-primary)' }}>
              {cols.map((col, ci) => (
                <th key={ci} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'white', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                  {canEdit ? <EditableCell html={col} onChange={v => updateHeader(ci, v)} style={{ color: 'white', fontSize: 12, fontWeight: 700 }} /> : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px', borderBottom: '1px solid var(--border)' }}>
                No rows yet.{canEdit ? ' Click "Add row" to get started.' : ''}
              </td></tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cellVal, ci) => (
                  <td key={ci} style={tdStyle(ri, ci)}
                    onClick={() => setSelectedCell({ ri, ci })}
                    onContextMenu={canEdit ? e => handleCellContextMenu(e, ri, ci) : undefined}>
                    {canEdit
                      ? <EditableCell html={cellVal} onChange={v => updateCell(ri, ci, v)} style={{ minHeight: 24, lineHeight: 1.5 }} tag="div" />
                      : <span dangerouslySetInnerHTML={{ __html: cellVal || '' }} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contextMenu && <TableContextMenu x={contextMenu.x} y={contextMenu.y} items={ctxItems(contextMenu.ri, contextMenu.ci)} onClose={() => setContextMenu(null)} />}
    </div>
  );
}

// ── Reagent Categorization SOP ────────────────────────────────────────────────
const DEFAULT_QUARTZY = [
  { name: 'Proteins and enzymes',         def: '',                                                                                                                                                                                                                                                                                                                                                                                                                  examples: 'Individual purified biological macromolecules, including proteins and enzymes, that are themselves the material being used (e.g. catalytic, binding, or structural activity), not small-molecule inhibitors, buffers, or chemical modifiers. This category includes recombinant, purified, or native proteins supplied as discrete entities.' },
  { name: 'Antibodies',                   def: 'Antibodies',                                                                                                                                                                                                                                                                                                                                                                                                       examples: '' },
  { name: 'Cell Line',                    def: 'Human or mouse cell lines purchased via repositories',                                                                                                                                                                                                                                                                                                                                                              examples: '' },
  { name: 'Biological materials/specimens', def: 'All purchased non-cell line biological specimens',                                                                                                                                                                                                                                                                                                                                                               examples: 'eg bacterial / yeast cultures, cord blood DNA, tissues, samples, RNA, non-live cell pellets, protein extracts (but not specific, purified or recombinant proteins)' },
  { name: 'Tissue Culture Reagents',      def: 'Chemical or liquid reagents added to cell culture media or used for maintenance/passaging; things that are tissue culture specific i.e. used in tissue culture room',                                                                                                                                                                                                                                               examples: 'DMEM, RPMI, IMDM, FBS, trypsin, PBS, GlutaMAX, Matrigel, antibiotics.' },
  { name: 'Disposable Supplies',          def: 'Physical consumables or plasticware that are used and discarded; not chemicals or reagents.',                                                                                                                                                                                                                                                                                                                       examples: 'Flasks, plates, tubes, tips, filters, gloves, wipes, serological pipettes, Parafilm, racks.' },
  { name: 'Sequence-Based Reagents',      def: 'Reagents defined by sequence, nomenclature requires specification per examples (not other categories and specificity eg not 3A/A3B-1 but 3A/3B substrate OLIGO, PANELS for nanoseq',                                                                                                                                                                                                                               examples: 'Primers (FWD/REV), oligos, plasmids, cloning vectors, gBlocks.' },
  { name: 'General Lab Chemicals',        def: 'Reagents used broadly across many different laboratory processes, including chemistry, molecular biology, protein work, and general lab operations. Not restricted to a single workflow class.',                                                                                                                                                                                                                     examples: '' },
  { name: 'Specialized Reagents,  Kits, Supplies', def: 'Reagents, buffers, enzymatic modules, or kits that are used exclusively for a specific biological process or analytical workflow, and are not repurposed outside that context. Includes DNA/RNA extraction kits, library-prep reagents, assay-specific buffers, stains, controls, and detection systems. Also kit/assay-specific supplies eg Qbit tubes. Also includes drugs, Specific Signaling Inhibitors / Modulators and Cellular State Modifiers & Biochemical Assay Reagents, small molecule inhibitors', examples: '' },
];
const DEFAULT_OTHER = ['Shipping', 'Cores', 'Subcapital', 'Capital', 'Travel & Conferences', 'Meals & Fun', 'CR/CO', 'Subscriptions'];
const DEFAULT_REMOVED = ['Office supplies- becomes disposable supplies', 'CR and CO - becoming CR/CO', 'Computer hardware -becomes subcaptal'];

const DEFAULT_BOXES = [
  ['📦 BOX 1 — Chemotherapies', ''],
  ['📦 BOX 2 — Targeted Signaling Inhibitors / Modulators', '<strong>Includes:</strong> Targeted inhibitors/modulators of a defined signaling node ie Acts on a specific, named target or pathway; ie If it cleanly inhibits or modulates a specific signaling component → Box 2<br><strong>Includes</strong> clinical drugs and research inhibitors<br><strong>Excludes:</strong> Broad stressors, metabolic poisons, mimetics, or buffering agents, chemotherapy agents (those go into chemotherapies box)<br>You can answer: "This inhibits X" (e.g., ER, BTK, JAK, EZH2, HIF-2α)'],
  ['📦 BOX 3 — Cellular State Modifiers & Biochemical Assay Reagents', 'Reagents that alter, buffer, or report global cellular states, or that are generic biochemical reagents used across assays, without targeting a specific signaling node.<br>These reagents: Act broadly or pleiotropically · Are not chemotherapies · Are not pathway-specific inhibitors · Are not DNA/RNA-based reagents'],
];

const DEFAULT_REAGENT_LOCATIONS = [
  { type: 'Proteins and Enzymes', locations: ['Protein Box -20°C (#2-Lab)', 'Restriction Enzymes Box -20°C (#2-Lab)', 'Other Enzymes Box -20°C (#2-Lab)'] },
  { type: 'Antibodies', locations: ['Antibodies Box 4°C (#1-Lab)', 'Primary Antibodies Box -20°C (#2-Lab)', 'Secondary Antibodies Box -20°C (#2-Lab)'] },
  { type: 'Biological Materials / Specimens', locations: ['4°C (#1-Deli)', '-20°C (#1-Specimens-Lab)', '-80°C (#1)', 'Receiving 4°C (Deli Fridge)', 'Receiving -20°C (#2-Lab)', 'Receiving -80°C (#1-Lab)'] },
  { type: 'Cell Lines', locations: ['Cryofreezer', 'New Cell Lines Box -80°C (#1)'] },
  { type: 'Tissue Culture Reagents', locations: ['-20°C (#2-Lab)', '-20°C (#4-TC)', '4°C (#4-TC)', 'Cold Room'] },
  { type: 'Disposable Supplies', locations: ['Receiving RT (Lab)', 'RT Lab (Active TC-Closet)', 'RT Lab (Active TC-Rack)', 'RT Lab (Designated Locations)', 'RT Storage - Hallway Cabinets', 'RT Storage - Hallway Closet 8-001'] },
  { type: 'Sequence-Based Reagents', locations: ['Receiving -80°C (#1-Lab)', 'Receiving -20°C (#2-Lab)', 'Plasmid/Vector Stock Box -20°C (#2-Lab) — permission-only', 'Plasmid/Vector Stock Box -80°C (#1) — permission-only', '-20°C (#2-Lab)', '-20°C (#3-DuplexSeq-Lab)'] },
  { type: 'General Lab Chemicals', locations: ['Receiving RT (Lab)', 'Receiving 4°C (Deli Fridge)', 'Receiving -20°C (#2-Lab)', 'Receiving -80°C (#1-Lab)', '4°C (#4-TC)', '4°C (#1-Deli)', '-20°C (#2-Lab)', '-20°C (#4-TC)', '-80°C (#1)', 'RT Lab (Designated Locations)', 'RT Flammable Cabinet', 'RT Under Fume Hood'] },
  { type: 'Specialized Reagents, Kits, Supplies', locations: ['-20°C (#2-Lab)', '-20°C (#3-DuplexSeq-Lab)', '-20°C (#4-TC)', '-80°C (#1)', '4°C (#1-Deli)', '4°C (#4-TC)', 'Cell State Modulators & Biochem. Reagents Box -20°C (#2-Lab)', 'Cell State Modulators & Biochem. Reagents Box -80°C (#1)', 'Cell State Modulators & Biochem. Reagents Box 4°C (#1-Lab)', 'Chemotherapies Box -20°C (#2-Lab)', 'Chemotherapies Box -80°C (#1)', 'Chemotherapies Box 4°C (#1-Lab)', 'qPCR/PCR Stock Box -20°C (#2-Lab) — permission-only', 'Receiving -20°C (#2-Lab)', 'Receiving -80°C (#1-Lab)', 'Receiving 4°C (Deli Fridge)', 'Receiving RT (Lab)', 'RT (Designated) + 4°C (#3-Lab)', 'RT Flammable Cabinet', 'RT Lab (Designated Locations)', 'RT Storage - DNA/RNA Isolation Cabinet (permission-only)', 'RT Under Fume Hood', 'Targeted Signaling Inhibitors & Modulators Box -20°C (#2-Lab)', 'Targeted Signaling Inhibitors & Modulators Box -80°C (#1)', 'Targeted Signaling Inhibitors & Modulators Box 4°C (#1-Lab)'] },
];

const DEFAULT_LOC_ROWS = DEFAULT_REAGENT_LOCATIONS.map(r => [
  r.type,
  r.locations.length ? '<ul style="margin:0;padding-left:18px">' + r.locations.map(l => `<li>${l}</li>`).join('') + '</ul>' : '',
]);

const thCell    = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#ffffff', borderBottom: '1px solid #5a1e82', position: 'relative' };
const tdName    = { padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'top', borderBottom: '1px solid var(--border)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' };
const tdBody    = { padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, verticalAlign: 'top', borderBottom: '1px solid var(--border)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' };
const tdCompact = { padding: '5px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' };
const sectionRow  = { background: 'var(--bg-secondary)' };
const sectionCell = { padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' };

function ReagentCategorizationSOP({ canEdit }) {
  // Quartzy stored as 2D array so columns can be added/removed generically
  const [qHeaders, setQHeaders] = useState(['Category', 'Definition / Scope', 'Examples']);
  const [quartzy,  setQuartzy]  = useState(() => DEFAULT_QUARTZY.map(r => [r.name, r.def, r.examples]));
  const [other,    setOther]    = useState(DEFAULT_OTHER);
  const [removed,  setRemoved]  = useState(DEFAULT_REMOVED);
  const [colVersion, setColVersion] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null); // {section, ri, ci}
  const [contextMenu,  setContextMenu]  = useState(null);
  const { widths: reagentCatWidths, onColMouseDown: reagentCatResize } = useResizableColumns(qHeaders.length);
  const [boxes, setBoxes] = useState(DEFAULT_BOXES);
  const [boxHeaders, setBoxHeaders] = useState(['Storage Box', 'Description / Scope']);
  const { widths: boxWidths, onColMouseDown: boxResize } = useResizableColumns(boxHeaders.length);
  const [boxColVersion, setBoxColVersion] = useState(0);

  // Quartzy 2D mutations
  function updateQ(ri, ci, val) { setQuartzy(p => p.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r)); }
  function updateQHeader(ci, val) { setQHeaders(p => p.map((h, i) => i === ci ? val : h)); }
  function removeQRow(ri) { setQuartzy(p => p.filter((_, i) => i !== ri)); }
  function insertQCol(ci) { setColVersion(v => v + 1); setQHeaders(p => [...p.slice(0, ci), 'New column', ...p.slice(ci)]); setQuartzy(p => p.map(r => [...r.slice(0, ci), '', ...r.slice(ci)])); }
  function deleteQCol(ci) { if (qHeaders.length <= 1) return; setColVersion(v => v + 1); setQHeaders(p => p.filter((_, i) => i !== ci)); setQuartzy(p => p.map(r => r.filter((_, i) => i !== ci))); }
  function insertQRow(ri, offset) { setQuartzy(p => [...p.slice(0, ri + offset), qHeaders.map(() => ''), ...p.slice(ri + offset)]); }

  // Other / Removed row mutations
  function updateOther(i, val) { setOther(p => p.map((r, idx) => idx === i ? val : r)); }
  function removeOther(i) { setOther(p => p.filter((_, idx) => idx !== i)); }
  function updateRemoved(i, val) { setRemoved(p => p.map((r, idx) => idx === i ? val : r)); }
  function removeRemoved(i) { setRemoved(p => p.filter((_, idx) => idx !== i)); }

  // Boxes mutations
  function updateBoxCell(ri, ci, val) { setBoxes(p => p.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r)); }
  function updateBoxHeader(ci, val) { setBoxHeaders(p => p.map((h, i) => i === ci ? val : h)); }
  function insertBox(ri, offset) { setBoxes(p => [...p.slice(0, ri + offset), boxHeaders.map(() => ''), ...p.slice(ri + offset)]); }
  function deleteBox(ri) { setBoxes(p => p.filter((_, i) => i !== ri)); }
  function insertBoxCol(ci) { setBoxColVersion(v => v + 1); setBoxHeaders(p => [...p.slice(0, ci), 'New column', ...p.slice(ci)]); setBoxes(p => p.map(r => [...r.slice(0, ci), '', ...r.slice(ci)])); }
  function deleteBoxCol(ci) { if (boxHeaders.length <= 1) return; setBoxColVersion(v => v + 1); setBoxHeaders(p => p.filter((_, i) => i !== ci)); setBoxes(p => p.map(r => r.filter((_, i) => i !== ci))); }
  function insertSimpleRow(setter, arr, ri, offset) { setter(p => [...p.slice(0, ri + offset), '', ...p.slice(ri + offset)]); }

  function handleCellCtxMenu(e, section, ri, ci) {
    if (!canEdit) return;
    e.preventDefault();
    setSelectedCell({ section, ri, ci });
    setContextMenu({ x: e.clientX, y: e.clientY, section, ri, ci });
  }

  function handleHeaderCtxMenu(e, ci) {
    if (!canEdit) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, section: 'quartzy_header', ri: -1, ci });
  }

  const headerCtxItems = (ci) => [
    { icon: <Plus size={13} />,   label: 'Insert 1 row below',    action: () => insertQRow(-1, 1) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column left',  action: () => insertQCol(ci) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column right', action: () => insertQCol(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteQCol(ci), danger: true },
  ];

  const qCtxItems = (ri, ci) => [
    { icon: <Plus size={13} />, label: 'Insert 1 row above',    action: () => insertQRow(ri, 0) },
    { icon: <Plus size={13} />, label: 'Insert 1 row below',    action: () => insertQRow(ri, 1) },
    { icon: <Plus size={13} />, label: 'Insert 1 column left',  action: () => insertQCol(ci) },
    { icon: <Plus size={13} />, label: 'Insert 1 column right', action: () => insertQCol(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete row',    action: () => removeQRow(ri),   danger: true },
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteQCol(ci),   danger: true },
  ];

  const boxHeaderCtxItems = (ci) => [
    { icon: <Plus size={13} />,   label: 'Insert 1 row below',    action: () => insertBox(boxes.length - 1, 1) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column left',  action: () => insertBoxCol(ci) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column right', action: () => insertBoxCol(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteBoxCol(ci), danger: true },
  ];

  const boxCtxItems = (ri, ci) => [
    { icon: <Plus size={13} />,   label: 'Insert 1 row above',    action: () => insertBox(ri, 0) },
    { icon: <Plus size={13} />,   label: 'Insert 1 row below',    action: () => insertBox(ri, 1) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column left',  action: () => insertBoxCol(ci) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column right', action: () => insertBoxCol(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete row',    action: () => deleteBox(ri),    danger: true },
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteBoxCol(ci), danger: true },
  ];

  const simpleCtxItems = (section, ri) => [
    { icon: <Plus size={13} />,   label: 'Insert 1 row above', action: () => section === 'other' ? insertSimpleRow(setOther, other, ri, 0) : insertSimpleRow(setRemoved, removed, ri, 0) },
    { icon: <Plus size={13} />,   label: 'Insert 1 row below', action: () => section === 'other' ? insertSimpleRow(setOther, other, ri, 1) : insertSimpleRow(setRemoved, removed, ri, 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete row', action: () => section === 'other' ? removeOther(ri) : removeRemoved(ri), danger: true },
  ];

  const isQSel = (ri, ci) => selectedCell?.section === 'quartzy' && selectedCell?.ri === ri;
  const isSimpleSel = (section, ri) => selectedCell?.section === section && selectedCell?.ri === ri;

  const cell = (html, onChange) => canEdit
    ? <EditableCell html={html} onChange={onChange} style={{ lineHeight: 1.65 }} />
    : <span dangerouslySetInnerHTML={{ __html: html || '' }} />;

  const hdrCell = (label, ci, onUpdate) => canEdit
    ? <EditableCell html={label} onChange={onUpdate} style={{ color: 'white', fontSize: 12, fontWeight: 700 }} />
    : label;

  return (
    <div onMouseDown={() => setContextMenu(null)}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 28 }}>
        <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{reagentCatWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              {qHeaders.map((h, ci) => (
                <th key={`${colVersion}-${ci}`} style={thCell} onContextMenu={e => handleHeaderCtxMenu(e, ci)}>
                  {hdrCell(h, ci, v => updateQHeader(ci, v))}
                  <ColResizer colIdx={ci} totalCols={qHeaders.length} onColMouseDown={reagentCatResize} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={sectionRow}><td colSpan={qHeaders.length} style={sectionCell}>Quartzy Categories</td></tr>
            {quartzy.map((row, ri) => (
              <tr key={ri}
                style={{ background: isQSel(ri) ? '#EEF2FF' : (ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)') }}
                onClick={() => setSelectedCell({ section: 'quartzy', ri, ci: 0 })}>
                {row.map((val, ci) => (
                  <td key={`${colVersion}-${ci}`}
                    style={{ ...(ci === 0 ? tdName : tdBody), ...(selectedCell?.section === 'quartzy' && selectedCell?.ri === ri && selectedCell?.ci === ci ? { outline: '2px solid #4F8EF7', outlineOffset: -2 } : {}) }}
                    onClick={e => { e.stopPropagation(); setSelectedCell({ section: 'quartzy', ri, ci }); }}
                    onContextMenu={e => handleCellCtxMenu(e, 'quartzy', ri, ci)}>
                    {cell(val, v => updateQ(ri, ci, v))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              <th style={thCell}>Other Categories Not Recorded in Quartzy</th>
            </tr>
          </thead>
          <tbody>
            {other.map((name, i) => (
              <tr key={i}
                style={{ background: isSimpleSel('other', i) ? '#EEF2FF' : (i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)') }}
                onClick={() => setSelectedCell({ section: 'other', ri: i, ci: 0 })}
                onContextMenu={e => handleCellCtxMenu(e, 'other', i, 0)}>
                <td style={tdCompact}>{cell(name, v => updateOther(i, v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              <th style={thCell}>Removed Categories</th>
            </tr>
          </thead>
          <tbody>
            {removed.map((name, i) => (
              <tr key={i}
                style={{ background: isSimpleSel('removed', i) ? '#EEF2FF' : (i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)') }}
                onClick={() => setSelectedCell({ section: 'removed', ri: i, ci: 0 })}
                onContextMenu={e => handleCellCtxMenu(e, 'removed', i, 0)}>
                <td style={tdCompact}>{cell(name, v => updateRemoved(i, v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 28 }}>
        <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{boxWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              {boxHeaders.map((h, ci) => (
                <th key={`${boxColVersion}-${ci}`} style={thCell}
                  onContextMenu={e => { if (!canEdit) return; e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, section: 'boxes_header', ri: -1, ci }); }}>
                  {hdrCell(h, ci, v => updateBoxHeader(ci, v))}
                  <ColResizer colIdx={ci} totalCols={boxHeaders.length} onColMouseDown={boxResize} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={sectionRow}><td colSpan={boxHeaders.length} style={sectionCell}>Specialized Reagents Storage Box Clarification</td></tr>
            {boxes.map((row, ri) => (
              <tr key={ri}
                style={{ background: selectedCell?.section === 'boxes' && selectedCell?.ri === ri ? '#EEF2FF' : (ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)') }}
                onClick={() => setSelectedCell({ section: 'boxes', ri, ci: 0 })}>
                {row.map((val, ci) => (
                  <td key={`${boxColVersion}-${ci}`}
                    style={{ ...(ci === 0 ? tdName : tdBody), ...(selectedCell?.section === 'boxes' && selectedCell?.ri === ri && selectedCell?.ci === ci ? { outline: '2px solid #4F8EF7', outlineOffset: -2 } : {}) }}
                    onClick={e => { e.stopPropagation(); setSelectedCell({ section: 'boxes', ri, ci }); }}
                    onContextMenu={e => handleCellCtxMenu(e, 'boxes', ri, ci)}>
                    {cell(val, v => updateBoxCell(ri, ci, v))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contextMenu && (
        <TableContextMenu
          x={contextMenu.x} y={contextMenu.y}
          items={contextMenu.section === 'quartzy_header'
            ? headerCtxItems(contextMenu.ci)
            : contextMenu.section === 'quartzy'
              ? qCtxItems(contextMenu.ri, contextMenu.ci)
              : contextMenu.section === 'boxes_header'
                ? boxHeaderCtxItems(contextMenu.ci)
                : contextMenu.section === 'boxes'
                  ? boxCtxItems(contextMenu.ri, contextMenu.ci)
                  : simpleCtxItems(contextMenu.section, contextMenu.ri)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function ReagentCategoryLocations({ canEdit }) {
  const [headers, setHeaders] = useState(['Inventory Type', 'Locations']);
  const { widths: reagentLocWidths, onColMouseDown: reagentLocResize } = useResizableColumns(headers.length);
  const [rows, setRows] = useState(DEFAULT_LOC_ROWS);
  const [colVersion, setColVersion] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  function updateCell(ri, ci, val) { setRows(p => p.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r)); }
  function updateHeader(ci, val) { setHeaders(p => p.map((h, i) => i === ci ? val : h)); }
  function removeRow(ri) { setRows(p => p.filter((_, i) => i !== ri)); }
  function insertRow(ri, offset) { setRows(p => [...p.slice(0, ri + offset), headers.map(() => ''), ...p.slice(ri + offset)]); }
  function insertCol(ci) { setColVersion(v => v + 1); setHeaders(p => [...p.slice(0, ci), 'New column', ...p.slice(ci)]); setRows(p => p.map(r => [...r.slice(0, ci), '', ...r.slice(ci)])); }
  function deleteCol(ci) { if (headers.length <= 1) return; setColVersion(v => v + 1); setHeaders(p => p.filter((_, i) => i !== ci)); setRows(p => p.map(r => r.filter((_, i) => i !== ci))); }

  const headerCtxItems = (ci) => [
    { icon: <Plus size={13} />,   label: 'Insert 1 row below',    action: () => insertRow(rows.length - 1, 1) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column left',  action: () => insertCol(ci) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column right', action: () => insertCol(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteCol(ci), danger: true },
  ];
  const cellCtxItems = (ri, ci) => [
    { icon: <Plus size={13} />,   label: 'Insert 1 row above',    action: () => insertRow(ri, 0) },
    { icon: <Plus size={13} />,   label: 'Insert 1 row below',    action: () => insertRow(ri, 1) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column left',  action: () => insertCol(ci) },
    { icon: <Plus size={13} />,   label: 'Insert 1 column right', action: () => insertCol(ci + 1) },
    '---',
    { icon: <Trash2 size={13} />, label: 'Delete row',    action: () => removeRow(ri),   danger: true },
    { icon: <Trash2 size={13} />, label: 'Delete column', action: () => deleteCol(ci),   danger: true },
  ];

  return (
    <div onMouseDown={() => setContextMenu(null)}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{reagentLocWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              {headers.map((h, ci) => (
                <th key={`${colVersion}-${ci}`} style={thCell}
                  onContextMenu={e => { if (!canEdit) return; e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'header', ci }); }}>
                  {canEdit
                    ? <EditableCell html={h} onChange={v => updateHeader(ci, v)} style={{ color: 'white', fontSize: 12, fontWeight: 700 }} />
                    : h}
                  <ColResizer colIdx={ci} totalCols={headers.length} onColMouseDown={reagentLocResize} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}
                style={{ background: selectedCell?.ri === ri ? '#EEF2FF' : (ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)') }}
                onClick={() => setSelectedCell({ ri, ci: 0 })}>
                {row.map((val, ci) => (
                  <td key={`${colVersion}-${ci}`}
                    style={{ padding: '10px 16px', fontSize: 13, fontWeight: ci === 0 ? 600 : 400, color: ci === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', verticalAlign: 'top', borderBottom: '1px solid var(--border)', whiteSpace: 'normal', lineHeight: 1.65, ...(selectedCell?.ri === ri && selectedCell?.ci === ci ? { outline: '2px solid #4F8EF7', outlineOffset: -2 } : {}) }}
                    onClick={e => { e.stopPropagation(); setSelectedCell({ ri, ci }); }}
                    onContextMenu={e => { if (!canEdit) return; e.preventDefault(); setSelectedCell({ ri, ci }); setContextMenu({ x: e.clientX, y: e.clientY, type: 'cell', ri, ci }); }}>
                    {canEdit
                      ? <EditableCell html={val} onChange={v => updateCell(ri, ci, v)} style={{ fontSize: 13 }} />
                      : <span dangerouslySetInnerHTML={{ __html: val || '' }} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contextMenu && (
        <TableContextMenu
          x={contextMenu.x} y={contextMenu.y}
          items={contextMenu.type === 'header' ? headerCtxItems(contextMenu.ci) : cellCtxItems(contextMenu.ri, contextMenu.ci)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// Bare contentEditable section body — toolbar is shared at the parent level
function SectionBlockContent({ sectionId, initialContent, onContentChange }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const cbRef = useRef(onContentChange);
  useEffect(() => { cbRef.current = onContentChange; });
  useEffect(() => { if (ref.current) ref.current.innerHTML = initialContent || ''; }, []); // eslint-disable-line
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => cbRef.current(el.innerHTML), 600);
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    return () => { obs.disconnect(); clearTimeout(timer.current); };
  }, []); // eslint-disable-line
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      style={{ outline: 'none', minHeight: 40, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }} />
  );
}

function CustomTabContent({ tabId, storagePrefix, canEdit }) {
  const storageKey = `${storagePrefix}_sections_${tabId}`;
  const [sections, setSections] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(storageKey)); return Array.isArray(s) ? s : []; } catch { return []; }
  });
  const [ctxMenu, setCtxMenu] = useState(null);
  const inputRefs = useRef({});

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(sections)); } catch {}
  }, [sections, storageKey]);

  const addBlock = useCallback((afterIdx, type) => {
    const id = `sec_${Date.now()}`;
    const newBlock = type === 'table'
      ? { id, type: 'table', columns: ['Item', 'Description'], rows: [] }
      : { id, type: 'section', label: '', content: '', subsections: [] };
    setSections(prev => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, newBlock);
      return next;
    });
    if (type === 'section') setTimeout(() => inputRefs.current[id]?.focus(), 50);
  }, []);

  const deleteSection = useCallback((idx) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const moveSection = useCallback((idx, dir) => {
    setSections(prev => {
      const next = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }, []);

  const updateLabel = useCallback((id, label) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }, []);

  const updateContent = useCallback((id, content) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  }, []);

  const updateTableBlock = useCallback((id, updated) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  }, []);

  const { addSubsection, deleteSubsection, updateSubsectionContent, updateSubsectionBgColor, updateSectionBgColor } = makeSubsectionHandlers(setSections);
  const containerRef = useRef(null);

  const secCard = { marginBottom: 16, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' };
  const secH1   = { fontSize: 14, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' };

  return (
    <div ref={containerRef}
      onMouseDown={() => setCtxMenu(null)}
      onContextMenu={canEdit ? e => {
        if (!e.target.closest('[data-tab-block]')) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx: -1 }); }
      } : undefined}
      style={{ minHeight: 120 }}
    >
      <SOPToolbar editorRef={containerRef} canEdit={canEdit} />
      {sections.length === 0 && canEdit && (
        <div contentEditable={false} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', userSelect: 'none' }}>
          Right-click to add a section or table
        </div>
      )}
      {sections.map((sec, idx) => {
        const isTable = sec.type === 'table';
        return (
          <div key={sec.id} data-tab-block={sec.id}
            style={isTable ? { marginBottom: 20 } : { ...secCard, background: sec.bgColor || 'var(--bg-card)' }}
            onContextMenu={canEdit ? e => { e.stopPropagation(); e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx, blockType: sec.type || 'section' }); } : undefined}
          >
            {isTable ? (
              <BlockTableEditor
                block={sec} canEdit={canEdit}
                onUpdate={updated => updateTableBlock(sec.id, updated)}
                onDelete={canEdit ? () => deleteSection(idx) : undefined}
              />
            ) : (
              <>
                {canEdit
                  ? <input ref={el => { inputRefs.current[sec.id] = el; }} value={sec.label || ''} onChange={e => updateLabel(sec.id, e.target.value)} placeholder={`Section ${idx + 1}`}
                      style={{ ...secH1, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block', marginBottom: 12 }} />
                  : <div style={secH1}>{sec.label || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Section {idx + 1}</span>}</div>
                }
                <SectionBlockContent sectionId={sec.id} initialContent={sec.content} onContentChange={content => updateContent(sec.id, content)} />
                {(sec.subsections || []).map(sub => (
                  <SubsectionBlock key={sub.id} sub={sub} canEdit={canEdit}
                    onContentChange={content => updateSubsectionContent(sec.id, sub.id, content)}
                    onChangeBgColor={color => updateSubsectionBgColor(sec.id, sub.id, color)}
                    onDelete={() => deleteSubsection(sec.id, sub.id)} />
                ))}
              </>
            )}
          </div>
        );
      })}
      {ctxMenu && ctxMenu.idx === -1 && (
        <AddBlockMenu x={ctxMenu.x} y={ctxMenu.y}
          onAddSection={() => { addBlock(sections.length - 1, 'section'); setCtxMenu(null); }}
          onAddTable={() => { addBlock(sections.length - 1, 'table'); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)} />
      )}
      {ctxMenu && ctxMenu.idx >= 0 && ctxMenu.blockType === 'table' && (
        <AddBlockMenu x={ctxMenu.x} y={ctxMenu.y}
          onAddSection={() => { addBlock(ctxMenu.idx, 'section'); setCtxMenu(null); }}
          onAddTable={() => { addBlock(ctxMenu.idx, 'table'); setCtxMenu(null); }}
          onDelete={() => { deleteSection(ctxMenu.idx); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)} />
      )}
      {ctxMenu && ctxMenu.idx >= 0 && ctxMenu.blockType !== 'table' && (
        <SectionContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onAddAbove={() => addBlock(ctxMenu.idx - 1, 'section')}
          onAddBelow={() => addBlock(ctxMenu.idx, 'section')}
          onMoveUp={ctxMenu.idx > 0 ? () => moveSection(ctxMenu.idx, -1) : null}
          onMoveDown={ctxMenu.idx < sections.length - 1 ? () => moveSection(ctxMenu.idx, 1) : null}
          onDelete={() => deleteSection(ctxMenu.idx)}
          onAddSubsection={() => addSubsection(sections[ctxMenu.idx]?.id)}
          onChangeBgColor={color => updateSectionBgColor(sections[ctxMenu.idx]?.id, color)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

const DEFAULT_REAGENT_SUBS = [
  { id: 'categorization', label: 'Reagent Categorization SOP' },
  { id: 'locations',      label: 'Reagent Category Locations' },
];
const REAGENT_TABS_KEY = 'reagent_tabs_v1';
const REAGENT_BUILTIN_IDS = new Set(['categorization', 'locations']);

function ReagentTab({ canEdit }) {
  const [subs, setSubs] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(REAGENT_TABS_KEY)); return Array.isArray(s) && s.length ? s : DEFAULT_REAGENT_SUBS; }
    catch { return DEFAULT_REAGENT_SUBS; }
  });
  const [sub, setSub] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(REAGENT_TABS_KEY)); return Array.isArray(s) && s.length ? s[0].id : 'categorization'; }
    catch { return 'categorization'; }
  });
  const [tabCtx, setTabCtx] = useState(null);
  const [modal, setModal] = useState(null);

  function saveSubs(next) { setSubs(next); try { localStorage.setItem(REAGENT_TABS_KEY, JSON.stringify(next)); } catch {} }

  function addTab(nearId, side) {
    setTabCtx(null);
    setModal({ type: 'input', title: 'New tab name:', defaultValue: '', onConfirm: name => {
      const newTab = { id: `custom_${Date.now()}`, label: name };
      const idx = subs.findIndex(s => s.id === nearId);
      const next = [...subs];
      next.splice(side === 'left' ? idx : idx + 1, 0, newTab);
      saveSubs(next);
      setSub(newTab.id);
    }});
  }

  function renameTab(id) {
    const current = subs.find(s => s.id === id)?.label || '';
    setTabCtx(null);
    setModal({ type: 'input', title: 'Rename tab:', defaultValue: current, onConfirm: name => {
      if (name !== current) saveSubs(subs.map(s => s.id === id ? { ...s, label: name } : s));
    }});
  }

  function deleteTab(id) {
    setTabCtx(null);
    setModal({ type: 'confirm', message: 'Delete this tab?', onConfirm: () => {
      const next = subs.filter(s => s.id !== id);
      saveSubs(next);
      if (sub === id) setSub(next[0]?.id || '');
    }});
  }

  return (
    <div onMouseDown={() => setTabCtx(null)}>
      <div style={{ marginBottom: 28 }}>
        <PillTabs
          tabs={subs} active={sub} onSelect={setSub}
          onContextMenu={canEdit ? (e, tabId) => setTabCtx({ x: e.clientX, y: e.clientY, id: tabId }) : undefined}
        />
      </div>
      {sub === 'categorization' && <ReagentCategorizationSOP canEdit={canEdit} />}
      {sub === 'locations' && <ReagentCategoryLocations canEdit={canEdit} />}
      {!REAGENT_BUILTIN_IDS.has(sub) && subs.find(s => s.id === sub) && (
        <SOPEditorWrapper key={sub} id={`reagent_custom_${sub}`} canEdit={canEdit}><br /></SOPEditorWrapper>
      )}
      {tabCtx && (
        <TabContextMenu
          x={tabCtx.x} y={tabCtx.y}
          onAddLeft={() => addTab(tabCtx.id, 'left')}
          onAddRight={() => addTab(tabCtx.id, 'right')}
          onRename={() => renameTab(tabCtx.id)}
          onDelete={!REAGENT_BUILTIN_IDS.has(tabCtx.id) ? () => deleteTab(tabCtx.id) : null}
          onClose={() => setTabCtx(null)}
        />
      )}
      {modal?.type === 'input' && <TabInputModal title={modal.title} defaultValue={modal.defaultValue} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
      {modal?.type === 'confirm' && <TabConfirmModal message={modal.message} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Sequencing Sample Nomenclature SOP ───────────────────────────────────────
const DEFAULT_NAMING_SUBS = [
  { id: 'non_cell_line', label: 'Non-cell line nomenclature' },
  { id: 'cell_line',     label: 'Cell line nomenclature' },
];
const NAMING_SUBS_KEY = 'nomenclature_subs_v1';

const NOMENCLATURE_DOCS = {
  non_cell_line: {
    guidelineUrl:    'https://docs.google.com/document/d/1y8EYDUC-imv0h41PQU4egtgmcmjtOJLX/preview',
    guidelineEdit:   'https://docs.google.com/document/d/1y8EYDUC-imv0h41PQU4egtgmcmjtOJLX/edit',
    exampleUrl:      null,
    exampleEdit:     null,
  },
  cell_line: {
    guidelineUrl:    null,
    guidelineEdit:   null,
    exampleUrl:      'https://docs.google.com/spreadsheets/d/1KNmP7BkC8_yju727lssgNxkXkEnHZ4kjWZD7gm1IS88/preview',
    exampleEdit:     'https://docs.google.com/spreadsheets/d/1KNmP7BkC8_yju727lssgNxkXkEnHZ4kjWZD7gm1IS88/edit?gid=0#gid=0',
  },
};

function NomenclaturePanel({ sub }) {
  const docs = NOMENCLATURE_DOCS[sub];
  const [view, setView] = useState(docs.guidelineUrl ? 'guideline' : 'example');

  return (
    <div>
      <div contentEditable={false} style={{ marginBottom: 16 }}>
        <PillTabs
          tabs={[{ id: 'guideline', label: 'Guideline document' }, { id: 'example', label: 'Example table' }]}
          active={view}
          onSelect={setView}
        />
      </div>

      {view === 'guideline' && (
        docs.guidelineUrl ? (
          <div contentEditable={false}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <a href={docs.guidelineEdit} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600, textDecoration: 'none', background: 'var(--purple-faint)', padding: '5px 12px', borderRadius: 6 }}>
                <ExternalLink size={11} /> Open in Google Docs
              </a>
            </div>
            <iframe src={docs.guidelineUrl} title="Guideline document"
              style={{ width: '100%', height: 680, border: '1px solid var(--border)', borderRadius: 8 }} allowFullScreen />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
            <FileText size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Guideline document pending — to be provided by Luka</p>
          </div>
        )
      )}

      {view === 'example' && (
        docs.exampleUrl ? (
          <div contentEditable={false}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <a href={docs.exampleEdit} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600, textDecoration: 'none', background: 'var(--purple-faint)', padding: '5px 12px', borderRadius: 6 }}>
                <ExternalLink size={11} /> Open in Google Sheets
              </a>
            </div>
            <iframe src={docs.exampleUrl} title="Example table"
              style={{ width: '100%', height: 680, border: '1px solid var(--border)', borderRadius: 8 }} allowFullScreen />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
            <FileText size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Example table pending — to be provided by Luka</p>
          </div>
        )
      )}
    </div>
  );
}

function SequencingNomenclatureSOP({ canEdit }) {
  const [subs, setSubs] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(NAMING_SUBS_KEY)); return Array.isArray(s) && s.length ? s : DEFAULT_NAMING_SUBS; } catch { return DEFAULT_NAMING_SUBS; }
  });
  const [sub, setSub] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(NAMING_SUBS_KEY)); return Array.isArray(s) && s.length ? s[0].id : 'non_cell_line'; } catch { return 'non_cell_line'; }
  });
  const [tabCtx, setTabCtx] = useState(null);
  const [modal, setModal] = useState(null);

  function saveSubs(next) { setSubs(next); try { localStorage.setItem(NAMING_SUBS_KEY, JSON.stringify(next)); } catch {} }

  function addTab(nearId, side) {
    setTabCtx(null);
    setModal({ type: 'input', title: 'New tab name:', defaultValue: '', onConfirm: name => {
      const newTab = { id: `custom_${Date.now()}`, label: name };
      const idx = subs.findIndex(s => s.id === nearId);
      const next = [...subs];
      next.splice(side === 'left' ? idx : idx + 1, 0, newTab);
      saveSubs(next);
      setSub(newTab.id);
    }});
  }

  function renameTab(id) {
    const current = subs.find(s => s.id === id)?.label || '';
    setTabCtx(null);
    setModal({ type: 'input', title: 'Rename tab:', defaultValue: current, onConfirm: name => {
      if (name !== current) saveSubs(subs.map(s => s.id === id ? { ...s, label: name } : s));
    }});
  }

  function deleteTab(id) {
    setTabCtx(null);
    setModal({ type: 'confirm', message: 'Delete this tab?', onConfirm: () => {
      const next = subs.filter(s => s.id !== id);
      saveSubs(next);
      if (sub === id) setSub(next[0]?.id || '');
    }});
  }

  const builtinIds = new Set(['non_cell_line', 'cell_line']);

  return (
    <div onMouseDown={() => setTabCtx(null)}>
      <div contentEditable={false} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <PillTabs
          tabs={subs} active={sub} onSelect={setSub}
          onContextMenu={canEdit ? (e, tabId) => setTabCtx({ x: e.clientX, y: e.clientY, id: tabId }) : undefined}
        />
      </div>

      {tabCtx && (
        <TabContextMenu
          x={tabCtx.x} y={tabCtx.y}
          onAddLeft={() => addTab(tabCtx.id, 'left')}
          onAddRight={() => addTab(tabCtx.id, 'right')}
          onRename={() => renameTab(tabCtx.id)}
          onDelete={!builtinIds.has(tabCtx.id) ? () => deleteTab(tabCtx.id) : null}
          onClose={() => setTabCtx(null)}
        />
      )}

      {modal?.type === 'input' && <TabInputModal title={modal.title} defaultValue={modal.defaultValue} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
      {modal?.type === 'confirm' && <TabConfirmModal message={modal.message} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}

      {sub === 'non_cell_line' && <SampleNamingNomenclature canEdit={canEdit} />}
      {sub === 'cell_line' && <NomenclaturePanel key="cell_line" sub="cell_line" />}
      {!builtinIds.has(sub) && subs.find(s => s.id === sub) && (
        <CustomTabContent key={sub} tabId={sub} storagePrefix="naming_custom_tab" canEdit={canEdit} />
      )}
    </div>
  );
}

// ── Mutational Data Presentation SOP ─────────────────────────────────────────
function MutationalDataSOP({ canEdit }) {
  return <MutationalSignaturesSOP canEdit={canEdit} />;
}

// ── Custom (user-added) SOPs ──────────────────────────────────────────────────
const CUSTOM_SOPs_KEY = 'lab_custom_sops_v1';

function loadCustomSOPs() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SOPs_KEY) || '[]'); } catch { return []; }
}

function saveCustomSOPs(list) {
  try { localStorage.setItem(CUSTOM_SOPs_KEY, JSON.stringify(list)); } catch {}
}

// ── Block-based blank SOP view ────────────────────────────────────────────────
function CustomSOPBlankView({ sop, canEdit, onDelete, onUpdate }) {
  const [blocks, setBlocks] = useState(() => {
    if (Array.isArray(sop.blocks)) return sop.blocks;
    // Legacy migration: single table block from old columns/rows format
    if (sop.columns) return [{ id: `blk_${Date.now()}`, type: 'table', columns: sop.columns, rows: sop.rows || [] }];
    return [];
  });
  const [ctxMenu, setCtxMenu] = useState(null);
  const inputRefs = useRef({});

  // Persist changes back to parent
  useEffect(() => {
    onUpdate({ ...sop, blocks });
  }, [blocks]); // eslint-disable-line

  const { addSubsection, deleteSubsection, updateSubsectionContent, updateSubsectionBgColor, updateSectionBgColor } = makeSubsectionHandlers(setBlocks);

  const addBlock = useCallback((afterIdx, type) => {
    const id = `blk_${Date.now()}`;
    const newBlock = type === 'table'
      ? { id, type: 'table', columns: ['Item', 'Description'], rows: [] }
      : { id, type: 'section', label: '', content: '', subsections: [] };
    setBlocks(prev => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, newBlock);
      return next;
    });
    if (type === 'section') setTimeout(() => inputRefs.current[id]?.focus(), 50);
  }, []);

  const deleteBlock = useCallback((idx) => setBlocks(prev => prev.filter((_, i) => i !== idx)), []);

  const moveBlock = useCallback((idx, dir) => {
    setBlocks(prev => {
      const next = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }, []);

  const updateBlockLabel   = useCallback((id, label)   => setBlocks(prev => prev.map(b => b.id === id ? { ...b, label }   : b)), []);
  const updateBlockContent = useCallback((id, content) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b)), []);
  const updateBlockTable   = useCallback((id, updated) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b)), []);
  const containerRef = useRef(null);

  const secCard = { marginBottom: 16, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' };
  const secH1   = { fontSize: 14, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' };

  return (
    <div ref={containerRef}
      onMouseDown={() => setCtxMenu(null)}
      onContextMenu={canEdit ? e => {
        if (!e.target.closest('[data-sop-block]')) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx: -1 }); }
      } : undefined}
    >
      <SOPToolbar editorRef={containerRef} canEdit={canEdit} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          {canEdit ? 'Right-click free space to add blocks' : sop.name}
        </p>
        {canEdit && <button onClick={onDelete} style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer' }}>Delete SOP</button>}
      </div>

      {blocks.length === 0 && canEdit && (
        <div contentEditable={false} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', userSelect: 'none' }}>
          Right-click to add a section or table
        </div>
      )}

      {blocks.map((block, idx) => {
        const isTable = block.type === 'table';
        return (
          <div key={block.id} data-sop-block={block.id}
            style={isTable ? { marginBottom: 20 } : { ...secCard, background: block.bgColor || 'var(--bg-card)' }}
            onContextMenu={canEdit ? e => { e.stopPropagation(); e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx, blockType: block.type }); } : undefined}
          >
            {isTable ? (
              <BlockTableEditor
                block={block} canEdit={canEdit}
                onUpdate={updated => updateBlockTable(block.id, updated)}
                onDelete={canEdit ? () => deleteBlock(idx) : undefined}
              />
            ) : (
              <>
                {canEdit
                  ? <input ref={el => { inputRefs.current[block.id] = el; }} value={block.label || ''} onChange={e => updateBlockLabel(block.id, e.target.value)} placeholder={`Section ${idx + 1}`}
                      style={{ ...secH1, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block', marginBottom: 12 }} />
                  : <div style={secH1}>{block.label || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Section {idx + 1}</span>}</div>
                }
                <SectionBlockContent sectionId={block.id} initialContent={block.content} onContentChange={content => updateBlockContent(block.id, content)} />
                {(block.subsections || []).map(sub => (
                  <SubsectionBlock key={sub.id} sub={sub} canEdit={canEdit}
                    onContentChange={content => updateSubsectionContent(block.id, sub.id, content)}
                    onChangeBgColor={color => updateSubsectionBgColor(block.id, sub.id, color)}
                    onDelete={() => deleteSubsection(block.id, sub.id)} />
                ))}
              </>
            )}
          </div>
        );
      })}

      {ctxMenu && ctxMenu.idx === -1 && (
        <AddBlockMenu x={ctxMenu.x} y={ctxMenu.y}
          onAddSection={() => { addBlock(blocks.length - 1, 'section'); setCtxMenu(null); }}
          onAddTable={() => { addBlock(blocks.length - 1, 'table'); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)} />
      )}
      {ctxMenu && ctxMenu.idx >= 0 && ctxMenu.blockType === 'table' && (
        <AddBlockMenu x={ctxMenu.x} y={ctxMenu.y}
          onAddSection={() => { addBlock(ctxMenu.idx, 'section'); setCtxMenu(null); }}
          onAddTable={() => { addBlock(ctxMenu.idx, 'table'); setCtxMenu(null); }}
          onDelete={() => { deleteBlock(ctxMenu.idx); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)} />
      )}
      {ctxMenu && ctxMenu.idx >= 0 && ctxMenu.blockType !== 'table' && (
        <SectionContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onAddAbove={() => addBlock(ctxMenu.idx - 1, 'section')}
          onAddBelow={() => addBlock(ctxMenu.idx, 'section')}
          onMoveUp={ctxMenu.idx > 0 ? () => moveBlock(ctxMenu.idx, -1) : null}
          onMoveDown={ctxMenu.idx < blocks.length - 1 ? () => moveBlock(ctxMenu.idx, 1) : null}
          onDelete={() => deleteBlock(ctxMenu.idx)}
          onAddSubsection={() => addSubsection(blocks[ctxMenu.idx]?.id)}
          onChangeBgColor={color => updateSectionBgColor(blocks[ctxMenu.idx]?.id, color)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function CustomSOPView({ sop, canEdit, onDelete, onUpdate }) {
  if (sop.type === 'doc') {
    const previewUrl = sop.url.includes('/preview') ? sop.url : sop.url.replace('/edit', '/preview').replace('/view', '/preview');
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{sop.label}</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <a href={sop.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600, textDecoration: 'none', background: 'var(--purple-faint)', padding: '5px 12px', borderRadius: 6 }}>
              <ExternalLink size={11} /> Open / Edit in Google
            </a>
            {canEdit && <button onClick={onDelete} style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer' }}>Delete SOP</button>}
          </div>
        </div>
        <iframe src={previewUrl} title={sop.name} style={{ width: '100%', height: 720, border: '1px solid var(--border)', borderRadius: 8 }} allowFullScreen />
      </div>
    );
  }

  return <CustomSOPBlankView sop={sop} canEdit={canEdit} onDelete={onDelete} onUpdate={onUpdate} />;
}

// ── Placeholder ───────────────────────────────────────────────────────────────
function PlaceholderContent({ tab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--purple-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        {tab.comingSoon ? <Clock size={26} color="var(--purple-primary)" /> : <FileText size={26} color="var(--purple-primary)" />}
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{tab.label}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: 400 }}>{tab.desc || 'Content for this section is being prepared.'}</p>
      {tab.comingSoon ? (
        <span style={{ fontSize: 12, fontWeight: 600, background: '#FEF9E7', color: '#F39C12', border: '1px solid #FAD7A0', borderRadius: 20, padding: '4px 14px' }}>Introduced — content in progress</span>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px' }}>Content coming soon</span>
      )}
    </div>
  );
}

// ── Add new SOP modal ─────────────────────────────────────────────────────────
function AddSOPModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('doc');
  const [url, setUrl]   = useState('');

  function handleSave() {
    if (!name.trim()) return;
    const id = `custom_${Date.now()}`;
    const sop = { id, name: name.trim(), type, label: name.trim() };
    if (type === 'doc') sop.url = url.trim();
    if (type === 'table') { sop.blocks = []; }
    onSave(sop);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 28, width: 420, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 18px' }}>Add new SOP</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Name (shown in sidebar)</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Flow Cytometry SOP"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: 'doc', label: 'Google Doc / Sheet' }, { id: 'table', label: 'Blank SOP' }].map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: type === t.id ? 600 : 400, border: `2px solid ${type === t.id ? 'var(--purple-primary)' : 'var(--border)'}`, borderRadius: 6, background: type === t.id ? 'var(--purple-faint)' : 'transparent', color: type === t.id ? 'var(--purple-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {type === 'doc' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Google Doc / Sheet URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/..."
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 14, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || (type === 'doc' && !url.trim())}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--purple-primary)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!name.trim() || (type === 'doc' && !url.trim())) ? 0.5 : 1 }}>
            Add SOP
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabs definition ───────────────────────────────────────────────────────────
const CORE_TABS = [
  { id: 'policies',        label: 'Lab Policies' },
  { id: 'meetings',        label: 'Lab Meetings Standards' },
  { id: 'benchling',       label: 'Benchling Use & Entries Policy' },
  { id: 'tissue_culture',  label: 'Tissue Culture SOP' },
  { id: 'ordering',        label: 'Ordering SOP' },
  { id: 'reagent',         label: 'Reagent Categorization & Storage SOP', hasSubs: true },
  { id: 'sample_naming',   label: 'Sequencing sample nomenclature SOP' },
  { id: 'sequencing_qc',   label: 'Sequencing QC SOPs' },
  { id: 'mutational_data', label: 'Mutational Data Presentation SOP' },
  { id: 'cell_line',       label: 'Cell Line Storage & Use SOP', comingSoon: true },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LabPoliciesSOPs({ userRole, userId, profile, permissions }) {
  const [tab, setTab] = useState(() => localStorage.getItem('sops_tab') || 'policies');
  const [customSOPs, setCustomSOPs] = useState(loadCustomSOPs);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);

  const canEdit = userRole === 'admin' || userRole === 'pm' || !!permissions?.can_edit_sops;

  const setTabAndSave = useCallback((id) => { localStorage.setItem('sops_tab', id); setTab(id); }, []);

  const TABS = [...CORE_TABS, ...customSOPs.map(s => ({ id: s.id, label: s.name, custom: true }))];
  const activeTab = TABS.find(t => t.id === tab);

  function handleAddSOP(sop) {
    const updated = [...customSOPs, sop];
    setCustomSOPs(updated);
    saveCustomSOPs(updated);
    setShowAddModal(false);
    setTabAndSave(sop.id);
  }

  function handleDeleteCustomSOP(id) {
    setDeleteModal(id);
  }

  function confirmDeleteCustomSOP(id) {
    const updated = customSOPs.filter(s => s.id !== id);
    setCustomSOPs(updated);
    saveCustomSOPs(updated);
    setTabAndSave('policies');
    setDeleteModal(null);
  }

  function handleUpdateCustomSOP(sop) {
    const updated = customSOPs.map(s => s.id === sop.id ? sop : s);
    setCustomSOPs(updated);
    saveCustomSOPs(updated);
  }

  function renderContent() {
    const customSOP = customSOPs.find(s => s.id === tab);
    if (customSOP) return <CustomSOPView sop={customSOP} canEdit={canEdit} onDelete={() => handleDeleteCustomSOP(customSOP.id)} onUpdate={handleUpdateCustomSOP} />;

    if (tab === 'policies')       return <SOPEditorWrapper key="lab_policies" id="lab_policies" canEdit={canEdit} noHtmlRestore><LabPolicies canEdit={canEdit} /></SOPEditorWrapper>;
    if (tab === 'meetings')       return <SOPEditorWrapper key="meetings" id="meetings" canEdit={canEdit} noHtmlRestore><MeetingStandards canEdit={canEdit} /></SOPEditorWrapper>;
    if (tab === 'benchling')      return <SOPEditorWrapper key="benchling" id="benchling" canEdit={canEdit} noHtmlRestore><BenchlingPolicy canEdit={canEdit} /></SOPEditorWrapper>;
    if (tab === 'tissue_culture') return <SOPEditorWrapper key="tissue_culture" id="tissue_culture" canEdit={canEdit} noHtmlRestore><TissueCultureSOP canEdit={canEdit} /></SOPEditorWrapper>;
    if (tab === 'ordering')       return <SOPEditorWrapper key="ordering" id="ordering" canEdit={canEdit} noHtmlRestore><OrderingSOP canEdit={canEdit} /></SOPEditorWrapper>;
    if (tab === 'reagent')        return <ReagentTab canEdit={canEdit} />;
    if (tab === 'sample_naming')   return <SOPEditorWrapper key="sample_naming" id="sample_naming" canEdit={canEdit} noHtmlRestore><SequencingNomenclatureSOP canEdit={canEdit} /></SOPEditorWrapper>;
    if (tab === 'mutational_data') return <SOPEditorWrapper key="mutational_data" id="mutational_data" canEdit={canEdit} noHtmlRestore><MutationalDataSOP canEdit={canEdit} /></SOPEditorWrapper>;
    return <PlaceholderContent tab={activeTab || { label: tab }} />;
  }

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      {/* Left sidebar */}
      <div style={{ width: 228, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Lab Policies & SOPs</h1>
          {canEdit && (
            <button onClick={() => setShowAddModal(true)} title="Add new SOP"
              style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Plus size={14} />
            </button>
          )}
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTabAndSave(t.id)} style={{
              width: '100%', textAlign: 'left', padding: '8px 12px',
              background: tab === t.id ? 'var(--purple-faint)' : 'transparent',
              border: 'none',
              borderLeft: tab === t.id ? '3px solid var(--purple-primary)' : '3px solid transparent',
              borderRadius: '0 6px 6px 0',
              color: tab === t.id ? 'var(--purple-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 13, cursor: 'pointer', lineHeight: 1.4,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.comingSoon && (
                <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF9E7', color: '#F39C12', border: '1px solid #FAD7A0', borderRadius: 8, padding: '1px 5px', flexShrink: 0 }}>NEW</span>
              )}
              {t.custom && (
                <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--purple-faint)', color: 'var(--purple-primary)', borderRadius: 8, padding: '1px 5px', flexShrink: 0 }}>CUSTOM</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renderContent()}
      </div>

      {showAddModal && <AddSOPModal onSave={handleAddSOP} onClose={() => setShowAddModal(false)} />}
      {deleteModal && <TabConfirmModal message="Delete this SOP?" onConfirm={() => confirmDeleteCustomSOP(deleteModal)} onClose={() => setDeleteModal(null)} />}
    </div>
  );
}
