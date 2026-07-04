export function getMaintCycleKey(resetFreq) {
  const n = new Date();
  const pad = v => String(v).padStart(2, '0');
  if (resetFreq === 'daily') return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
  if (resetFreq === 'weekly') {
    const day = n.getDay(); const diff = day === 0 ? -6 : 1 - day;
    const m = new Date(n); m.setDate(n.getDate() + diff);
    return `${m.getFullYear()}-${pad(m.getMonth()+1)}-${pad(m.getDate())}`;
  }
  if (resetFreq === 'monthly') return `${n.getFullYear()}-${pad(n.getMonth()+1)}`;
  if (resetFreq === 'yearly') return `${n.getFullYear()}`;
  if (resetFreq === 'every5') {
    const base = 2025; return `${Math.floor((n.getFullYear()-base)/5)*5+base}`;
  }
  return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
}

export function getMaintNextDue(resetFreq) {
  const n = new Date();
  if (resetFreq === 'daily') {
    const t = new Date(n); t.setDate(t.getDate()+1);
    return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (resetFreq === 'weekly') {
    const day = n.getDay(); const diff = day === 0 ? 1 : 8 - day;
    const m = new Date(n); m.setDate(n.getDate()+diff);
    return m.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (resetFreq === 'monthly') {
    const m = new Date(n.getFullYear(), n.getMonth()+1, 1);
    return m.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (resetFreq === 'yearly') return `Jan 1, ${n.getFullYear()+1}`;
  if (resetFreq === 'every5') {
    const base = 2025; const cy = Math.floor((n.getFullYear()-base)/5)*5+base;
    return `Jan 1, ${cy+5}`;
  }
  return '';
}

export function getMaintKey(equipId, freqId, resetFreq, parentId, subId) {
  return `${equipId}|${freqId}|${parentId}|${subId}|${getMaintCycleKey(resetFreq)}`;
}
export function isMaintSubDone(checks, equipId, freqId, resetFreq, parentId, sub) {
  const val = checks[getMaintKey(equipId, freqId, resetFreq, parentId, sub.id)];
  return sub.type === 'yn' ? val === 'Y' : val === 'done';
}
export function isMaintParentDone(checks, equip, freq, parent) {
  return parent.subItems.every(s => isMaintSubDone(checks, equip.id, freq.id, freq.resetFreq, parent.id, s));
}
export function isMaintFreqDone(checks, equip, freq) {
  return freq.parents.every(p => isMaintParentDone(checks, equip, freq, p));
}

export const EQUIPMENT_MAINTENANCE = [
  {
    id: 'cryo', name: 'Cryo Freezer',
    note: 'Wait until breaks or has issues — can be filled manually (like a dewar), so monitoring is fine; no regular maintenance required.',
    frequencies: [
      {
        id: 'weekly', label: 'Weekly', subtitle: 'Catch immediate risks', resetFreq: 'weekly',
        parents: [
          {
            id: 'p1', label: 'Confirm freezer is operating normally:',
            subItems: [
              { id: 's1', label: 'Temperature stable (top & bottom probes)', type: 'yn' },
              { id: 's2', label: 'LN₂ level within operating range', type: 'yn' },
              { id: 's3', label: 'Supply pressure ~20 PSI (verify via gauge)', type: 'yn' },
            ],
          },
          {
            id: 'p2', label: 'Visual inspection (alarm-independent):',
            subItems: [
              { id: 's1', label: 'No abnormal frost or condensation on lid, body, or vents', type: 'yn' },
              { id: 's2', label: 'No ice buildup or leaks at LN₂ connections', type: 'yn' },
            ],
            warning: 'If any N: contact manufacturer directly (phone or live support) same day and coordinate resolution.',
          },
        ],
      },
      {
        id: 'monthly', label: 'Monthly', subtitle: 'Catch silent or slow failures', resetFreq: 'monthly',
        parents: [
          {
            id: 'p1', label: 'Alarm pathway test:',
            subItems: [
              { id: 's1', label: 'Remote alarms (email/text) trigger correctly', type: 'yn' },
            ],
            warning: 'Contact: Brian Imperiale',
          },
          {
            id: 'p2', label: 'Event & usage review (from log files):',
            subItems: [
              { id: 's1', label: 'LN₂ consumption vs baseline — no sustained increase ≥2 consecutive months (unless explained by inventory or door use)', type: 'yn' },
              { id: 's2', label: 'No repeated or time-patterned alarms, even if self-resolving', type: 'yn' },
              { id: 's3', label: 'Auto-fill not happening more often, taking longer, or struggling to complete', type: 'yn' },
            ],
            warning: 'Check LED display for LN₂ consumption. If any N: contact manufacturer directly and coordinate resolution.',
          },
        ],
      },
      {
        id: 'yearly', label: 'Yearly', resetFreq: 'yearly',
        parents: [
          {
            id: 'p1', label: 'Confirm manufacturer completed and documented:',
            subItems: [
              { id: 's1', label: 'Annual functional testing', type: 'yn' },
              { id: 's2', label: 'Real-time clock battery replacement (within last 12 months)', type: 'yn' },
            ],
          },
          {
            id: 'p2', label: 'Service documentation:',
            subItems: [
              { id: 's1', label: 'Service documentation saved in equipment records', type: 'yn' },
            ],
          },
        ],
      },
      {
        id: 'every5', label: 'Every 5 Years', resetFreq: 'every5',
        parents: [
          {
            id: 'p1', label: 'Confirm manufacturer completed:',
            subItems: [
              { id: 's1', label: 'Solenoid valve replacement', type: 'yn' },
              { id: 's2', label: 'Relief valve replacement', type: 'yn' },
              { id: 's3', label: 'Battery backup replacement', type: 'yn' },
              { id: 's4', label: 'Temperature sensor replacement', type: 'yn' },
              { id: 's5', label: 'Lid gasket replacement', type: 'yn' },
              { id: 's6', label: 'Full thaw, decontaminate, and dry freezer', type: 'yn' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'co2', name: 'CO₂ Incubators',
    frequencies: [
      {
        id: 'daily', label: 'Daily', resetFreq: 'daily',
        parents: [
          {
            id: 'p1', label: 'Check incubator status:',
            subItems: [
              { id: 's1', label: 'Temperature & CO₂ within set range', type: 'yn', warning: 'If not within set range, system will alarm' },
              { id: 's2', label: 'No active alarms: temp, CO₂, door, water level (RH PAN on big incubator)', type: 'yn' },
              { id: 's3', label: 'Inner doors closed before outer doors', type: 'yn' },
            ],
            warning: 'If any N: fix immediately, or contact manufacturer/service if needed.',
          },
        ],
      },
      {
        id: 'weekly', label: 'Weekly', subtitle: "Alarms don't cover these", resetFreq: 'weekly',
        parents: [
          {
            id: 'p1', label: 'CO₂ supply system:',
            subItems: [
              { id: 's1', label: 'Cylinder regulator gauge — pressure normal, no rapid drop', type: 'yn' },
              { id: 's2', label: 'Tubing intact — no kinks, cracks, leaks, or stiffness', type: 'yn' },
            ],
          },
          {
            id: 'p2', label: 'Incubator integrity:',
            subItems: [
              { id: 's1', label: 'No persistent door condensation', type: 'yn' },
              { id: 's2', label: 'Door seals/gaskets intact and sealing fully', type: 'yn' },
              { id: 's3', label: 'Interior free of contamination: no spills, debris, residue, mold, fingerprints', type: 'yn' },
              { id: 's4', label: 'Humidifying pan checked/filled with sufficient sterile distilled water (enough until next weekly check)', type: 'yn' },
            ],
            warning: 'If any N: fix or contact manufacturer/service. If contamination found: contact PI immediately.',
          },
        ],
      },
      {
        id: 'monthly', label: 'Monthly', resetFreq: 'monthly',
        parents: [
          {
            id: 'p1', label: 'Airflow components (accessible fans, ducts):',
            subItems: [
              { id: 's1', label: 'No contamination or repair needed — no cleaning required this month', type: 'yn' },
            ],
          },
          {
            id: 'p2', label: 'Humidification system — perform full clean:',
            subItems: [
              { id: 's1', label: 'Drain reservoir', type: 'action' },
              { id: 's2', label: 'Clean with neutral detergent', type: 'action' },
              { id: 's3', label: 'Rinse with sterile distilled water (SDW)', type: 'action' },
              { id: 's4', label: 'Alcohol disinfect', type: 'action' },
              { id: 's5', label: 'Refill with SDW pre-warmed to 37°C', type: 'action', note: 'Room temp is fine' },
            ],
          },
          {
            id: 'p3', label: 'Internal surfaces:',
            subItems: [
              { id: 's1', label: 'Wipe down all internal surfaces with alcohol', type: 'action' },
            ],
          },
          {
            id: 'p4', label: 'System review (alarm & operation logs):',
            subItems: [
              { id: 's1', label: 'No abnormal patterns in temperature, CO₂, or door openings', type: 'yn' },
              { id: 's2', label: 'Logging interval unchanged (logs every ~6 minutes)', type: 'yn' },
            ],
          },
        ],
      },
      {
        id: 'annually', label: 'Annually', resetFreq: 'yearly',
        parents: [
          {
            id: 'p1', label: 'Vendor service:',
            subItems: [{ id: 's1', label: 'Vendor service completed, including CO₂ sensor calibration', type: 'yn' }],
          },
          {
            id: 'p2', label: 'Multi-year maintenance:',
            subItems: [{ id: 's1', label: 'Multi-year maintenance items tracked and scheduled if needed', type: 'yn' }],
          },
        ],
      },
      {
        id: 'every56', label: 'Every 5–6 Years', resetFreq: 'every5',
        parents: [
          {
            id: 'p1', label: 'Humidity control:',
            subItems: [{ id: 's1', label: 'Humidity control bar replaced', type: 'action' }],
          },
        ],
      },
    ],
  },
  {
    id: 'celldrop', name: 'Cell Drop',
    frequencies: [
      {
        id: 'weekly', label: 'Weekly', resetFreq: 'weekly',
        parents: [
          {
            id: 'p1', label: 'Clean device:',
            subItems: [{ id: 's1', label: 'Clean sample and external surfaces with 70% ethanol on a cloth (do not spray directly on device)', type: 'action' }],
          },
        ],
      },
    ],
  },
  {
    id: 'evos', name: 'EVOS',
    frequencies: [
      {
        id: 'monthly', label: 'Monthly', resetFreq: 'monthly',
        parents: [
          {
            id: 'p1', label: 'Clean device:',
            subItems: [{ id: 's1', label: 'Clean sample and external surfaces with 70% ethanol on a cloth (do not spray directly on device)', type: 'action' }],
          },
        ],
      },
    ],
  },
  {
    id: 'thermomixer', name: 'Thermomixer',
    frequencies: [
      {
        id: 'monthly', label: 'Monthly', resetFreq: 'monthly',
        parents: [
          {
            id: 'p1', label: 'Clean device (full procedure):',
            subItems: [
              { id: 's1', label: 'Power off and disconnect from mains', type: 'action' },
              { id: 's2', label: 'Allow to cool down completely', type: 'action' },
              { id: 's3', label: 'Clean with mild soap-based detergent', type: 'action' },
              { id: 's4', label: 'Rinse with distilled water and dry fully', type: 'action' },
              { id: 's5', label: 'Wipe with 70% ethanol on a cloth (do not spray directly on device)', type: 'action' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'centrifuge', name: 'Large Centrifuges',
    frequencies: [
      {
        id: 'as-needed', label: 'As Needed', resetFreq: 'monthly',
        parents: [
          {
            id: 'p1', label: 'Lid gas springs:',
            subItems: [
              { id: 's1', label: 'Lid gas springs functioning — no replacement needed', type: 'yn' },
              { id: 's2', label: 'If replaced: replacement date recorded in equipment maintenance log', type: 'action' },
            ],
          },
        ],
      },
      {
        id: 'monthly', label: 'Monthly', resetFreq: 'monthly',
        parents: [
          {
            id: 'p1', label: 'Lid inspection:',
            subItems: [
              { id: 's1', label: 'Lid opens smoothly and remains fully open without drifting or falling', type: 'yn' },
              { id: 's2', label: 'No unusual resistance, noise, or asymmetry', type: 'yn' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'pipettes', name: 'Pipettes',
    frequencies: [
      {
        id: 'annually', label: 'Annually', resetFreq: 'yearly',
        parents: [
          {
            id: 'p1', label: 'Calibration:',
            subItems: [{ id: 's1', label: 'Calibration completed for all single and multichannel pipettes', type: 'action' }],
          },
        ],
      },
    ],
  },
  {
    id: 'confocal', name: 'Confocal Microscope',
    frequencies: [
      {
        id: 'annually', label: 'Annually', resetFreq: 'yearly',
        parents: [
          {
            id: 'p1', label: 'Preventative maintenance:',
            subItems: [{ id: 's1', label: 'Annual preventative maintenance of system completed', type: 'yn' }],
          },
        ],
      },
    ],
  },
  {
    id: 'freezers', name: 'Freezers',
    frequencies: [
      {
        id: 'annually', label: 'Annually', resetFreq: 'yearly',
        parents: [
          {
            id: 'p1', label: 'Defrost:',
            subItems: [{ id: 's1', label: 'Annual defrost performed to remove snow/ice buildup', type: 'action' }],
          },
        ],
      },
    ],
  },
];
