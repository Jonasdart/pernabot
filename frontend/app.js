const API_BASE = window.location.origin;

// DOM Elements
const views = {
    sessions: document.getElementById('sessions-view'),
    players: document.getElementById('players-view'),
    match: document.getElementById('match-view')
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

// Quadra ao Vivo Elements
const matchBackBtn = document.getElementById('match-back-btn');
const matchRefreshBtn = document.getElementById('match-refresh-btn');
const adminBadge = document.getElementById('admin-badge');
const matchStopwatch = document.getElementById('match-stopwatch');
const matchSessionLabel = document.getElementById('match-session-label');
const adminControlsPanel = document.getElementById('admin-controls-panel');
const btnWinT1 = document.getElementById('btn-win-t1');
const btnDraw = document.getElementById('btn-draw');
const btnWinT2 = document.getElementById('btn-win-t2');
const team1Title = document.getElementById('team1-title');
const team2Title = document.getElementById('team2-title');
const team1PlayersEl = document.getElementById('team1-players');
const team2PlayersEl = document.getElementById('team2-players');
const nextTeamListEl = document.getElementById('next-team-list');
const matchQueueListEl = document.getElementById('match-queue-list');
const nextTeamCountBadge = document.getElementById('next-team-count-badge');

// State
let currentSessions = [];
let currentPlayers = [];
let activeSessionId = null;
let activeSessionDate = null;

// Quadra ao Vivo State
let currentPublicHash = null;
let currentAdminToken = null;
let pollInterval = null;
let stopwatchInterval = null;
let matchLastEventTime = null;
let matchIsPlaying = false;

// Sort State
let sortField = 'pts';
let sortDirection = 'desc';

// Initialize
function openModal(el) {
    if (!el) return;
    el.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeModal(el) {
    if (!el) return;
    el.classList.add('hidden');
    // Only remove modal-open if no other modal is visible
    const anyOpen = document.querySelectorAll('.modal-overlay:not(.hidden)');
    if (anyOpen.length === 0) document.body.classList.remove('modal-open');
}

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSorting();
    setupMatchViewListeners();

    backBtn.addEventListener('click', () => {
        window.location.hash = '';
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

    // Handle hash route changes
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
});

// Routing Handler
function handleRoute() {
    stopPolling();
    const hash = window.location.hash;

    const matchRouteRegex = /^#\/match\/([a-f0-9\-]+)/i;
    const match = hash.match(matchRouteRegex);

    if (match) {
        const publicHash = match[1];
        // Parse admin token from hash query string, e.g. #/match/<hash>?admin=<token>
        let adminToken = null;
        if (hash.includes('?')) {
            const queryPart = hash.split('?')[1];
            const urlParams = new URLSearchParams(queryPart);
            adminToken = urlParams.get('admin');
        }

        loadMatchView(publicHash, adminToken);
    } else {
        loadSessions();
        showView('sessions');
    }
}

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
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
}

function getAdminKey() {
    return localStorage.getItem('pelada_admin_key') || '';
}

// Fetch and render sessions
async function loadSessions() {
    const adminKey = getAdminKey();
    try {
        const url = adminKey ? `${API_BASE}/sessions?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions`;
        const response = await fetch(url);

        if (response.status === 401) {
            renderAuthForm(adminKey ? 'Credencial inválida ou expirada.' : '');
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch sessions');

        currentSessions = await response.json();
        renderSessions();
    } catch (error) {
        sessionsList.innerHTML = `<p style="color: #ef4444; text-align: center;">Erro ao carregar as peladas. Tente novamente mais tarde.</p>`;
        console.error(error);
    }
}

function renderAuthForm(errorMsg = '') {
    if (!sessionsList) return;
    sessionsList.innerHTML = `
        <div style="text-align: center; max-width: 360px; margin: 2rem auto; padding: 2rem; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">🔒</div>
            <h3 style="margin-bottom: 0.5rem; color: #ffffff; font-size: 1.25rem;">Acesso Restrito</h3>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 1.5rem; line-height: 1.4;">Digite a credencial de administrador para acessar o painel de peladas.</p>
            <form id="auth-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
                <input type="password" id="admin-key-input" placeholder="Credencial / Senha" required style="padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.4); color: #ffffff; text-align: center; font-size: 1rem; width: 100%; outline: none;">
                <button type="submit" class="btn primary" style="width: 100%; padding: 0.85rem; font-weight: bold; font-size: 0.95rem; cursor: pointer;">🔓 Entrar no Painel</button>
            </form>
            ${errorMsg ? `<p style="color: #ef4444; margin-top: 1rem; font-size: 0.85rem; font-weight: 500;">${errorMsg}</p>` : ''}
        </div>
    `;

    const form = document.getElementById('auth-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = document.getElementById('admin-key-input').value.trim();
            if (val) {
                localStorage.setItem('pelada_admin_key', val);
                await loadSessions();
            }
        });
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
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <span class="badge ${statusClass}">${statusText}</span>
                ${session.public_hash ? `<button class="btn secondary sm live-btn" title="Ver Quadra ao Vivo">⚽ Quadra ao Vivo</button>` : ''}
                ${session.public_hash && session.admin_token ? `<button class="btn primary sm admin-btn" title="Abrir Gerenciador da Pelada">⚡ Gerenciar</button>` : ''}
            </div>
        `;

        const liveBtn = el.querySelector('.live-btn');
        if (liveBtn) {
            liveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.hash = `#/match/${session.public_hash}`;
            });
        }

        const adminBtn = el.querySelector('.admin-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.hash = `#/match/${session.public_hash}?admin=${session.admin_token}`;
            });
        }

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
        const adminKey = getAdminKey();
        const url = adminKey ? `${API_BASE}/sessions/${sessionId}/players?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${sessionId}/players`;
        const response = await fetch(url);
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

    activePlayers.forEach(p => {
        const wins = p.wins || 0;
        const draws = p.draws || 0;
        p.points = p.points !== undefined ? p.points : (wins * 3 + draws * 1);
    });

    const defaultRanked = [...activePlayers].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        return b.matches_played - a.matches_played;
    });

    defaultRanked.forEach((p, idx) => {
        p.rank = idx + 1;
    });

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
        } else {
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
            <td data-label="">#${player.rank}</td>
            <td data-label="Nome"><strong>${player.name}</strong></td>
            <td data-label="Partidas">${player.matches_played}</td>
            <td data-label="Frag">
                <span class="frag-badge">
                    <span class="frag-item win" title="Vitórias">${wins}V</span>
                    <span class="frag-item draw" title="Empates">${draws}E</span>
                    <span class="frag-item loss" title="Derrotas">${losses}D</span>
                </span>
            </td>
            <td data-label="PTS"><span class="pts-badge">${player.points} pts</span></td>
            <td data-label="Tempo"><span class="time-badge">⏱️ ${timeText}</span></td>
        `;
        playersList.appendChild(el);
    });
}

// Tab 2: Presence List Table
function renderPresenceTable(players) {
    presenceList.innerHTML = '';
    const presencePlayers = players.filter(p => p.is_confirmed || p.has_arrived);

    if (presencePlayers.length === 0) {
        presenceList.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhuma presença confirmada.</td></tr>`;
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
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome"><strong>${player.name}</strong></td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Pagamento">${payBadge}</td>
            <td class="action-cell"></td>
        `;

        const actionTd = el.querySelector('.action-cell');
        if (player.has_arrived) {
            const checkoutBtn = document.createElement('button');
            checkoutBtn.className = 'btn-action-sm checkout';
            checkoutBtn.textContent = '👋 Saiu';
            checkoutBtn.onclick = () => handleCheckoutPlayer(player);
            actionTd.appendChild(checkoutBtn);
        } else {
            const checkinBtn = document.createElement('button');
            checkinBtn.className = 'btn-action-sm checkin';
            checkinBtn.textContent = '📍 Chegou';
            checkinBtn.onclick = () => handleCheckinPlayer(player);
            actionTd.appendChild(checkinBtn);
        }

        presenceList.appendChild(el);
    });
}

// Tab 3: Payment List Table
function renderPaymentTable(players) {
    paymentList.innerHTML = '';
    const relevantPlayers = players.filter(p => p.is_confirmed || p.has_arrived || p.is_paying);

    const totalCount = relevantPlayers.length;
    const payingCount = relevantPlayers.filter(p => p.is_paying).length;
    const percent = totalCount > 0 ? Math.round((payingCount / totalCount) * 100) : 0;

    const countTextEl = document.getElementById('payment-count-text');
    const percentTextEl = document.getElementById('payment-percent-text');
    const progressFillEl = document.getElementById('payment-progress-fill');

    if (countTextEl) countTextEl.textContent = `${payingCount} de ${totalCount} pagos`;
    if (percentTextEl) percentTextEl.textContent = `${percent}% Pago`;
    if (progressFillEl) progressFillEl.style.width = `${percent}%`;

    if (relevantPlayers.length === 0) {
        paymentList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum jogador na lista.</td></tr>`;
        return;
    }

    relevantPlayers.forEach((player, index) => {
        const el = document.createElement('tr');
        let payBadge = player.is_paying
            ? `<span class="status-badge paid">💳 Pago</span>`
            : `<span class="status-badge pending">❌ Pendente</span>`;

        el.innerHTML = `
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome"><strong>${player.name}</strong></td>
            <td data-label="Pagamento">${payBadge}</td>
            <td class="action-cell"></td>
        `;

        const actionTd = el.querySelector('.action-cell');
        const togglePayBtn = document.createElement('button');
        if (player.is_paying) {
            togglePayBtn.className = 'btn-action-sm unpay';
            togglePayBtn.textContent = '↩️ Desfazer Pago';
            togglePayBtn.onclick = () => handleSetPayment(player.id, false);
        } else {
            togglePayBtn.className = 'btn-action-sm pay';
            togglePayBtn.textContent = '💳 Marcar Pago';
            togglePayBtn.onclick = () => handleSetPayment(player.id, true);
        }
        actionTd.appendChild(togglePayBtn);

        paymentList.appendChild(el);
    });
}

