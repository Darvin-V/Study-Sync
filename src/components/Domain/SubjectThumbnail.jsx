import React from 'react';

/**
 * SubjectThumbnail Component — Editorial Academic Subject Illustrations
 * 
 * Renders lightweight, purposeful SVG illustrations for Topic Rooms,
 * empty states, and learning resources using the StudySync palette:
 * - Surfaces: warm neutral ivory & soft gray (#F3F4F1, #EAECE8)
 * - Linework: deep graphite (#34373B)
 * - Accents: muted sage & olive (#6E776C, #8C948A)
 * - No blue, purple, gradients, or neon.
 */

export function SubjectThumbnail({
  subject = '',
  topic = '',
  variant = 'banner', // 'banner' (wide header strip) | 'thumb' (compact square)
  className = '',
  style = {},
}) {
  const norm = (subject + ' ' + topic).toLowerCase();

  // Determine discipline
  let discipline = 'general';
  if (norm.includes('database') || norm.includes('dbms') || norm.includes('sql') || norm.includes('normalis') || norm.includes('bcnf')) {
    discipline = 'database';
  } else if (norm.includes('algorithm') || norm.includes('graph') || norm.includes('complexity') || norm.includes('tree') || norm.includes('sort')) {
    discipline = 'algorithms';
  } else if (norm.includes('operating') || norm.includes('os') || norm.includes('deadlock') || norm.includes('thread') || norm.includes('process')) {
    discipline = 'os';
  } else if (norm.includes('network') || norm.includes('tcp') || norm.includes('ip') || norm.includes('congestion') || norm.includes('packet')) {
    discipline = 'networks';
  } else if (norm.includes('math') || norm.includes('linear algebra') || norm.includes('eigen') || norm.includes('calculus')) {
    discipline = 'math';
  } else if (norm.includes('machine learning') || norm.includes('ml') || norm.includes('neural') || norm.includes('deep learning')) {
    discipline = 'ml';
  } else if (norm.includes('software') || norm.includes('computer science') || norm.includes('python') || norm.includes('oop') || norm.includes('compiler')) {
    discipline = 'cs';
  }

  const isBanner = variant === 'banner';
  const width = isBanner ? '100%' : '44';
  const height = isBanner ? '64' : '44';
  const viewBox = isBanner ? '0 0 320 64' : '0 0 44 44';

  const renderGraphic = () => {
    switch (discipline) {
      case 'database':
        return isBanner ? (
          <g>
            {/* Relational Table 1 */}
            <rect x="24" y="14" width="76" height="38" rx="3" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <line x1="24" y1="24" x2="100" y2="24" stroke="#6E776C" strokeWidth="1.2" />
            <line x1="32" y1="19" x2="60" y2="19" stroke="#34373B" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="30" cy="31" r="2" fill="#6E776C" />
            <line x1="36" y1="31" x2="68" y2="31" stroke="#8C948A" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="30" cy="41" r="2" fill="#34373B" />
            <line x1="36" y1="41" x2="84" y2="41" stroke="#8C948A" strokeWidth="1.2" strokeLinecap="round" />

            {/* FK Connector */}
            <path d="M100 31 C 120 31, 130 24, 150 24" fill="none" stroke="#6E776C" strokeWidth="1.4" strokeDasharray="3 2" />
            <circle cx="150" cy="24" r="2.5" fill="#6E776C" />

            {/* Relational Table 2 */}
            <rect x="150" y="14" width="84" height="38" rx="3" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <line x1="150" y1="24" x2="234" y2="24" stroke="#6E776C" strokeWidth="1.2" />
            <line x1="158" y1="19" x2="194" y2="19" stroke="#34373B" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="156" cy="31" r="2" fill="#34373B" />
            <line x1="162" y1="31" x2="200" y2="31" stroke="#8C948A" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="156" cy="41" r="2" fill="#6E776C" />
            <line x1="162" y1="41" x2="216" y2="41" stroke="#8C948A" strokeWidth="1.2" strokeLinecap="round" />

            {/* Key icon accent */}
            <g transform="translate(262, 22)">
              <circle cx="8" cy="8" r="6" fill="none" stroke="#6E776C" strokeWidth="1.4" />
              <line x1="12" y1="12" x2="22" y2="22" stroke="#34373B" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="19" y1="19" x2="23" y2="15" stroke="#34373B" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          </g>
        ) : (
          <g transform="translate(4, 4)">
            <rect x="2" y="4" width="32" height="28" rx="2" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <line x1="2" y1="12" x2="34" y2="12" stroke="#6E776C" strokeWidth="1.2" />
            <line x1="7" y1="8" x2="18" y2="8" stroke="#34373B" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="18" r="2" fill="#6E776C" />
            <line x1="13" y1="18" x2="28" y2="18" stroke="#8C948A" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="25" r="2" fill="#34373B" />
            <line x1="13" y1="25" x2="24" y2="25" stroke="#8C948A" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );

      case 'algorithms':
        return isBanner ? (
          <g>
            {/* Graph Lattice / Binary Tree */}
            <line x1="60" y1="18" x2="110" y2="34" stroke="#8C948A" strokeWidth="1.4" />
            <line x1="60" y1="18" x2="30" y2="42" stroke="#8C948A" strokeWidth="1.4" />
            <line x1="110" y1="34" x2="160" y2="22" stroke="#6E776C" strokeWidth="1.6" />
            <line x1="110" y1="34" x2="120" y2="52" stroke="#8C948A" strokeWidth="1.4" />
            <line x1="160" y1="22" x2="210" y2="40" stroke="#6E776C" strokeWidth="1.6" />
            <line x1="210" y1="40" x2="260" y2="24" stroke="#8C948A" strokeWidth="1.4" />

            {/* Nodes */}
            <circle cx="60" cy="18" r="8" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.6" />
            <text x="60" y="22" fontSize="9" fontWeight="600" fill="#34373B" textAnchor="middle" fontFamily="monospace">u</text>

            <circle cx="30" cy="42" r="6" fill="#F4F5F2" stroke="#6E776C" strokeWidth="1.4" />

            <circle cx="110" cy="34" r="9" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.8" />
            <text x="110" y="38" fontSize="9" fontWeight="600" fill="#6E776C" textAnchor="middle" fontFamily="monospace">v</text>

            <circle cx="120" cy="52" r="5" fill="#F4F5F2" stroke="#8C948A" strokeWidth="1.2" />

            <circle cx="160" cy="22" r="9" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.6" />
            <text x="160" y="26" fontSize="9" fontWeight="600" fill="#34373B" textAnchor="middle" fontFamily="monospace">w</text>

            <circle cx="210" cy="40" r="8" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.6" />
            <text x="210" y="44" fontSize="8" fontWeight="600" fill="#6E776C" textAnchor="middle" fontFamily="monospace">k</text>

            <circle cx="260" cy="24" r="6" fill="#F4F5F2" stroke="#8C948A" strokeWidth="1.4" />
          </g>
        ) : (
          <g transform="translate(4, 4)">
            <line x1="18" y1="8" x2="8" y2="22" stroke="#8C948A" strokeWidth="1.4" />
            <line x1="18" y1="8" x2="28" y2="24" stroke="#6E776C" strokeWidth="1.4" />
            <line x1="8" y1="22" x2="16" y2="32" stroke="#8C948A" strokeWidth="1.2" />
            <circle cx="18" cy="8" r="5" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.6" />
            <circle cx="8" cy="22" r="4.5" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.4" />
            <circle cx="28" cy="24" r="5" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <circle cx="16" cy="32" r="3.5" fill="#F4F5F2" stroke="#8C948A" strokeWidth="1.2" />
          </g>
        );

      case 'os':
        return isBanner ? (
          <g>
            {/* Process States Cycle */}
            <rect x="24" y="20" width="62" height="26" rx="4" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <text x="55" y="37" fontSize="10" fontWeight="600" fill="#34373B" textAnchor="middle" fontFamily="sans-serif">READY</text>

            {/* Directed Transitions */}
            <path d="M86 28 L 126 28" fill="none" stroke="#6E776C" strokeWidth="1.6" markerEnd="url(#arrow)" />
            <polygon points="126,28 120,25 120,31" fill="#6E776C" />

            <rect x="128" y="20" width="74" height="26" rx="4" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.6" />
            <text x="165" y="37" fontSize="10" fontWeight="600" fill="#6E776C" textAnchor="middle" fontFamily="sans-serif">RUNNING</text>

            <path d="M202 28 L 236 28" fill="none" stroke="#8C948A" strokeWidth="1.4" />
            <polygon points="236,28 230,25 230,31" fill="#8C948A" />

            <rect x="238" y="20" width="64" height="26" rx="4" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <text x="270" y="37" fontSize="10" fontWeight="600" fill="#34373B" textAnchor="middle" fontFamily="sans-serif">WAITING</text>

            {/* Loopback path */}
            <path d="M270 46 C 270 56, 55 56, 55 46" fill="none" stroke="#8C948A" strokeWidth="1.2" strokeDasharray="3 2" />
          </g>
        ) : (
          <g transform="translate(4, 4)">
            <rect x="3" y="10" width="14" height="14" rx="2" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <line x1="17" y1="17" x2="22" y2="17" stroke="#6E776C" strokeWidth="1.4" />
            <polygon points="23,17 19,14 19,20" fill="#6E776C" />
            <rect x="23" y="10" width="14" height="14" rx="2" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.4" />
            <path d="M30 24 C 30 32, 10 32, 10 24" fill="none" stroke="#8C948A" strokeWidth="1.2" strokeDasharray="2 2" />
          </g>
        );

      case 'networks':
        return isBanner ? (
          <g>
            {/* Packet Stream & Routers */}
            <circle cx="40" cy="32" r="14" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.6" />
            <path d="M34 32 h12 M40 26 v12" stroke="#34373B" strokeWidth="1.4" strokeLinecap="round" />

            <line x1="54" y1="32" x2="136" y2="32" stroke="#8C948A" strokeWidth="1.4" strokeDasharray="4 3" />

            {/* Flying Packets */}
            <rect x="80" y="26" width="14" height="12" rx="2" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.4" />
            <rect x="106" y="26" width="14" height="12" rx="2" fill="#6E776C" />

            <circle cx="150" cy="32" r="14" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.6" />
            <path d="M144 32 h12 M150 26 v12" stroke="#6E776C" strokeWidth="1.4" strokeLinecap="round" />

            <line x1="164" y1="32" x2="246" y2="32" stroke="#8C948A" strokeWidth="1.4" strokeDasharray="4 3" />

            <rect x="190" y="26" width="14" height="12" rx="2" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <rect x="216" y="26" width="14" height="12" rx="2" fill="#34373B" />

            <circle cx="260" cy="32" r="14" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.6" />
            <path d="M254 32 h12 M260 26 v12" stroke="#34373B" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        ) : (
          <g transform="translate(4, 4)">
            <circle cx="8" cy="18" r="6" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <line x1="14" y1="18" x2="22" y2="18" stroke="#8C948A" strokeWidth="1.2" strokeDasharray="2 2" />
            <circle cx="28" cy="18" r="6" fill="#FFFFFF" stroke="#6E776C" strokeWidth="1.4" />
            <circle cx="18" cy="30" r="5" fill="#FFFFFF" stroke="#8C948A" strokeWidth="1.2" />
            <line x1="10" y1="23" x2="15" y2="27" stroke="#8C948A" strokeWidth="1.2" />
            <line x1="26" y1="23" x2="21" y2="27" stroke="#8C948A" strokeWidth="1.2" />
          </g>
        );

      case 'math':
        return isBanner ? (
          <g>
            {/* Coordinate Axis */}
            <line x1="24" y1="50" x2="160" y2="50" stroke="#8C948A" strokeWidth="1.2" />
            <line x1="36" y1="58" x2="36" y2="10" stroke="#8C948A" strokeWidth="1.2" />
            <polygon points="160,50 154,47 154,53" fill="#8C948A" />
            <polygon points="36,10 33,16 39,16" fill="#8C948A" />

            {/* Vector v1 */}
            <line x1="36" y1="50" x2="110" y2="24" stroke="#34373B" strokeWidth="1.8" strokeLinecap="round" />
            <polygon points="110,24 102,23 105,29" fill="#34373B" />
            <text x="114" y="22" fontSize="9" fontWeight="600" fill="#34373B" fontFamily="serif">v&#8321;</text>

            {/* Vector v2 (Orthogonal / Eigenspace) */}
            <line x1="36" y1="50" x2="78" y2="16" stroke="#6E776C" strokeWidth="1.8" strokeLinecap="round" />
            <polygon points="78,16 71,21 76,24" fill="#6E776C" />
            <text x="82" y="14" fontSize="9" fontWeight="600" fill="#6E776C" fontFamily="serif">Av = &lambda;v</text>

            {/* Right-hand side matrix representation */}
            <g transform="translate(196, 16)">
              <text x="0" y="24" fontSize="18" fill="#34373B" fontFamily="serif">[</text>
              <text x="8" y="16" fontSize="10" fill="#34373B" fontFamily="monospace">&lambda;&#8321;  0</text>
              <text x="8" y="28" fontSize="10" fill="#6E776C" fontFamily="monospace">0  &lambda;&#8322;</text>
              <text x="36" y="24" fontSize="18" fill="#34373B" fontFamily="serif">]</text>
              <text x="48" y="22" fontSize="11" fill="#8C948A" fontFamily="serif">det(A &minus; &lambda;I) = 0</text>
            </g>
          </g>
        ) : (
          <g transform="translate(4, 4)">
            <line x1="4" y1="32" x2="32" y2="32" stroke="#8C948A" strokeWidth="1.2" />
            <line x1="6" y1="34" x2="6" y2="4" stroke="#8C948A" strokeWidth="1.2" />
            <line x1="6" y1="32" x2="26" y2="12" stroke="#34373B" strokeWidth="1.6" strokeLinecap="round" />
            <polygon points="26,12 20,13 22,17" fill="#34373B" />
            <line x1="6" y1="32" x2="16" y2="10" stroke="#6E776C" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        );

      case 'cs':
      case 'ml':
      default:
        return isBanner ? (
          <g>
            {/* Structural code module & notebook folio */}
            <rect x="24" y="14" width="120" height="38" rx="4" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <circle cx="36" cy="22" r="2.5" fill="#8C948A" />
            <circle cx="44" cy="22" r="2.5" fill="#6E776C" />
            <circle cx="52" cy="22" r="2.5" fill="#34373B" />
            <line x1="24" y1="28" x2="144" y2="28" stroke="#EAECE8" strokeWidth="1" />
            <line x1="36" y1="35" x2="80" y2="35" stroke="#34373B" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="46" y1="42" x2="114" y2="42" stroke="#6E776C" strokeWidth="1.4" strokeLinecap="round" />

            {/* Academic seminar crest / Compass rings */}
            <g transform="translate(196, 12)">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#6E776C" strokeWidth="1.4" />
              <circle cx="20" cy="20" r="10" fill="none" stroke="#8C948A" strokeWidth="1.2" strokeDasharray="3 2" />
              <circle cx="20" cy="20" r="3" fill="#34373B" />
              <line x1="20" y1="2" x2="20" y2="38" stroke="#8C948A" strokeWidth="1" />
              <line x1="2" y1="20" x2="38" y2="20" stroke="#8C948A" strokeWidth="1" />
              <text x="46" y="24" fontSize="10" fontWeight="600" fill="#34373B" fontFamily="serif" letterSpacing="0.05em">SYLLABUS STUDY</text>
            </g>
          </g>
        ) : (
          <g transform="translate(4, 4)">
            <rect x="4" y="6" width="28" height="24" rx="3" fill="#FFFFFF" stroke="#34373B" strokeWidth="1.4" />
            <circle cx="10" cy="12" r="1.8" fill="#6E776C" />
            <circle cx="16" cy="12" r="1.8" fill="#8C948A" />
            <line x1="10" y1="18" x2="24" y2="18" stroke="#34373B" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="12" y1="23" x2="20" y2="23" stroke="#6E776C" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        );
    }
  };

  return (
    <div
      className={`subject-thumbnail-container ${isBanner ? 'subject-banner' : 'subject-square'} ${className}`.trim()}
      style={{
        backgroundColor: '#F4F5F2',
        borderBottom: isBanner ? '1px solid #DFE2E0' : 'none',
        borderRadius: isBanner ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-sm)',
        border: !isBanner ? '1px solid #DFE2E0' : undefined,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {renderGraphic()}
      </svg>
    </div>
  );
}

export default SubjectThumbnail;
