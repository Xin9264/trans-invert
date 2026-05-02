/* Tiny inline icons (lucide-style) */
const Icon = ({ name, size = 16, stroke = 1.6, className = '', ...rest }) => {
  const s = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home:        <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/></>,
    book:        <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></>,
    history:     <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></>,
    brain:       <><path d="M9 5a3 3 0 0 0-3 3v0a3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 3 3 0 0 0 3-3V5z"/><path d="M15 5a3 3 0 0 1 3 3v0a3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 3 3 0 0 1-3-3"/></>,
    upload:      <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></>,
    settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    chevR:       <><path d="m9 6 6 6-6 6"/></>,
    chevD:       <><path d="m6 9 6 6 6-6"/></>,
    chevL:       <><path d="m15 6-6 6 6 6"/></>,
    folder:      <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/></>,
    folderOpen:  <><path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18l-.7-7H10l-2-2H4.5A1.5 1.5 0 0 0 3 10.5z"/></>,
    plus:        <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    edit:        <><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></>,
    trash:       <><path d="M3 6h18"/><path d="m8 6 1-3h6l1 3"/><path d="M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6"/></>,
    search:      <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    sun:         <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
    moon:        <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></>,
    arrow:       <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    arrowL:      <><path d="M19 12H5"/><path d="m11 5-7 7 7 7"/></>,
    target:      <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    trend:       <><path d="m3 17 6-6 4 4 7-8"/><path d="M14 7h6v6"/></>,
    clock:       <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    award:       <><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/></>,
    download:    <><path d="M12 4v12"/><path d="m17 11-5 5-5-5"/><path d="M4 20h16"/></>,
    move:        <><path d="M5 9h14M5 15h14"/><path d="m9 5-4 4 4 4M15 11l4 4-4 4"/></>,
    rotate:      <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
    grid:        <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    list:        <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    columns:     <><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></>,
    rows:        <><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/></>,
    layers:      <><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 14 9 5 9-5"/></>,
    panel:       <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    sidebarToggle: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M13 9h5M13 12h5M13 15h5"/></>,
    check:       <><path d="m5 12 5 5L20 7"/></>,
    play:        <><path d="m6 4 14 8-14 8z"/></>,
    quote:       <><path d="M7 6h4v4l-2 6H5l2-6V6zM15 6h4v4l-2 6h-4l2-6V6z"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" {...s} className={className} {...rest}>
      {paths[name] || null}
    </svg>
  );
};

window.Icon = Icon;