// ==========================================
// Handlers for Check-in, Checkout & Payments
// ==========================================

function promptPaymentCheckin(player, onSuccess) {
    const modalPlayerName = document.getElementById('modal-player-name');
    const modalPlayerName2 = document.getElementById('modal-player-name-2');
    if (modalPlayerName) modalPlayerName.textContent = player.name;
    if (modalPlayerName2) modalPlayerName2.textContent = player.name;

    const confirmModal = document.getElementById('confirm-pay-checkin-modal');
    if (!confirmModal) return;

    confirmModal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    const confirmBtn = document.getElementById('btn-confirm-pay-and-checkin');
    const cancelBtn = document.getElementById('btn-cancel-pay-checkin');
    const closeBtn = document.getElementById('close-confirm-modal-btn');

    const cleanup = () => {
        confirmModal.classList.add('hidden');
        const anyOpen = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (anyOpen.length === 0) document.body.classList.remove('modal-open');
        if (confirmBtn) confirmBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        if (closeBtn) closeBtn.onclick = null;
    };

    if (cancelBtn) cancelBtn.onclick = cleanup;
    if (closeBtn) closeBtn.onclick = cleanup;

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            cleanup();
            await handleSetPayment(player.id, true);
            await handleCheckinPlayer(player, true);
            if (onSuccess) onSuccess();
        };
    }
}

