/* Lezzet arkadaşı — özel SVG karakterler */
const MASCOT_CHARACTER_LIST = [
    { id: 'bear', label: 'Ayıcık' },
    { id: 'cat', label: 'Kedi' },
    { id: 'dog', label: 'Köpek' },
    { id: 'penguin', label: 'Penguen' },
    { id: 'fox', label: 'Tilki' },
    { id: 'rabbit', label: 'Tavşan' }
];

function mascotExtras() {
    return `
        <g class="m-sparkle" aria-hidden="true">
            <polygon points="62,8 64,14 70,14 65,18 67,24 62,20 57,24 59,18 54,14 60,14" fill="#fbbf24"/>
            <polygon points="14,16 15,19 18,19 16,21 17,24 14,22 11,24 12,21 10,19 13,19" fill="#fbbf24"/>
        </g>
        <g class="m-steam" aria-hidden="true">
            <ellipse cx="52" cy="6" rx="3" ry="2" fill="#cbd5e1" opacity="0.8"/>
            <ellipse cx="58" cy="2" rx="2.5" ry="1.8" fill="#cbd5e1" opacity="0.6"/>
        </g>
    `;
}

function mascotFace(fx, fy) {
    return `
        <g class="m-face" transform="translate(${fx}, ${fy})">
            <g class="m-eyes m-eyes-neutral">
                <circle cx="-9" cy="0" r="3.2" fill="#1f2937"/>
                <circle cx="9" cy="0" r="3.2" fill="#1f2937"/>
                <circle cx="-7.5" cy="-1" r="1" fill="#fff" opacity="0.9"/>
                <circle cx="10.5" cy="-1" r="1" fill="#fff" opacity="0.9"/>
            </g>
            <g class="m-eyes m-eyes-happy">
                <path d="M-13,-1 Q-9,-6 -5,-1" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>
                <path d="M5,-1 Q9,-6 13,-1" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-eyes m-eyes-excited">
                <circle cx="-9" cy="0" r="4" fill="#1f2937"/>
                <circle cx="9" cy="0" r="4" fill="#1f2937"/>
                <circle cx="-7" cy="-1.5" r="1.4" fill="#fff"/>
                <circle cx="11" cy="-1.5" r="1.4" fill="#fff"/>
            </g>
            <g class="m-eyes m-eyes-sad">
                <circle cx="-9" cy="2" r="3" fill="#1f2937"/>
                <circle cx="9" cy="2" r="3" fill="#1f2937"/>
                <path d="M-14,-4 L-4,-2" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
                <path d="M14,-4 L4,-2" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
            </g>
            <g class="m-eyes m-eyes-pout">
                <circle cx="-9" cy="1" r="3" fill="#1f2937"/>
                <path d="M5,3 L13,1" stroke="#1f2937" stroke-width="2.8" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-neutral">
                <path d="M-5,11 Q0,14 5,11" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-happy">
                <path d="M-8,10 Q0,18 8,10" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-excited">
                <ellipse cx="0" cy="12" rx="6.5" ry="5" fill="#1f2937"/>
                <ellipse cx="0" cy="9.5" rx="4" ry="2.2" fill="#fb7185"/>
            </g>
            <g class="m-mouth m-mouth-sad">
                <path d="M-6,15 Q0,11 6,15" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
            </g>
            <g class="m-mouth m-mouth-pout">
                <path d="M-5,13 Q0,10 5,13" stroke="#1f2937" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                <ellipse cx="0" cy="15" rx="5" ry="3.2" fill="#fda4af" opacity="0.75"/>
            </g>
            <g class="m-blush">
                <ellipse cx="-15" cy="9" rx="5" ry="3" fill="#fb7185" opacity="0.45"/>
                <ellipse cx="15" cy="9" rx="5" ry="3" fill="#fb7185" opacity="0.45"/>
            </g>
            <g class="m-tear">
                <circle cx="10" cy="4" r="2.2" fill="#7dd3fc" class="m-tear-drop"/>
                <circle cx="10" cy="4" r="2.2" fill="#7dd3fc" class="m-tear-drop m-tear-drop-2"/>
            </g>
        </g>
    `;
}

