export function fmtName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

export function sortByLast(arr, getName = x => x.full_name) {
  return [...arr].sort((a, b) => {
    const aParts = (getName(a) || '').trim().split(/\s+/);
    const bParts = (getName(b) || '').trim().split(/\s+/);
    return (aParts[aParts.length - 1] || '').localeCompare(bParts[bParts.length - 1] || '');
  });
}
