/* Lezzet arkadaşı — illüstrasyon maskotlar */
const MASCOT_ASSET_VERSION = '1.6.0';

const MASCOT_CHARACTER_LIST = [
    { id: 'bear', label: 'Ayıcık' },
    { id: 'cat', label: 'Kedi' },
    { id: 'dog', label: 'Köpek' },
    { id: 'penguin', label: 'Penguen' },
    { id: 'fox', label: 'Tilki' },
    { id: 'rabbit', label: 'Tavşan' }
];

function mascotFxSvg() {
    return `
        <svg class="mascot-fx" viewBox="0 0 80 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g class="m-sparkle">
                <path d="M62,6 L64,12 L70,12 L65,16 L67,22 L62,18 L57,22 L59,16 L54,12 L60,12 Z" fill="#FBBF24"/>
                <path d="M16,14 L17,17 L20,17 L18,19 L19,22 L16,20 L13,22 L14,19 L12,17 L15,17 Z" fill="#FCD34D"/>
            </g>
            <g class="m-steam">
                <ellipse cx="50" cy="8" rx="3.5" ry="2.2" fill="#94A3B8" opacity="0.75"/>
                <ellipse cx="57" cy="4" rx="2.8" ry="2" fill="#CBD5E1" opacity="0.55"/>
            </g>
            <g class="m-tear">
                <ellipse cx="52" cy="28" rx="2.2" ry="3" fill="#7DD3FC" class="m-tear-drop"/>
                <ellipse cx="52" cy="28" rx="2.2" ry="3" fill="#7DD3FC" class="m-tear-drop m-tear-drop-2"/>
            </g>
            <g class="m-blush">
                <ellipse cx="24" cy="34" rx="6" ry="3.5" fill="#FB7185" opacity="0.35"/>
                <ellipse cx="56" cy="34" rx="6" ry="3.5" fill="#FB7185" opacity="0.35"/>
            </g>
        </svg>
    `;
}

function renderMascotSvg(characterId, { preview = false } = {}) {
    const id = MASCOT_CHARACTER_LIST.some(c => c.id === characterId) ? characterId : 'bear';
    const previewClass = preview ? ' mascot-sprite-preview' : '';
    return `<div class="mascot-sprite${previewClass}">
        <img class="mascot-img" src="/mascots/${id}.png?v=${MASCOT_ASSET_VERSION}" alt="" draggable="false"/>
        ${mascotFxSvg()}
    </div>`;
}

function getMascotCharacter(id) {
    return MASCOT_CHARACTER_LIST.find(c => c.id === id) || MASCOT_CHARACTER_LIST[0];
}