async function handleCheckinPlayer(player, forcePay = false) {
    if (!player.is_paying && !forcePay) {
        promptPaymentCheckin(player, () => {
            if (activeSessionId) loadSessionDetails(activeSessionId, activeSessionDate);
            if (currentPublicHash) fetchMatchData(currentPublicHash, currentAdminToken);
        });
        return;
    }

    try {
        if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/checkin`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: player.id })
            });
            if (res.ok) {
                const data = await res.json();
                renderMatchData(data);
                return;
            }
        }

        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${player.id}/checkin?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${player.id}/checkin`;
            const res = await fetch(url, { method: 'POST' });
            if (res.ok) {
                loadSessionDetails(activeSessionId, activeSessionDate);
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao realizar check-in'}`);
            }
        }
    } catch (e) {
        console.error('Erro no check-in:', e);
    }
}

async function handleCheckoutPlayer(player) {
    try {
        if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/checkout`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: player.id })
            });
            if (res.ok) {
                const data = await res.json();
                renderMatchData(data);
                return;
            }
        }

        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${player.id}/checkout?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${player.id}/checkout`;
            const res = await fetch(url, { method: 'POST' });
            if (res.ok) {
                loadSessionDetails(activeSessionId, activeSessionDate);
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao realizar checkout'}`);
            }
        }
    } catch (e) {
        console.error('Erro no checkout:', e);
    }
}

