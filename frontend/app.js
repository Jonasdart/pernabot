const API_BASE = window.location.origin;

// DOM Elements
const views = {
    sessions: document.getElementById('sessions-view'),
    players: document.getElementById('players-view')
};

const sessionsList = document.getElementById('sessions-list');
const playersList = document.getElementById('players-list');
const presenceList = document.getElementById('presence-list');
const paymentList = document.getElementById('payment-list');
const backBtn = document.getElementById('back-btn');
const sessionTitle = document.getElementById('session-title');

const refreshBtn = document.getElementById('refresh-btn');
const refreshSessionsBtn = document.getElementById('refresh-sessions-btn');

// Stat Elements
const totalConfirmedEl = document.getElementById('total-confirmed');
const totalArrivedEl = document.getElementById('total-arrived');
const totalPayingEl = document.getElementById('total-paying');

// State
let currentSessions = [];
let currentPlayers = [];
let activeSessionId = null;
let activeSessionDate = null;

// Sort State
let sortField = 'pts';
let sortDirection = 'desc';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    setupTabs();
    setupSorting();
    
    backBtn.addEventListener('click', () => {
        showView('sessions');
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (!activeSessionId) return;
            refreshBtn.innerHTML = `<span class="spin-icon">🔄</span> Atualizando...`;
            await loadSessionDetails(activeSessionId, activeSessionDate);
            refreshBtn.innerHTML = `🔄 Atualizar`;
        });
    }

    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', async () => {
            refreshSessionsBtn.innerHTML = `<span class="spin-icon">🔄</span> Atualizando...`;
            await loadSessions();
            refreshSessionsBtn.innerHTML = `🔄 Atualizar`;
        });
    }
});

// Setup tab buttons navigation
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');
        });
    });
}

