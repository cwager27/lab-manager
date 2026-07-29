import { useState, useRef, useCallback, useEffect } from 'react';

const MIN_PCT = 2;

export function useResizableColumns(count, initialPcts) {
  const init = initialPcts ?? Array(count).fill(100 / count);
  const [widths, setWidths] = useState(init);
  const widthsRef = useRef(init);
  widthsRef.current = widths;

  // Reset to equal distribution when the column count changes (e.g. dynamic FY columns load)
  useEffect(() => {
    const next = Array(count).fill(100 / count);
    setWidths(next);
    widthsRef.current = next;
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  const onColMouseDown = useCallback((colIdx, tableEl, startClientX) => {
    const tableWidth = tableEl.getBoundingClientRect().width;
    const snapshot = [...widthsRef.current];
    const rightCols = snapshot.slice(colIdx + 1);
    const rightSum = rightCols.reduce((s, w) => s + w, 0);
    const rightCount = rightCols.length;
    if (rightCount === 0) return;

    const onMove = (e) => {
      const deltaPct = ((e.clientX - startClientX) / tableWidth) * 100;
      const maxShrink = snapshot[colIdx] - MIN_PCT;
      const maxGrow = rightSum - rightCount * MIN_PCT;
      const delta = Math.max(-maxShrink, Math.min(deltaPct, maxGrow));

      const next = [...snapshot];
      next[colIdx] = snapshot[colIdx] + delta;
      for (let j = colIdx + 1; j < next.length; j++) {
        const share = rightSum > 0 ? snapshot[j] / rightSum : 1 / rightCount;
        next[j] = Math.max(MIN_PCT, snapshot[j] - delta * share);
      }
      const total = next.reduce((s, w) => s + w, 0);
      setWidths(next.map(w => (w / total) * 100));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return { widths, onColMouseDown };
}

// Drop inside any <th> that has position:relative.
// The last column's resizer is hidden (nothing to distribute delta into).
export function ColResizer({ colIdx, totalCols, tableRef, onColMouseDown }) {
  if (colIdx >= totalCols - 1) return null;
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const tbl = tableRef?.current ?? e.currentTarget.closest('table');
        if (tbl) onColMouseDown(colIdx, tbl, e.clientX);
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 2,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderRight = '2px solid var(--purple-primary, #7B3FA0)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderRight = ''; }}
    />
  );
}