async function handleSetPayment(playerId, isPaying) {
    try {
        if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/pagamento`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, is_paying: isPaying })
            });
            if (res.ok) {
                const data = await res.json();
                renderMatchData(data);
                return;
            }
        }

        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/pagamento?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/pagamento`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, is_paying: isPaying })
            });
            if (res.ok) {
                loadSessionDetails(activeSessionId, activeSessionDate);
            }
        }
    } catch (e) {
        console.error('Erro ao atualizar pagamento:', e);
    }
}

// ==========================================
// Quadra ao Vivo & Manager Feature
// ==========================================

function setupMatchViewListeners() {
    if (matchBackBtn) {
        matchBackBtn.addEventListener('click', () => {
            window.location.hash = '';
            showView('sessions');
        });
    }

    matchRefreshBtn.addEventListener('click', async () => {
        if (!currentPublicHash) return;
        matchRefreshBtn.innerHTML = `🔄 <span class="spin-icon">⌛</span>`;
        await fetchMatchData(currentPublicHash, currentAdminToken);
        matchRefreshBtn.innerHTML = `🔄 Sincronizado`;
    });

    btnWinT1.addEventListener('click', () => handleRotateMatch(1));
    btnDraw.addEventListener('click', () => handleRotateMatch(0));
    btnWinT2.addEventListener('click', () => handleRotateMatch(2));

    // Add Player Modal & Button Listener
    const addPlayerBtn = document.getElementById('add-player-btn');
    const addPlayerModal = document.getElementById('add-player-modal');
    const closeAddPlayerModalBtn = document.getElementById('close-add-player-modal-btn');
    const addPlayerForm = document.getElementById('add-player-form');

    if (addPlayerBtn && addPlayerModal) {
        addPlayerBtn.addEventListener('click', () => {
            openModal(addPlayerModal);
            const nameInput = document.getElementById('player-name-input');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }
        });
    }

    if (closeAddPlayerModalBtn && addPlayerModal) {
        closeAddPlayerModalBtn.addEventListener('click', () => {
            closeModal(addPlayerModal);
        });
    }

    if (addPlayerModal) {
        addPlayerModal.addEventListener('click', (e) => {
            if (e.target === addPlayerModal) {
                closeModal(addPlayerModal);
            }
        });
    }

    if (addPlayerForm) {
        addPlayerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('player-name-input');
            const isPayingInput = document.getElementById('add-is-paying');
            const doCheckinInput = document.getElementById('add-do-checkin');

            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) return;

            const is_paying = isPayingInput ? isPayingInput.checked : false;
            const do_checkin = doCheckinInput ? doCheckinInput.checked : false;

            if (!activeSessionId) {
                alert('Nenhuma sessão selecionada');
                return;
            }

            try {
                const adminKey = getAdminKey();
                const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        is_paying: is_paying,
                        is_confirmed: true,
                        do_checkin: do_checkin
                    })
                });

                if (res.ok) {
                    closeModal(addPlayerModal);
                    loadSessionDetails(activeSessionId, activeSessionDate);
                } else {
                    const err = await res.json();
                    alert(`Erro: ${err.detail || 'Falha ao adicionar jogador'}`);
                }
            } catch (err) {
                console.error('Erro ao adicionar jogador:', err);
            }
        });
    }

    const quickAddArrivalForm = document.getElementById('quick-add-arrival-form');
    if (quickAddArrivalForm) {
        quickAddArrivalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('quick-player-name-input');
            const isPayingInput = document.getElementById('quick-is-paying');

            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) return;

            const is_paying = isPayingInput ? isPayingInput.checked : true;

            try {
                if (currentPublicHash) {
                    let url = `${API_BASE}/sessions/hash/${currentPublicHash}/adicionar`;
                    if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            is_paying: is_paying,
                            is_confirmed: true,
                            do_checkin: true
                        })
                    });

                    if (res.ok) {
                        if (nameInput) nameInput.value = '';
                        const data = await res.json();
                        renderMatchData(data);
                        return;
                    }
                }

                if (activeSessionId) {
                    const adminKey = getAdminKey();
                    const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            is_paying: is_paying,
                            is_confirmed: true,
                            do_checkin: true
                        })
                    });

                    if (res.ok) {
                        if (nameInput) nameInput.value = '';
                        loadSessionDetails(activeSessionId, activeSessionDate);
                    } else {
                        const err = await res.json();
                        alert(`Erro: ${err.detail || 'Falha ao registrar chegada'}`);
                    }
                }
            } catch (err) {
                console.error('Erro ao registrar chegada do jogador:', err);
            }
        });
    }

    // Queue FAB & Modal handlers
    const fabQueueBtn = document.getElementById('fab-queue-btn');
    const queueModal = document.getElementById('queue-modal');
    const closeQueueModalBtn = document.getElementById('close-queue-modal-btn');

    if (fabQueueBtn && queueModal) {
        fabQueueBtn.addEventListener('click', () => {
            openModal(queueModal);
        });
    }

    if (closeQueueModalBtn && queueModal) {
        closeQueueModalBtn.addEventListener('click', () => {
            closeModal(queueModal);
        });
    }

    if (queueModal) {
        queueModal.addEventListener('click', (e) => {
            if (e.target === queueModal) {
                closeModal(queueModal);
            }
        });
    }
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    }
}

