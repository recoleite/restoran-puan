/* Lezzet arkadaşı — özel SVG karakterler */
const MASCOT_CHARACTER_LIST = [
    { id: 'bear', label: 'Ayıcık' },
    { id: 'cat', label: 'Kedi' },
    { id: 'dog', label: 'Köpek' },
    { id: 'penguin', label: 'Penguen' },
    { id: 'fox', label: 'Tilki' },
    { id: 'rabbit', label: 'Tavşan' }
];

function mascotDefs() {
    return `
        <defs>
            <radialGradient id="mg-bear-fur" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stop-color="#D4A574"/>
                <stop offset="100%" stop-color="#8B5E3C"/>
            </radialGradient>
            <radialGradient id="mg-cat-fur" cx="40%" cy="28%" r="68%">
                <stop offset="0%" stop-color="#FDBA74"/>
                <stop offset="100%" stop-color="#EA580C"/>
            </radialGradient>
            <radialGradient id="mg-dog-fur" cx="38%" cy="25%" r="72%">
                <stop offset="0%" stop-color="#FDE047"/>
                <stop offset="100%" stop-color="#CA8A04"/>
            </radialGradient>
            <radialGradient id="mg-fox-fur" cx="36%" cy="28%" r="70%">
                <stop offset="0%" stop-color="#FB923C"/>
                <stop offset="100%" stop-color="#C2410C"/>
            </radialGradient>
            <radialGradient id="mg-rabbit-fur" cx="40%" cy="30%" r="68%">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="100%" stop-color="#D6D3D1"/>
            </radialGradient>
            <linearGradient id="mg-penguin-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#334155"/>
                <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
            <filter id="mg-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.18"/>
            </filter>
        </defs>
    `;
}

function mascotGroundShadow() {
    return `<ellipse cx="40" cy="84" rx="18" ry="4" fill="#000" opacity="0.12"/>`;
}

function mascotExtras() {
    return `
        <g class="m-sparkle" aria-hidden="true">
            <path d="M62,6 L64,12 L70,12 L65,16 L67,22 L62,18 L57,22 L59,16 L54,12 L60,12 Z" fill="#FBBF24"/>
            <path d="M16,14 L17,17 L20,17 L18,19 L19,22 L16,20 L13,22 L14,19 L12,17 L15,17 Z" fill="#FCD34D"/>
        </g>
        <g class="m-steam" aria-hidden="true">
            <ellipse cx="50" cy="8" rx="3.5" ry="2.2" fill="#94A3B8" opacity="0.75"/>
            <ellipse cx="57" cy="4" rx="2.8" ry="2" fill="#CBD5E1" opacity="0.55"/>
        </g>
    `;
}

function mascotFace(fx, fy) {
    return `
        <g class="m-face" transform="translate(${fx}, ${fy})">
            <g class="m-eyes m-eyes-neutral">
                <ellipse cx="-9" cy="0" rx="3.4" ry="3.8" fill="#1e293b"/>
                <ellipse cx="9" cy="0" rx="3.4" ry="3.8" fill="#1e293b"/>
                <circle cx="-7.5" cy="-1.2" r="1.1" fill="#fff"/>
                <circle cx="10.5" cy="-1.2" r="1.1" fill="#fff"/>
            </g>
            <g class="m-eyes m-eyes-happy">
                <path d="M-13,-1 Q-9,-7 -5,-1" stroke="#1e293b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
                <path d="M5,-1 Q9,-7 13,-1" stroke="#1e293b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-eyes m-eyes-excited">
                <circle cx="-9" cy="0" r="4.2" fill="#1e293b"/>
                <circle cx="9" cy="0" r="4.2" fill="#1e293b"/>
                <circle cx="-7" cy="-1.6" r="1.5" fill="#fff"/>
                <circle cx="11" cy="-1.6" r="1.5" fill="#fff"/>
                <circle cx="-5.5" cy="1" r="0.7" fill="#fff" opacity="0.6"/>
                <circle cx="12.5" cy="1" r="0.7" fill="#fff" opacity="0.6"/>
            </g>
            <g class="m-eyes m-eyes-sad">
                <ellipse cx="-9" cy="2" rx="3.2" ry="3" fill="#1e293b"/>
                <ellipse cx="9" cy="2" rx="3.2" ry="3" fill="#1e293b"/>
                <path d="M-15,-5 Q-9,-2 -3,-4" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
                <path d="M15,-5 Q9,-2 3,-4" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-eyes m-eyes-pout">
                <ellipse cx="-9" cy="1" rx="3.2" ry="3.4" fill="#1e293b"/>
                <path d="M4,4 Q10,0 14,2" stroke="#1e293b" stroke-width="2.8" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-neutral">
                <path d="M-5,11 Q0,14.5 5,11" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-happy">
                <path d="M-8.5,10 Q0,19 8.5,10" stroke="#1e293b" stroke-width="2.3" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-excited">
                <ellipse cx="0" cy="12.5" rx="7" ry="5.5" fill="#1e293b"/>
                <ellipse cx="0" cy="9.5" rx="4.5" ry="2.5" fill="#FB7185"/>
            </g>
            <g class="m-mouth m-mouth-sad">
                <path d="M-6.5,15.5 Q0,11 6.5,15.5" stroke="#1e293b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-pout">
                <path d="M-5.5,13.5 Q0,10 5.5,13.5" stroke="#1e293b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
                <ellipse cx="0" cy="16" rx="5.5" ry="3.5" fill="#FDA4AF" opacity="0.8"/>
            </g>
            <g class="m-blush">
                <ellipse cx="-16" cy="9" rx="5.5" ry="3.2" fill="#FB7185" opacity="0.42"/>
                <ellipse cx="16" cy="9" rx="5.5" ry="3.2" fill="#FB7185" opacity="0.42"/>
            </g>
            <g class="m-tear">
                <ellipse cx="11" cy="5" rx="2" ry="2.8" fill="#7DD3FC" class="m-tear-drop"/>
                <ellipse cx="11" cy="5" rx="2" ry="2.8" fill="#7DD3FC" class="m-tear-drop m-tear-drop-2"/>
            </g>
        </g>
    `;
}