// Setup sortable headers
function setupSorting() {
    const headers = document.querySelectorAll('#stats-table-header th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (sortField === field) {
                sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
            } else {
                sortField = field;
                sortDirection = (field === 'name' || field === 'pos') ? 'asc' : 'desc';
            }

            headers.forEach(h => {
                h.classList.remove('active', 'asc', 'desc');
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.textContent = '';
            });

            th.classList.add('active', sortDirection);
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.textContent = sortDirection === 'desc' ? '▼' : '▲';

            renderStatsTable(currentPlayers);
        });
    });
}

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
    activeSessionId = sessionId;
    activeSessionDate = date;
    showView('players');
    
    const loadingHtml = `<tr><td colspan="6" style="text-align:center;"><div class="loader"></div></td></tr>`;
    playersList.innerHTML = loadingHtml;
    presenceList.innerHTML = loadingHtml;
    paymentList.innerHTML = loadingHtml;
    
    sessionTitle.textContent = `Pelada - ${date.toLocaleDateString('pt-BR')}`;
    
    try {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}/players`);
        if (!response.ok) throw new Error('Failed to fetch players');
        
        currentPlayers = await response.json();
        renderAllTables(currentPlayers);
    } catch (error) {
        const errorHtml = `<tr><td colspan="6" style="color: #ef4444; text-align: center;">Erro ao carregar jogadores.</td></tr>`;
        playersList.innerHTML = errorHtml;
        presenceList.innerHTML = errorHtml;
        paymentList.innerHTML = errorHtml;
        console.error(error);
    }
}

function renderAllTables(players) {
    const confirmedCount = players.filter(p => p.is_confirmed || p.has_arrived).length;
    const arrivedCount = players.filter(p => p.has_arrived).length;
    const payingCount = players.filter(p => p.is_paying).length;

    totalConfirmedEl.textContent = confirmedCount;
    totalArrivedEl.textContent = arrivedCount;
    totalPayingEl.textContent = `${payingCount} / ${confirmedCount || players.length}`;

    renderStatsTable(players);
    renderPresenceTable(players);
    renderPaymentTable(players);
}

// Tab 1: Game Stats Table
function renderStatsTable(players) {
    playersList.innerHTML = '';
    const activePlayers = players.filter(p => p.has_arrived || p.matches_played > 0);
    
    if (activePlayers.length === 0) {
        playersList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum jogador em quadra ainda.</td></tr>`;
        return;
    }

    // Ensure points are calculated (V:3, E:1, D:0)
    activePlayers.forEach(p => {
        const wins = p.wins || 0;
        const draws = p.draws || 0;
        p.points = p.points !== undefined ? p.points : (wins * 3 + draws * 1);
    });

    // Assign overall rank based on points -> wins -> matches
    const defaultRanked = [...activePlayers].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        return b.matches_played - a.matches_played;
    });

    defaultRanked.forEach((p, idx) => {
        p.rank = idx + 1;
    });

    // Sort according to user selected column
    const sorted = [...activePlayers].sort((a, b) => {
        let valA, valB;
        if (sortField === 'pos') {
            valA = a.rank;
            valB = b.rank;
        } else if (sortField === 'name') {
            return sortDirection === 'asc' 
                ? a.name.localeCompare(b.name, 'pt-BR') 
                : b.name.localeCompare(a.name, 'pt-BR');
        } else if (sortField === 'matches') {
            valA = a.matches_played;
            valB = b.matches_played;
        } else if (sortField === 'frag') {
            valA = a.wins || 0;
            valB = b.wins || 0;
        } else if (sortField === 'time') {
            valA = a.estimated_time_minutes || 0;
            valB = b.estimated_time_minutes || 0;
        } else { // 'pts' default
            valA = a.points;
            valB = b.points;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    sorted.forEach((player) => {
        const el = document.createElement('tr');
        
        let timeText = '0 min';
        const mins = Math.round(player.estimated_time_minutes || 0);
        if (mins > 0) {
            if (mins >= 60) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                timeText = `${h}h ${m > 0 ? m + 'm' : ''}`;
            } else {
                timeText = `${mins} min`;
            }
        }
        
        const wins = player.wins || 0;
        const draws = player.draws || 0;
        const losses = player.losses || 0;

        el.innerHTML = `
            <td>#${player.rank}</td>
            <td><strong>${player.name}</strong></td>
            <td>${player.matches_played}</td>
            <td>
                <span class="frag-badge">
                    <span class="frag-item win" title="Vitórias">${wins}V</span>
                    <span class="frag-item draw" title="Empates">${draws}E</span>
                    <span class="frag-item loss" title="Derrotas">${losses}D</span>
                </span>
            </td>
            <td><span class="pts-badge">${player.points} pts</span></td>
            <td><span class="time-badge">⏱️ ${timeText}</span></td>
        `;
        playersList.appendChild(el);
    });
}

// Tab 2: Presence List Table
function renderPresenceTable(players) {
    presenceList.innerHTML = '';
    const presencePlayers = players.filter(p => p.is_confirmed || p.has_arrived);

    if (presencePlayers.length === 0) {
        presenceList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhuma presença confirmada.</td></tr>`;
        return;
    }

    presencePlayers.forEach((player, index) => {
        const el = document.createElement('tr');
        let statusBadge = '';

        if (player.has_arrived) {
            statusBadge = `<span class="status-badge arrived">🏟️ Na Quadra</span>`;
        } else if (player.is_confirmed) {
            statusBadge = `<span class="status-badge confirmed">🟢 Confirmado</span>`;
        } else {
            statusBadge = `<span class="status-badge pending">⏳ Ausente</span>`;
        }

        let payBadge = player.is_paying
            ? `<span class="status-badge paid">💳 Pago</span>`
            : `<span class="status-badge pending">❌ Pendente</span>`;

        el.innerHTML = `
            <td>#${index + 1}</td>
            <td><strong>${player.name}</strong></td>
            <td>${statusBadge}</td>
            <td>${payBadge}</td>
        `;
        presenceList.appendChild(el);
    });
}

// Tab 3: Payment List Table
function renderPaymentTable(players) {
    paymentList.innerHTML = '';
    const relevantPlayers = players.filter(p => p.is_confirmed || p.has_arrived || p.is_paying);

    if (relevantPlayers.length === 0) {
        paymentList.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum jogador na lista.</td></tr>`;
        return;
    }

    relevantPlayers.forEach((player, index) => {
        const el = document.createElement('tr');
        let payBadge = player.is_paying
            ? `<span class="status-badge paid">💳 Pago</span>`
            : `<span class="status-badge pending">❌ Pendente</span>`;

        el.innerHTML = `
            <td>#${index + 1}</td>
            <td><strong>${player.name}</strong></td>
            <td>${payBadge}</td>
        `;
        paymentList.appendChild(el);
    });
}