async function loadMatchView(publicHash, adminToken) {
    currentPublicHash = publicHash;
    currentAdminToken = adminToken;
    showView('match');

    await fetchMatchData(publicHash, adminToken);

    // Start auto polling every 3 seconds
    pollInterval = setInterval(() => {
        fetchMatchData(publicHash, adminToken);
    }, 3000);
}

async function fetchMatchData(publicHash, adminToken) {
    try {
        let url = `${API_BASE}/sessions/hash/${publicHash}`;
        if (adminToken) {
            url += `?token=${encodeURIComponent(adminToken)}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Pelada não encontrada');

        const matchData = await response.json();
        renderMatchData(matchData);
    } catch (error) {
        console.error('Erro ao buscar dados da partida:', error);
    }
}

function renderMatchData(data) {
    // Session Label
    matchSessionLabel.textContent = `Pelada #${data.session_id} • ${data.is_active ? 'Em Andamento' : 'Finalizada'}`;

    // Admin Panel & Badge
    if (data.is_admin) {
        adminBadge.classList.remove('hidden');
        adminControlsPanel.classList.remove('hidden');
    } else {
        adminBadge.classList.add('hidden');
        adminControlsPanel.classList.add('hidden');
    }

    // Stopwatch logic
    matchIsPlaying = data.is_playing;
    if (data.last_event_time) {
        matchLastEventTime = new Date(data.last_event_time).getTime();
    } else {
        matchLastEventTime = Date.now();
    }
    startStopwatch();

    // Teams Setup
    const t1 = data.teams.team_1;
    const t2 = data.teams.team_2;

    team1Title.textContent = t1.label;
    team2Title.textContent = t2.label;

    // Update Action button labels with captain names
    btnWinT1.textContent = `🏆 ${t1.label} Venceu`;
    btnWinT2.textContent = `🏆 ${t2.label} Venceu`;

    // Render Court Players
    renderTeamPlayers(team1PlayersEl, t1.players, data.is_admin);
    renderTeamPlayers(team2PlayersEl, t2.players, data.is_admin);

    // Render Next Team
    renderNextTeam(data.next_team);

    // Render Pending Check-in list (All confirmed players who haven't checked in yet)
    renderPendingCheckinList(data.all_players, data.is_admin);

    // Render Waiting Queue
    renderMatchQueue(data.queue, data.is_admin);

    // Update FAB queue count
    const fabQueueCount = document.getElementById('fab-queue-count');
    if (fabQueueCount) {
        fabQueueCount.textContent = data.queue ? data.queue.length : 0;
    }
}

function startStopwatch() {
    if (stopwatchInterval) clearInterval(stopwatchInterval);

    function updateTimer() {
        if (!matchIsPlaying || !matchLastEventTime) {
            matchStopwatch.textContent = "00:00";
            return;
        }
        const now = Date.now();
        const diffMs = Math.max(0, now - matchLastEventTime);
        const totalSeconds = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        const formatMins = String(mins).padStart(2, '0');
        const formatSecs = String(secs).padStart(2, '0');
        matchStopwatch.textContent = `${formatMins}:${formatSecs}`;
    }

    updateTimer();
    stopwatchInterval = setInterval(updateTimer, 1000);
}

function renderTeamPlayers(container, players, isAdmin) {
    container.innerHTML = '';
    if (!players || players.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1rem;">Nenhum jogador</div>`;
        return;
    }

    players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'player-card';

        const info = document.createElement('div');
        info.className = 'player-card-info';
        info.innerHTML = `
            <span class="player-card-name">${p.name} ${p.is_paying ? '💳' : ''}</span>
            <span class="player-card-stats">${p.matches_played} partida(s) • ${p.points} pts</span>
        `;

        card.appendChild(info);

        if (isAdmin) {
            const actions = document.createElement('div');
            actions.className = 'player-card-actions';

            const btnDescer = document.createElement('button');
            btnDescer.className = 'btn-action-sm descer';
            btnDescer.title = 'Descer para a reserva';
            btnDescer.textContent = '🪑 Descer';
            btnDescer.addEventListener('click', () => handlePlayerAction('descer', p.id));

            const btnSair = document.createElement('button');
            btnSair.className = 'btn-action-sm sair';
            btnSair.title = 'Sair da pelada';
            btnSair.textContent = '👋 Sair';
            btnSair.addEventListener('click', () => handlePlayerAction('sair', p.id));

            actions.appendChild(btnDescer);
            actions.appendChild(btnSair);
            card.appendChild(actions);
        }

        container.appendChild(card);
    });
}

