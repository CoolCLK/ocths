const STORAGE_KEY = 'campus_sticky_notes';
const COLORS = [
    '#fff9c4',
    '#fce4ec',
    '#e3f2fd',
    '#e8f5e9',
    '#f3e5f5',
    '#fff3e0',
];
const HEADER_COLORS = [
    '#f9e79f',
    '#f8bbd0',
    '#b3e5fc',
    '#a5d6a7',
    '#ce93d8',
    '#ffcc80',
];

const board = document.getElementById('notesBoard');
const btnAdd = document.getElementById('btnAdd');
let notesData = [];
let zIndexCounter = 10;
let dragState = null;
let saveTimeout = null;

function loadNotes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            notesData = JSON.parse(raw);
            if (!Array.isArray(notesData)) notesData = [];
        }
    } catch (e) {
        notesData = [];
    }
    const maxZ = notesData.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    zIndexCounter = Math.max(maxZ + 1, 10);
    clampAllPositions();
}

function saveNotes() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
        } catch (e) {}
    }, 200);
}

function saveNotesImmediate() {
    clearTimeout(saveTimeout);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
    } catch (e) {}
}

function clampPosition(noteData) {
    const boardW = board.clientWidth || window.innerWidth;
    const boardH = board.clientHeight || window.innerHeight;
    const noteW = window.innerWidth <= 380 ? 150 : window.innerWidth <= 520 ? 175 : 230;
    const noteH = 160;
    const topBarH = document.querySelector('.top-bar')?.offsetHeight || 56;
    noteData.x = Math.max(-noteW + 40, Math.min(noteData.x, boardW - 40));
    noteData.y = Math.max(-20, Math.min(noteData.y, boardH - 50));
    if (noteData.y < -10) noteData.y = topBarH + 10;
}

function clampAllPositions() {
    notesData.forEach(n => clampPosition(n));
}

function createNoteElement(noteData) {
    const el = document.createElement('div');
    el.className = 'note';
    el.setAttribute('data-id', noteData.id);
    el.style.left = noteData.x + 'px';
    el.style.top = noteData.y + 'px';
    el.style.zIndex = noteData.zIndex;
    el.style.backgroundColor = noteData.color;
    el.innerHTML = `
        <div class="note-header" style="background:${getHeaderColor(noteData.color)};">
            <div class="color-dots">
                ${COLORS.map((c, i) => `<span class="color-dot${c === noteData.color ? ' active' : ''}" data-color="${c}" style="background:${c};" aria-label="颜色${i + 1}"></span>`).join('')}
            </div>
            <button class="btn-delete" aria-label="删除便签">✕</button>
        </div>
        <input class="note-title" type="text" placeholder="标题" value="${escapeHtml(noteData.title)}" maxlength="60">
        <textarea class="note-content" placeholder="写点什么..." rows="1">${escapeHtml(noteData.content)}</textarea>
    `;
    el.addEventListener('mousedown', onDragStart);
    el.addEventListener('touchstart', onDragStart, { passive: false });
    el.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(noteData.id);
    });
    el.querySelector('.btn-delete').addEventListener('touchend', (e) => {
        e.stopPropagation();
        e.preventDefault();
        deleteNote(noteData.id);
    });
    el.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const newColor = dot.getAttribute('data-color');
            changeNoteColor(noteData.id, newColor);
        });
        dot.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const newColor = dot.getAttribute('data-color');
            changeNoteColor(noteData.id, newColor);
        });
    });
    const titleInput = el.querySelector('.note-title');
    const contentArea = el.querySelector('.note-content');
    titleInput.addEventListener('input', () => {
        noteData.title = titleInput.value;
        saveNotes();
    });
    contentArea.addEventListener('input', () => {
        noteData.content = contentArea.value;
        saveNotes();
    });
    titleInput.addEventListener('mousedown', (e) => e.stopPropagation());
    titleInput.addEventListener('touchstart', (e) => e.stopPropagation());
    contentArea.addEventListener('mousedown', (e) => e.stopPropagation());
    contentArea.addEventListener('touchstart', (e) => e.stopPropagation());
    return el;
}

