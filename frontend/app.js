const API_BASE = window.location.origin;

// DOM Elements
const views = {
    sessions: document.getElementById('sessions-view'),
    players: document.getElementById('players-view')
};

const sessionsList = document.getElementById('sessions-list');
const playersList = document.getElementById('players-list');
const backBtn = document.getElementById('back-btn');
const sessionTitle = document.getElementById('session-title');
const totalPlayersEl = document.getElementById('total-players');

// State
let currentSessions = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    
    backBtn.addEventListener('click', () => {
        showView('sessions');
    });
});

// Navigation
function showView(viewName) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    views[viewName].classList.add('active');
}

// Fetch and render sessions
async function loadSessions() {
    try {
        const response = await fetch(`${API_BASE}/sessions`);
        if (!response.ok) throw new Error('Failed to fetch sessions');
        
        currentSessions = await response.json();
        renderSessions();
    } catch (error) {
        sessionsList.innerHTML = `<p style="color: #ef4444; text-align: center;">Erro ao carregar as peladas. Tente novamente mais tarde.</p>`;
        console.error(error);
    }
}

function renderSessions() {
    if (currentSessions.length === 0) {
        sessionsList.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Nenhuma pelada registrada ainda.</p>`;
        return;
    }
    
    sessionsList.innerHTML = '';
    
    currentSessions.forEach(session => {
        const date = new Date(session.created_at);
        const formattedDate = new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        }).format(date);
        
        const statusClass = session.is_active ? 'active' : 'inactive';
        const statusText = session.is_active ? 'Em andamento' : 'Finalizada';
        
        const el = document.createElement('div');
        el.className = 'session-item';
        el.innerHTML = `
            <div class="session-info">
                <h3>Pelada ${date.toLocaleDateString('pt-BR')}</h3>
                <p>${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}</p>
            </div>
            <div class="badge ${statusClass}">
                ${statusText}
            </div>
        `;
        
        el.addEventListener('click', () => loadSessionDetails(session.id, date));
        sessionsList.appendChild(el);
    });
}

// Fetch and render session details
async function loadSessionDetails(sessionId, date) {
    showView('players');
    playersList.innerHTML = `<tr><td colspan="4" style="text-align:center;"><div class="loader"></div></td></tr>`;
    sessionTitle.textContent = `Pelada - ${date.toLocaleDateString('pt-BR')}`;
    
    try {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}/players`);
        if (!response.ok) throw new Error('Failed to fetch players');
        
        const players = await response.json();
        renderPlayers(players);
    } catch (error) {
        playersList.innerHTML = `<tr><td colspan="4" style="color: #ef4444; text-align: center;">Erro ao carregar jogadores.</td></tr>`;
        console.error(error);
    }
}

function renderPlayers(players) {
    totalPlayersEl.textContent = players.length;
    playersList.innerHTML = '';
    
    if (players.length === 0) {
        playersList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum jogador participou dessa pelada.</td></tr>`;
        return;
    }
    
    players.forEach((player, index) => {
        const el = document.createElement('tr');
        
        // Format time: e.g. "45 min" or "1h 15m" if > 60
        let timeText = '0 min';
        const mins = Math.round(player.estimated_time_minutes);
        if (mins > 0) {
            if (mins >= 60) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                timeText = `${h}h ${m > 0 ? m + 'm' : ''}`;
            } else {
                timeText = `${mins} min`;
            }
        }
        
        el.innerHTML = `
            <td>#${index + 1}</td>
            <td><strong>${player.name}</strong></td>
            <td>${player.matches_played}</td>
            <td><span class="time-badge">⏱️ ${timeText}</span></td>
        `;
        playersList.appendChild(el);
    });
}