function renderNextTeam(nextPlayers) {
    nextTeamListEl.innerHTML = '';
    if (!nextPlayers || nextPlayers.length === 0) {
        nextTeamListEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 1rem;">Nenhum jogador aguardando na fila.</div>`;
        nextTeamCountBadge.textContent = '0 Jogadores';
        return;
    }

    nextTeamCountBadge.textContent = `${nextPlayers.length} Jogador(es)`;

    nextPlayers.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'next-player-card';
        card.innerHTML = `
            <span class="num-badge">PRÓXIMO #${index + 1}</span>
            <h4>${p.name} ${p.is_paying ? '💳' : ''}</h4>
            <p>${p.cycles_waiting} rodada(s) esperando</p>
            <div class="next-player-action" style="margin-top: 0.5rem;"></div>
        `;

        const checkoutBtn = document.createElement('button');
        checkoutBtn.className = 'btn-action-sm checkout';
        checkoutBtn.textContent = '👋 Saiu';
        checkoutBtn.onclick = () => handleCheckoutPlayer(p);
        card.querySelector('.next-player-action').appendChild(checkoutBtn);

        nextTeamListEl.appendChild(card);
    });
}

function renderPendingCheckinList(allPlayers, isAdmin) {
    const pendingContainer = document.getElementById('pending-checkin-list');
    const pendingBadge = document.getElementById('pending-checkin-count');
    if (!pendingContainer) return;

    pendingContainer.innerHTML = '';
    const pendingList = (allPlayers || []).filter(p => (p.is_confirmed || !p.has_arrived) && !p.has_arrived);

    if (pendingBadge) pendingBadge.textContent = pendingList.length;

    if (pendingList.length === 0) {
        pendingContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 0.8rem;">Todos os confirmados já fizeram check-in! ⚽</div>`;
        return;
    }

    pendingList.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pending-checkin-card';
        const payStatus = p.is_paying ? `<span class="badge paid sm" style="font-size:0.75rem;">💳 Pago</span>` : `<span class="badge pending sm" style="font-size:0.75rem;">❌ Pendente</span>`;
        card.innerHTML = `
            <div class="player-info-sub">
                <span class="player-name">${p.name}</span>
                <div>${payStatus}</div>
            </div>
            <div class="card-action"></div>
        `;

        const checkinBtn = document.createElement('button');
        checkinBtn.className = 'btn-action-sm checkin';
        checkinBtn.textContent = '📍 Chegou';
        checkinBtn.onclick = () => handleCheckinPlayer(p);
        card.querySelector('.card-action').appendChild(checkinBtn);

        pendingContainer.appendChild(card);
    });
}