function getHeaderColor(noteColor) {
    const idx = COLORS.indexOf(noteColor);
    return idx >= 0 ? HEADER_COLORS[idx] : 'rgba(0,0,0,0.04)';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderAllNotes() {
    board.querySelectorAll('.note').forEach(el => el.remove());
    notesData.forEach(noteData => {
        const el = createNoteElement(noteData);
        board.appendChild(el);
    });
}

function addNote() {
    const boardW = board.clientWidth || window.innerWidth;
    const boardH = board.clientHeight || window.innerHeight;
    const topBarH = document.querySelector('.top-bar')?.offsetHeight || 56;
    const noteW = window.innerWidth <= 380 ? 150 : window.innerWidth <= 520 ? 175 : 230;
    const offsetX = (notesData.length * 28) % 120 - 50;
    const offsetY = (notesData.length * 22) % 100 - 40;
    const startX = Math.max(15, (boardW - noteW) / 2 + offsetX);
    const startY = Math.max(topBarH + 10, topBarH + 50 + offsetY);
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    zIndexCounter++;
    const newNote = {
        id: 'note_' + Date.now(),
        title: '',
        content: '',
        color: randomColor,
        x: Math.round(startX),
        y: Math.round(startY),
        zIndex: zIndexCounter,
    };
    clampPosition(newNote);
    notesData.push(newNote);
    const el = createNoteElement(newNote);
    board.appendChild(el);
    saveNotesImmediate();
    requestAnimationFrame(() => {
        const titleInput = el.querySelector('.note-title');
        if (titleInput) {
            titleInput.focus();
            titleInput.select();
        }
    });
}

function deleteNote(id) {
    const idx = notesData.findIndex(n => n.id === id);
    if (idx === -1) return;
    notesData.splice(idx, 1);
    const el = board.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.6) rotate(15deg)';
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => { if (el.parentNode) el.remove(); }, 250);
    }
    saveNotesImmediate();
}

function changeNoteColor(id, newColor) {
    const noteData = notesData.find(n => n.id === id);
    if (!noteData) return;
    noteData.color = newColor;
    const el = board.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.style.backgroundColor = newColor;
        const header = el.querySelector('.note-header');
        if (header) header.style.background = getHeaderColor(newColor);
        const dots = el.querySelectorAll('.color-dot');
        dots.forEach(d => {
            d.classList.toggle('active', d.getAttribute('data-color') === newColor);
        });
    }
    saveNotes();
}

function onDragStart(e) {
    if (e.target.closest('input, textarea, button, .color-dot')) return;
    const noteEl = e.target.closest('.note');
    if (!noteEl) return;
    const noteData = notesData.find(n => n.id === noteEl.getAttribute('data-id'));
    if (!noteData) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    zIndexCounter++;
    noteData.zIndex = zIndexCounter;
    noteEl.style.zIndex = zIndexCounter;
    noteEl.classList.add('dragging');
    dragState = {
        noteEl,
        noteData,
        startX: clientX,
        startY: clientY,
        origX: noteData.x,
        origY: noteData.y,
        moved: false,
    };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    window.addEventListener('touchcancel', onDragEnd);
}

function onDragMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragState.startX;
    const dy = clientY - dragState.startY;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3 && !dragState.moved) return;
    dragState.moved = true;
    const newX = dragState.origX + dx;
    const newY = dragState.origY + dy;
    dragState.noteData.x = Math.round(newX);
    dragState.noteData.y = Math.round(newY);
    dragState.noteEl.style.left = newX + 'px';
    dragState.noteEl.style.top = newY + 'px';
}

function onDragEnd(e) {
    if (!dragState) return;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
    window.removeEventListener('touchcancel', onDragEnd);
    dragState.noteEl.classList.remove('dragging');
    if (dragState.moved) {
        clampPosition(dragState.noteData);
        dragState.noteEl.style.left = dragState.noteData.x + 'px';
        dragState.noteEl.style.top = dragState.noteData.y + 'px';
        saveNotesImmediate();
    }
    dragState = null;
}

btnAdd.addEventListener('click', addNote);
btnAdd.addEventListener('touchend', (e) => {
    e.preventDefault();
    addNote();
});

function init() {
    loadNotes();
    renderAllNotes();
    if (notesData.length === 0) {
        setTimeout(addNote, 400);
    }
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('resize', () => {
    clampAllPositions();
    const noteEls = board.querySelectorAll('.note');
    noteEls.forEach(el => {
        const id = el.getAttribute('data-id');
        const noteData = notesData.find(n => n.id === id);
        if (noteData) {
            el.style.left = noteData.x + 'px';
            el.style.top = noteData.y + 'px';
        }
    });
});