const MASCOT_SVGS = {
    bear: () => `
        <g filter="url(#mg-soft-shadow)">
            <ellipse cx="22" cy="17" rx="10" ry="11" fill="url(#mg-bear-fur)"/>
            <ellipse cx="58" cy="17" rx="10" ry="11" fill="url(#mg-bear-fur)"/>
            <ellipse cx="22" cy="17" rx="5" ry="5.5" fill="#D4A574" opacity="0.55"/>
            <ellipse cx="58" cy="17" rx="5" ry="5.5" fill="#D4A574" opacity="0.55"/>
            <ellipse cx="40" cy="54" rx="21" ry="23" fill="url(#mg-bear-fur)"/>
            <ellipse cx="40" cy="73" rx="17" ry="15" fill="#7C4A2D"/>
            <ellipse cx="27" cy="81" rx="8" ry="5.5" fill="#5C3D2E"/>
            <ellipse cx="53" cy="81" rx="8" ry="5.5" fill="#5C3D2E"/>
            <circle cx="40" cy="37" r="23" fill="url(#mg-bear-fur)"/>
            <ellipse cx="40" cy="44" rx="12" ry="10" fill="#E8C9A0"/>
            <ellipse cx="40" cy="41" rx="4.5" ry="3.5" fill="#3D2914"/>
        </g>
        ${mascotFace(40, 35)}
    `,
    cat: () => `
        <g filter="url(#mg-soft-shadow)">
            <path d="M17,30 L24,6 L31,26 Z" fill="url(#mg-cat-fur)"/>
            <path d="M49,26 L56,6 L63,30 Z" fill="url(#mg-cat-fur)"/>
            <path d="M20,24 L24,12 L28,24 Z" fill="#FED7AA"/>
            <path d="M52,24 L56,12 L60,24 Z" fill="#FED7AA"/>
            <ellipse cx="40" cy="58" rx="19" ry="21" fill="url(#mg-cat-fur)"/>
            <ellipse cx="40" cy="76" rx="13" ry="11" fill="#C2410C"/>
            <circle cx="40" cy="37" r="21" fill="url(#mg-cat-fur)"/>
            <ellipse cx="40" cy="45" rx="9" ry="7" fill="#FFEDD5" opacity="0.85"/>
            <ellipse cx="40" cy="47" rx="3.5" ry="2.5" fill="#9A3412"/>
            <path d="M16,43 L4,41 M16,48 L4,50" stroke="#C2410C" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
            <path d="M64,43 L76,41 M64,48 L76,50" stroke="#C2410C" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
        </g>
        ${mascotFace(40, 35)}
    `,
    dog: () => `
        <g filter="url(#mg-soft-shadow)">
            <ellipse cx="15" cy="35" rx="11" ry="17" fill="#B45309" transform="rotate(-18 15 35)"/>
            <ellipse cx="65" cy="35" rx="11" ry="17" fill="#B45309" transform="rotate(18 65 35)"/>
            <ellipse cx="40" cy="58" rx="20" ry="22" fill="url(#mg-dog-fur)"/>
            <ellipse cx="40" cy="76" rx="14" ry="11" fill="#A16207"/>
            <circle cx="40" cy="37" r="22" fill="url(#mg-dog-fur)"/>
            <ellipse cx="40" cy="47" rx="13" ry="11" fill="#FEF9C3"/>
            <ellipse cx="40" cy="44" rx="5.5" ry="4.5" fill="#422006"/>
            <ellipse cx="36" cy="43" rx="1.2" ry="1.5" fill="#fff" opacity="0.35"/>
            <ellipse cx="44" cy="43" rx="1.2" ry="1.5" fill="#fff" opacity="0.35"/>
        </g>
        ${mascotFace(40, 34)}
        <ellipse class="m-dog-tongue" cx="40" cy="53" rx="4.5" ry="5.5" fill="#FB7185"/>
    `,
    penguin: () => `
        <g filter="url(#mg-soft-shadow)">
            <ellipse cx="40" cy="58" rx="23" ry="27" fill="url(#mg-penguin-body)"/>
            <ellipse cx="40" cy="63" rx="15" ry="19" fill="#F8FAFC"/>
            <ellipse cx="27" cy="69" rx="9" ry="5.5" fill="#1e293b" transform="rotate(-22 27 69)"/>
            <ellipse cx="53" cy="69" rx="9" ry="5.5" fill="#1e293b" transform="rotate(22 53 69)"/>
            <ellipse cx="33" cy="83" rx="8" ry="4.5" fill="#F97316"/>
            <ellipse cx="47" cy="83" rx="8" ry="4.5" fill="#F97316"/>
            <circle cx="40" cy="31" r="21" fill="url(#mg-penguin-body)"/>
            <ellipse cx="40" cy="37" rx="15" ry="13" fill="#F8FAFC"/>
            <path d="M40,41 L33,50 L47,50 Z" fill="#FB923C"/>
            <path d="M40,41 L33,50 L47,50 Z" fill="none" stroke="#EA580C" stroke-width="0.8"/>
        </g>
        ${mascotFace(40, 31)}
    `,
    fox: () => `
        <g filter="url(#mg-soft-shadow)">
            <path d="M12,34 L22,4 L34,28 Z" fill="url(#mg-fox-fur)"/>
            <path d="M46,28 L58,4 L68,34 Z" fill="url(#mg-fox-fur)"/>
            <path d="M18,26 L22,14 L26,26 Z" fill="#FFEDD5"/>
            <path d="M54,26 L58,14 L62,26 Z" fill="#FFEDD5"/>
            <path d="M40,58 L20,80 L60,80 Z" fill="#EA580C"/>
            <ellipse cx="40" cy="56" rx="18" ry="19" fill="url(#mg-fox-fur)"/>
            <circle cx="40" cy="35" r="21" fill="url(#mg-fox-fur)"/>
            <path d="M40,49 L26,64 L54,64 Z" fill="#FFF7ED"/>
            <ellipse cx="40" cy="43" rx="4" ry="3" fill="#1e293b"/>
            <ellipse cx="38" cy="42" rx="0.8" ry="1" fill="#fff" opacity="0.5"/>
        </g>
        ${mascotFace(40, 33)}
    `,
    rabbit: () => `
        <g filter="url(#mg-soft-shadow)">
            <ellipse cx="27" cy="13" rx="8" ry="20" fill="url(#mg-rabbit-fur)"/>
            <ellipse cx="53" cy="13" rx="8" ry="20" fill="url(#mg-rabbit-fur)"/>
            <ellipse cx="27" cy="13" rx="4.5" ry="15" fill="#FECDD3" opacity="0.65"/>
            <ellipse cx="53" cy="13" rx="4.5" ry="15" fill="#FECDD3" opacity="0.65"/>
            <ellipse cx="40" cy="58" rx="18" ry="20" fill="url(#mg-rabbit-fur)"/>
            <ellipse cx="40" cy="76" rx="12" ry="10" fill="#A8A29E"/>
            <circle cx="40" cy="39" r="20" fill="url(#mg-rabbit-fur)"/>
            <ellipse cx="40" cy="48" rx="7" ry="6" fill="#FECDD3" opacity="0.7"/>
            <ellipse cx="40" cy="46" rx="3" ry="2.5" fill="#78716C"/>
            <ellipse cx="36" cy="45" rx="0.8" ry="1" fill="#fff" opacity="0.4"/>
            <ellipse cx="44" cy="45" rx="0.8" ry="1" fill="#fff" opacity="0.4"/>
        </g>
        ${mascotFace(40, 37)}
    `
};

function renderMascotSvg(characterId, { preview = false } = {}) {
    const id = MASCOT_CHARACTER_LIST.some(c => c.id === characterId) ? characterId : 'bear';
    const body = MASCOT_SVGS[id]?.() || MASCOT_SVGS.bear();
    const cls = preview ? 'mascot-svg mascot-svg-preview' : 'mascot-svg';
    return `<svg class="${cls}" viewBox="0 0 80 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${mascotDefs()}
        ${mascotGroundShadow()}
        <g class="mascot-figure">${body}${mascotExtras()}</g>
    </svg>`;
}

function getMascotCharacter(id) {
    return MASCOT_CHARACTER_LIST.find(c => c.id === id) || MASCOT_CHARACTER_LIST[0];
}