function renderMatchQueue(queuePlayers, isAdmin) {
    matchQueueListEl.innerHTML = '';
    if (!queuePlayers || queuePlayers.length === 0) {
        matchQueueListEl.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Fila de espera vazia.</td></tr>`;
        return;
    }

    queuePlayers.forEach((p, index) => {
        const tr = document.createElement('tr');
        const payBadge = p.is_paying ? `<span class="status-badge paid" style="font-size:0.75rem;">💳 Pago</span>` : `<span class="status-badge pending" style="font-size:0.75rem;">❌ Pendente</span>`;

        tr.innerHTML = `
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome"><strong>${p.name}</strong></td>
            <td data-label="Rodadas">${p.cycles_waiting} rodada(s)</td>
            <td data-label="Pagamento">${payBadge}</td>
            <td class="action-cell"></td>
        `;

        const actionTd = tr.querySelector('.action-cell');
        const checkoutBtn = document.createElement('button');
        checkoutBtn.className = 'btn-action-sm checkout';
        checkoutBtn.textContent = '👋 Saiu';
        checkoutBtn.onclick = () => handleCheckoutPlayer(p);
        actionTd.appendChild(checkoutBtn);

        matchQueueListEl.appendChild(tr);
    });
}

async function handleRotateMatch(winner) {
    if (!currentPublicHash || !currentAdminToken) return;

    try {
        const response = await fetch(`${API_BASE}/sessions/hash/${currentPublicHash}/vencer?token=${encodeURIComponent(currentAdminToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ winner: winner })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(`Erro: ${err.detail || 'Falha ao registrar resultado'}`);
            return;
        }

        const data = await response.json();
        renderMatchData(data);
    } catch (error) {
        console.error('Erro na rotação:', error);
        alert('Erro de conexão ao registrar resultado.');
    }
}

async function handlePlayerAction(action, playerId) {
    if (!currentPublicHash || !currentAdminToken) return;

    const actionText = action === 'descer' ? 'descer este jogador para a reserva' : 'remover este jogador da pelada';
    if (!confirm(`Tem certeza que deseja ${actionText}?`)) return;

    try {
        const response = await fetch(`${API_BASE}/sessions/hash/${currentPublicHash}/${action}?token=${encodeURIComponent(currentAdminToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(`Erro: ${err.detail || 'Falha ao executar ação'}`);
            return;
        }

        const data = await response.json();
        renderMatchData(data);
    } catch (error) {
        console.error(`Erro ao ${action}:`, error);
        alert('Erro de conexão ao executar ação.');
    }
}