const MASCOT_SVGS = {
    bear: () => `
        <ellipse cx="22" cy="18" rx="9" ry="10" fill="#8B5E3C"/>
        <ellipse cx="58" cy="18" rx="9" ry="10" fill="#8B5E3C"/>
        <ellipse cx="40" cy="52" rx="20" ry="22" fill="#A0714F"/>
        <ellipse cx="40" cy="72" rx="16" ry="14" fill="#8B5E3C"/>
        <ellipse cx="28" cy="80" rx="7" ry="5" fill="#6B4423"/>
        <ellipse cx="52" cy="80" rx="7" ry="5" fill="#6B4423"/>
        <circle cx="40" cy="38" r="22" fill="#A0714F"/>
        <ellipse cx="40" cy="44" rx="11" ry="9" fill="#D4A574"/>
        <ellipse cx="40" cy="42" rx="4" ry="3" fill="#3D2914"/>
        ${mascotFace(40, 36)}
    `,
    cat: () => `
        <path d="M18,28 L24,8 L30,24 Z" fill="#F97316"/>
        <path d="M50,24 L56,8 L62,28 Z" fill="#F97316"/>
        <ellipse cx="40" cy="58" rx="18" ry="20" fill="#FB923C"/>
        <ellipse cx="40" cy="76" rx="12" ry="10" fill="#EA580C"/>
        <circle cx="40" cy="38" r="20" fill="#FB923C"/>
        <ellipse cx="40" cy="44" rx="8" ry="6" fill="#FED7AA" opacity="0.7"/>
        <path d="M18,42 L8,40" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M18,46 L8,48" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M62,42 L72,40" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M62,46 L72,48" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
        <ellipse cx="40" cy="46" rx="3" ry="2" fill="#7C2D12"/>
        ${mascotFace(40, 36)}
    `,
    dog: () => `
        <ellipse cx="16" cy="34" rx="10" ry="16" fill="#CA8A04" transform="rotate(-15 16 34)"/>
        <ellipse cx="64" cy="34" rx="10" ry="16" fill="#CA8A04" transform="rotate(15 64 34)"/>
        <ellipse cx="40" cy="58" rx="19" ry="21" fill="#EAB308"/>
        <ellipse cx="40" cy="76" rx="13" ry="10" fill="#CA8A04"/>
        <circle cx="40" cy="38" r="21" fill="#FACC15"/>
        <ellipse cx="40" cy="46" rx="12" ry="10" fill="#FEF9C3"/>
        <ellipse cx="40" cy="44" rx="5" ry="4" fill="#422006"/>
        ${mascotFace(40, 35)}
        <ellipse class="m-dog-tongue" cx="40" cy="52" rx="4" ry="5" fill="#fb7185"/>
    `,
    penguin: () => `
        <ellipse cx="40" cy="58" rx="22" ry="26" fill="#1e293b"/>
        <ellipse cx="40" cy="62" rx="14" ry="18" fill="#f8fafc"/>
        <ellipse cx="28" cy="68" rx="8" ry="5" fill="#1e293b" transform="rotate(-20 28 68)"/>
        <ellipse cx="52" cy="68" rx="8" ry="5" fill="#1e293b" transform="rotate(20 52 68)"/>
        <ellipse cx="34" cy="82" rx="7" ry="4" fill="#f97316"/>
        <ellipse cx="46" cy="82" rx="7" ry="4" fill="#f97316"/>
        <circle cx="40" cy="32" r="20" fill="#1e293b"/>
        <ellipse cx="40" cy="38" rx="14" ry="12" fill="#f8fafc"/>
        <path d="M40,42 L34,50 L46,50 Z" fill="#f97316"/>
        ${mascotFace(40, 32)}
    `,
    fox: () => `
        <path d="M14,32 L22,6 L32,26 Z" fill="#EA580C"/>
        <path d="M48,26 L58,6 L66,32 Z" fill="#EA580C"/>
        <path d="M40,58 L22,78 L58,78 Z" fill="#F97316"/>
        <ellipse cx="40" cy="56" rx="17" ry="18" fill="#F97316"/>
        <circle cx="40" cy="36" r="20" fill="#F97316"/>
        <path d="M40,48 L28,62 L52,62 Z" fill="#fff7ed"/>
        <ellipse cx="40" cy="44" rx="3.5" ry="2.5" fill="#1f2937"/>
        ${mascotFace(40, 34)}
    `,
    rabbit: () => `
        <ellipse cx="28" cy="14" rx="7" ry="18" fill="#F5F5F4"/>
        <ellipse cx="28" cy="14" rx="4" ry="14" fill="#FDA4AF" opacity="0.5"/>
        <ellipse cx="52" cy="14" rx="7" ry="18" fill="#F5F5F4"/>
        <ellipse cx="52" cy="14" rx="4" ry="14" fill="#FDA4AF" opacity="0.5"/>
        <ellipse cx="40" cy="58" rx="17" ry="19" fill="#E7E5E4"/>
        <ellipse cx="40" cy="76" rx="11" ry="9" fill="#D6D3D1"/>
        <circle cx="40" cy="40" r="19" fill="#F5F5F4"/>
        <ellipse cx="40" cy="48" rx="6" ry="5" fill="#FDA4AF" opacity="0.55"/>
        <ellipse cx="40" cy="46" rx="2.5" ry="2" fill="#78716C"/>
        ${mascotFace(40, 38)}
    `
};

function renderMascotSvg(characterId, { preview = false } = {}) {
    const id = MASCOT_CHARACTER_LIST.some(c => c.id === characterId) ? characterId : 'bear';
    const body = MASCOT_SVGS[id]?.() || MASCOT_SVGS.bear();
    const cls = preview ? 'mascot-svg mascot-svg-preview' : 'mascot-svg';
    return `<svg class="${cls}" viewBox="0 0 80 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g class="mascot-figure">${body}${mascotExtras()}</g>
    </svg>`;
}

function getMascotCharacter(id) {
    return MASCOT_CHARACTER_LIST.find(c => c.id === id) || MASCOT_CHARACTER_LIST[0];
}
