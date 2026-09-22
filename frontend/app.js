const API_BASE = window.location.origin;

// DOM Elements
const views = {
    sessions: document.getElementById('sessions-view'),
    players: document.getElementById('players-view'),
    match: document.getElementById('match-view'),
    checkin: document.getElementById('checkin-view')
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

// Search & Chip Filter Elements
const playerSearchInput = document.getElementById('player-search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const copyPaidListBtn = document.getElementById('copy-paid-list-btn');
const copyPresenceListBtn = document.getElementById('copy-presence-list-btn');
const btnQrCheckin = document.getElementById('btn-qr-checkin');

// QR Code Modal Elements
const qrCodeModal = document.getElementById('qr-code-modal');
const closeQrModalBtn = document.getElementById('close-qr-modal-btn');
const btnCopyQrUrl = document.getElementById('btn-copy-qr-url');
const btnPrintQr = document.getElementById('btn-print-qr');
const qrCodeUrlText = document.getElementById('qr-code-url-text');
const qrCanvas = document.getElementById('qr-canvas');

// Check-in View Elements
const checkinPeladaTitle = document.getElementById('checkin-pelada-title');
const checkinPeladaSubtitle = document.getElementById('checkin-pelada-subtitle');
const checkinSessionStatusBadge = document.getElementById('checkin-session-status-badge');
const checkinFormContainer = document.getElementById('checkin-form-container');
const checkinNameInput = document.getElementById('checkin-name-input');
const checkinSuggestions = document.getElementById('checkin-suggestions');
const checkinQuickNames = document.getElementById('checkin-quick-names');
const btnSubmitCheckin = document.getElementById('btn-submit-checkin');
const checkinSuccessContainer = document.getElementById('checkin-success-container');
const checkinSuccessPlayerName = document.getElementById('checkin-success-player-name');
const checkinSuccessMsg = document.getElementById('checkin-success-msg');
const checkinOrderBadge = document.getElementById('checkin-order-badge');
const checkinQueueBadge = document.getElementById('checkin-queue-badge');
const checkinPayBadge = document.getElementById('checkin-pay-badge');
const btnGotoMatch = document.getElementById('btn-goto-match');
const btnCheckinAnother = document.getElementById('btn-checkin-another');

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
const team1GkEl = document.getElementById('team1-gk');
const team2GkEl = document.getElementById('team2-gk');
const nextTeamListEl = document.getElementById('next-team-list');
const matchQueueListEl = document.getElementById('match-queue-list');
const nextTeamCountBadge = document.getElementById('next-team-count-badge');

// Result Notification Banner Elements
const matchResultNotification = document.getElementById('match-result-notification');
const resultBannerIcon = document.getElementById('result-banner-icon');
const resultBannerTitle = document.getElementById('result-banner-title');
const resultBannerSubtitle = document.getElementById('result-banner-subtitle');
const resultBannerEnteringSection = document.getElementById('result-banner-entering-section');
const resultBannerEnteringTags = document.getElementById('result-banner-entering-tags');
const closeResultBannerBtn = document.getElementById('close-result-banner-btn');

// Batch Action Elements & Selection State
const batchActionBar = document.getElementById('batch-action-bar');
const batchSelectedCount = document.getElementById('batch-selected-count');
const batchBtnPay = document.getElementById('batch-btn-pay');
const batchBtnUnpay = document.getElementById('batch-btn-unpay');
const batchBtnSpecial = document.getElementById('batch-btn-special');
const batchBtnUnspecial = document.getElementById('batch-btn-unspecial');
const batchBtnGoalkeeper = document.getElementById('batch-btn-goalkeeper');
const batchBtnUnGoalkeeper = document.getElementById('batch-btn-ungoalkeeper');
const batchBtnCheckin = document.getElementById('batch-btn-checkin');
const batchBtnCheckout = document.getElementById('batch-btn-checkout');
const batchBtnRemove = document.getElementById('batch-btn-remove');
const batchBtnClear = document.getElementById('batch-btn-clear');
const batchChipUnpaid = document.getElementById('batch-chip-unpaid');
const batchChipUnarrived = document.getElementById('batch-chip-unarrived');
const selectAllStats = document.getElementById('select-all-stats');
const selectAllPresence = document.getElementById('select-all-presence');
const selectAllPayment = document.getElementById('select-all-payment');

const selectedPlayerIds = new Set();

// Balance Configuration State
let currentBalanceConfig = {
    enabled: true,
    key: 'jovem',
    label: 'Jovens',
    emoji: '🧒',
    max_per_team: 1
};

function updateBalanceConfig(config) {
    if (config && typeof config === 'object') {
        currentBalanceConfig = { ...currentBalanceConfig, ...config };
        const singular = currentBalanceConfig.label.endsWith('s') ? currentBalanceConfig.label.slice(0, -1) : currentBalanceConfig.label;
        const specialLabelText = document.getElementById('add-is-special-text');
        if (specialLabelText) {
            specialLabelText.textContent = `${currentBalanceConfig.emoji} Marcar como ${singular}`;
        }
        const quickSpecialLabel = document.getElementById('quick-is-special-label');
        if (quickSpecialLabel) {
            quickSpecialLabel.textContent = `${currentBalanceConfig.emoji} ${singular}`;
        }
        const batchBtnSpecialEl = document.getElementById('batch-btn-special');
        if (batchBtnSpecialEl) {
            batchBtnSpecialEl.textContent = `${currentBalanceConfig.emoji} Marcar ${singular}`;
        }
    }
}

// State
let currentSessions = [];
let currentPlayers = [];
let activeSessionId = null;
let activeSessionDate = null;
let activeSessionCheckinCode = null;
let searchQuery = '';
let paymentFilter = 'all';

// Check-in State
let checkinCurrentCode = null;
let checkinSessionData = null;
let checkinSelectedPlayer = null;

// Quadra ao Vivo State
let currentPublicHash = null;
let currentAdminToken = null;
let pollInterval = null;
let stopwatchInterval = null;
let matchLastEventTime = null;
let matchIsPlaying = false;
let bannerDismissTimeout = null;
let lastSeenRotationEventTime = null;
let currentEnteringPlayerIds = new Set();
let currentMatchData = null;
let highlightDismissTimeout = null;

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

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSorting();
    setupMatchViewListeners();
    setupSearchAndFilters();
    setupCheckinListeners();
    setupImportWhatsappListeners();

    backBtn.addEventListener('click', () => {
        window.location.hash = '';
        showView('sessions');
    });

    const drawTeamsBtn = document.getElementById('draw-teams-btn');
    if (drawTeamsBtn) {
        drawTeamsBtn.addEventListener('click', handleDrawTeams);
    }

    const resetPeladaBtn = document.getElementById('reset-pelada-btn');
    if (resetPeladaBtn) {
        resetPeladaBtn.addEventListener('click', () => handleRestartPelada(false));
    }

    if (btnQrCheckin) {
        btnQrCheckin.addEventListener('click', handleOpenQrModal);
    }

    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => closeModal(qrCodeModal));
    }

    if (btnCopyQrUrl) {
        btnCopyQrUrl.addEventListener('click', () => {
            const url = qrCodeUrlText ? qrCodeUrlText.textContent : '';
            if (url) {
                navigator.clipboard.writeText(url);
                showToast('📋 Link de check-in copiado!');
            }
        });
    }

    if (btnPrintQr) {
        btnPrintQr.addEventListener('click', () => {
            window.print();
        });
    }

    if (copyPaidListBtn) {
        copyPaidListBtn.addEventListener('click', handleCopyPaidList);
    }

    if (copyPresenceListBtn) {
        copyPresenceListBtn.addEventListener('click', handleCopyPresenceList);
    }

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

    const checkinRouteRegex = /^#\/checkin\/([a-zA-Z0-9_\-]+)/i;
    const checkinMatch = hash.match(checkinRouteRegex);

    if (checkinMatch) {
        const checkinCode = checkinMatch[1];
        loadCheckinView(checkinCode);
        return;
    }

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

    // Find checkin code from currentSessions if available
    const sess = currentSessions.find(s => s.id === sessionId);
    if (sess) {
        activeSessionCheckinCode = sess.checkin_code || sess.public_hash;
    }

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

    // Apply search filter if present
    let filteredPlayers = players;
    if (searchQuery) {
        filteredPlayers = players.filter(p => (p.name || '').toLowerCase().includes(searchQuery));
    }

    renderStatsTable(filteredPlayers);
    renderPresenceTable(filteredPlayers);
    renderPaymentTable(players); // Note: renderPaymentTable does its own searchQuery & chip filter internally
}

// Tab 1: Game Stats Table
function renderStatsTable(players) {
    playersList.innerHTML = '';
    const activePlayers = players.filter(p => p.has_arrived || p.matches_played > 0);

    if (activePlayers.length === 0) {
        playersList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${searchQuery ? 'Nenhum jogador encontrado para a busca.' : 'Nenhum jogador em quadra ainda.'}</td></tr>`;
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
        const isSelected = selectedPlayerIds.has(player.id);
        if (isSelected) el.classList.add('selected-row');

        const catPill = player.is_special_category
            ? `<span class="player-category-pill" title="Categoria: ${currentBalanceConfig.label}">${currentBalanceConfig.emoji}</span>`
            : '';

        el.innerHTML = `
            <td class="checkbox-cell" data-label="Selecionar"><input type="checkbox" class="row-checkbox" data-player-id="${player.id}" ${isSelected ? 'checked' : ''}></td>
            <td data-label="">#${player.rank}</td>
            <td data-label="Nome" class="player-name-cell">
                <span class="player-name-text" title="Clique para renomear"><strong>${player.name}</strong>${catPill}</span>
                <button class="btn-icon-rename" title="Renomear jogador">✏️</button>
            </td>
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

        const renameBtn = el.querySelector('.btn-icon-rename');
        const nameText = el.querySelector('.player-name-text');
        if (renameBtn) renameBtn.addEventListener('click', (e) => { e.stopPropagation(); handleRenamePlayer(player); });
        if (nameText) nameText.addEventListener('click', (e) => { e.stopPropagation(); handleRenamePlayer(player); });

        const cb = el.querySelector('.row-checkbox');
        if (cb) {
            cb.addEventListener('change', (e) => togglePlayerSelection(player.id, e.target.checked));
        }

        playersList.appendChild(el);
    });
}

// Tab 2: Presence List Table
function renderPresenceTable(players) {
    presenceList.innerHTML = '';

    // Sort players: Arrived first, then Confirmed, then others
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.has_arrived !== b.has_arrived) return a.has_arrived ? -1 : 1;
        if (a.is_confirmed !== b.is_confirmed) return a.is_confirmed ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });

    if (sortedPlayers.length === 0) {
        presenceList.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">${searchQuery ? 'Nenhum jogador encontrado para a busca.' : 'Nenhum jogador cadastrado na pelada.'}</td></tr>`;
        return;
    }

    sortedPlayers.forEach((player, index) => {
        const el = document.createElement('tr');
        const isSelected = selectedPlayerIds.has(player.id);
        if (isSelected) el.classList.add('selected-row');

        let statusBadge = '';

        if (player.has_arrived) {
            statusBadge = `<span class="status-badge arrived clickable-badge" title="🏟️ Na Quadra (Clique para marcar como Ausente)">🏟️ Na Quadra</span>`;
        } else if (player.is_confirmed) {
            statusBadge = `<span class="status-badge confirmed clickable-badge" title="🟢 Confirmado (Clique para marcar como Ausente)">🟢 Confirmado</span>`;
        } else {
            statusBadge = `<span class="status-badge pending clickable-badge" title="⏳ Ausente (Clique para marcar como Confirmado)">⏳ Ausente</span>`;
        }

        let payBadge = player.is_paying
            ? `<span class="status-badge paid clickable-badge" title="Clique para desmarcar pagamento">💳 Pago</span>`
            : `<span class="status-badge pending clickable-badge" title="Clique para marcar como pago">❌ Pendente</span>`;

        const singular = currentBalanceConfig.label.endsWith('s') ? currentBalanceConfig.label.slice(0, -1) : currentBalanceConfig.label;
        let catBadge = player.is_special_category
            ? `<span class="status-badge category clickable-badge" title="Clique para alternar para Normal">${currentBalanceConfig.emoji} ${singular}</span>`
            : `<span class="status-badge category default clickable-badge" title="Clique para alternar para ${currentBalanceConfig.label}">👤 Normal</span>`;

        let gkBadge = player.is_goalkeeper
            ? `<span class="status-badge goalkeeper clickable-badge" title="Clique para alternar para Linha">🧤 Goleiro</span>`
            : `<span class="status-badge goalkeeper default clickable-badge" title="Clique para definir como Goleiro">⚽ Linha</span>`;

        el.innerHTML = `
            <td class="checkbox-cell" data-label="Selecionar"><input type="checkbox" class="row-checkbox" data-player-id="${player.id}" ${isSelected ? 'checked' : ''}></td>
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome" class="player-name-cell">
                <span class="player-name-text" title="Clique para renomear"><strong>${player.name}</strong></span>
                <button class="btn-icon-rename" title="Renomear jogador">✏️</button>
            </td>
            <td data-label="Categoria">
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                    ${gkBadge}
                    ${catBadge}
                </div>
            </td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Pagamento">${payBadge}</td>
            <td class="action-cell"></td>
        `;

        const renameBtn = el.querySelector('.btn-icon-rename');
        const nameText = el.querySelector('.player-name-text');
        if (renameBtn) renameBtn.addEventListener('click', (e) => { e.stopPropagation(); handleRenamePlayer(player); });
        if (nameText) nameText.addEventListener('click', (e) => { e.stopPropagation(); handleRenamePlayer(player); });

        const gkBadgeEl = el.querySelector('td[data-label="Categoria"] .status-badge.goalkeeper.clickable-badge');
        if (gkBadgeEl) {
            gkBadgeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSetGoalkeeper(player.id, !player.is_goalkeeper);
            });
        }

        const catBadgeEl = el.querySelector('td[data-label="Categoria"] .status-badge.category.clickable-badge');
        if (catBadgeEl) {
            catBadgeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSetCategory(player.id, !player.is_special_category);
            });
        }

        const presenceBadgeEl = el.querySelector('td[data-label="Status"] .status-badge.clickable-badge');
        if (presenceBadgeEl) {
            presenceBadgeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const newStatus = !(player.is_confirmed || player.has_arrived);
                handleSetPresence(player.id, newStatus);
            });
        }

        const payBadgeEl = el.querySelector('td[data-label="Pagamento"] .status-badge.clickable-badge');
        if (payBadgeEl) {
            payBadgeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSetPayment(player.id, !player.is_paying);
            });
        }

        const cb = el.querySelector('.row-checkbox');
        if (cb) {
            cb.addEventListener('change', (e) => togglePlayerSelection(player.id, e.target.checked));
        }

        const actionTd = el.querySelector('.action-cell');
        if (player.has_arrived) {
            const checkoutBtn = document.createElement('button');
            checkoutBtn.className = 'btn-action-sm checkout';
            checkoutBtn.textContent = '👋 Saiu';
            checkoutBtn.onclick = (e) => handleCheckoutPlayer(player, e.currentTarget);
            actionTd.appendChild(checkoutBtn);
        } else {
            const checkinBtn = document.createElement('button');
            checkinBtn.className = 'btn-action-sm checkin';
            checkinBtn.textContent = '📍 Chegou';
            checkinBtn.onclick = (e) => handleCheckinPlayer(player, false, e.currentTarget);
            actionTd.appendChild(checkinBtn);

            if (!player.is_paying) {
                const liberarBtn = document.createElement('button');
                liberarBtn.className = 'btn-action-sm checkin';
                liberarBtn.style.background = 'rgba(56, 189, 248, 0.2)';
                liberarBtn.style.color = '#38bdf8';
                liberarBtn.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                liberarBtn.textContent = '🔓 Liberar';
                liberarBtn.onclick = (e) => handleLiberarPlayer(player, e.currentTarget);
                actionTd.appendChild(liberarBtn);
            }
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action-sm remove';
        deleteBtn.title = 'Remover jogador desta pelada';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = () => handleDeletePlayer(player);
        actionTd.appendChild(deleteBtn);

        presenceList.appendChild(el);
    });
}

// Tab 3: Payment List Table
function renderPaymentTable(players) {
    paymentList.innerHTML = '';
    const relevantPlayers = players;

    const totalCount = relevantPlayers.length;
    const payingCount = relevantPlayers.filter(p => p.is_paying).length;
    const pendingCount = totalCount - payingCount;
    const percent = totalCount > 0 ? Math.round((payingCount / totalCount) * 100) : 0;

    const countTextEl = document.getElementById('payment-count-text');
    const percentTextEl = document.getElementById('payment-percent-text');
    const progressFillEl = document.getElementById('payment-progress-fill');

    if (countTextEl) countTextEl.textContent = `${payingCount} de ${totalCount} pagos`;
    if (percentTextEl) percentTextEl.textContent = `${percent}% Pago`;
    if (progressFillEl) progressFillEl.style.width = `${percent}%`;

    // Update Chip Counter badges
    const countChipAll = document.getElementById('count-chip-all');
    const countChipPaid = document.getElementById('count-chip-paid');
    const countChipPending = document.getElementById('count-chip-pending');
    if (countChipAll) countChipAll.textContent = totalCount;
    if (countChipPaid) countChipPaid.textContent = payingCount;
    if (countChipPending) countChipPending.textContent = pendingCount;

    // Apply Filter & Search
    let displayList = relevantPlayers;
    if (paymentFilter === 'paid') {
        displayList = displayList.filter(p => p.is_paying);
    } else if (paymentFilter === 'pending') {
        displayList = displayList.filter(p => !p.is_paying);
    }

    if (searchQuery) {
        displayList = displayList.filter(p => (p.name || '').toLowerCase().includes(searchQuery));
    }

    if (displayList.length === 0) {
        paymentList.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">${searchQuery ? 'Nenhum jogador encontrado para a busca.' : 'Nenhum jogador nesta lista.'}</td></tr>`;
        return;
    }

    displayList.forEach((player, index) => {
        const el = document.createElement('tr');
        const isSelected = selectedPlayerIds.has(player.id);
        if (isSelected) el.classList.add('selected-row');

        let payBadge = player.is_paying
            ? `<span class="status-badge paid clickable-badge" title="Clique para desmarcar pagamento">💳 Pago</span>`
            : `<span class="status-badge pending clickable-badge" title="Clique para marcar como pago">❌ Pendente</span>`;

        el.innerHTML = `
            <td class="checkbox-cell" data-label="Selecionar"><input type="checkbox" class="row-checkbox" data-player-id="${player.id}" ${isSelected ? 'checked' : ''}></td>
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome" class="player-name-cell">
                <span class="player-name-text" title="Clique para renomear"><strong>${player.name}</strong></span>
                <button class="btn-icon-rename" title="Renomear jogador">✏️</button>
            </td>
            <td data-label="Pagamento">${payBadge}</td>
            <td class="action-cell"></td>
        `;

        const renameBtn = el.querySelector('.btn-icon-rename');
        const nameText = el.querySelector('.player-name-text');
        if (renameBtn) renameBtn.addEventListener('click', (e) => { e.stopPropagation(); handleRenamePlayer(player); });
        if (nameText) nameText.addEventListener('click', (e) => { e.stopPropagation(); handleRenamePlayer(player); });

        const payBadgeEl = el.querySelector('td[data-label="Pagamento"] .status-badge.clickable-badge');
        if (payBadgeEl) {
            payBadgeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSetPayment(player.id, !player.is_paying);
            });
        }

        const cb = el.querySelector('.row-checkbox');
        if (cb) {
            cb.addEventListener('change', (e) => togglePlayerSelection(player.id, e.target.checked));
        }

        const actionTd = el.querySelector('.action-cell');
        const togglePayBtn = document.createElement('button');
        if (player.is_paying) {
            togglePayBtn.className = 'btn-action-sm unpay';
            togglePayBtn.textContent = '↩️ Desfazer';
            togglePayBtn.onclick = () => handleSetPayment(player.id, false);
        } else {
            togglePayBtn.className = 'btn-action-sm pay';
            togglePayBtn.textContent = '💳 Marcar Pago';
            togglePayBtn.onclick = () => handleSetPayment(player.id, true);
        }
        actionTd.appendChild(togglePayBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action-sm remove';
        deleteBtn.title = 'Remover jogador desta pelada';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = () => handleDeletePlayer(player);
        actionTd.appendChild(deleteBtn);

        paymentList.appendChild(el);
    });
}


// ==========================================
// Handlers for Check-in, Checkout, Payments & Delete
// ==========================================

async function handleDeletePlayer(player) {
    if (!player || !player.id) return;
    if (!confirm(`Deseja realmente remover o jogador "${player.name}" desta pelada?`)) return;

    try {
        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${player.id}?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${player.id}`;
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao remover jogador'}`);
                return;
            }
            showToast(`🗑️ Jogador ${player.name} removido.`);
            selectedPlayerIds.delete(player.id);
            await loadSessionDetails(activeSessionId, activeSessionDate);
        } else if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/batch-action`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_ids: [player.id], action: 'remove' })
            });
            if (res.ok) {
                showToast(`🗑️ Jogador ${player.name} removido.`);
                await fetchMatchData(currentPublicHash, currentAdminToken);
            }
        }
    } catch (err) {
        console.error('Erro ao remover jogador:', err);
        alert('Erro de conexão ao remover jogador.');
    }
}


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
    const liberarBtn = document.getElementById('btn-liberar-checkin');
    const cancelBtn = document.getElementById('btn-cancel-pay-checkin');
    const closeBtn = document.getElementById('close-confirm-modal-btn');

    const cleanup = () => {
        confirmModal.classList.add('hidden');
        const anyOpen = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (anyOpen.length === 0) document.body.classList.remove('modal-open');
        if (confirmBtn) confirmBtn.onclick = null;
        if (liberarBtn) liberarBtn.onclick = null;
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

    if (liberarBtn) {
        liberarBtn.onclick = async () => {
            cleanup();
            await handleLiberarPlayer(player);
            if (onSuccess) onSuccess();
        };
    }
}

const pendingLiberations = new Set();
async function handleLiberarPlayer(player, triggerBtn = null) {
    if (!player || !player.id) return;
    if (pendingLiberations.has(player.id)) return;
    pendingLiberations.add(player.id);

    let originalContent = '';
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.classList.add('is-loading');
        originalContent = triggerBtn.innerHTML;
        triggerBtn.innerHTML = '<span class="spin-icon">⏳</span> Liberando...';
    }

    try {
        if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/liberar`;
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
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${player.id}/liberar?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${player.id}/liberar`;
            const res = await fetch(url, { method: 'POST' });
            if (res.ok) {
                loadSessionDetails(activeSessionId, activeSessionDate);
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao liberar jogador'}`);
            }
        }
    } catch (e) {
        console.error('Erro ao liberar jogador:', e);
    } finally {
        pendingLiberations.delete(player.id);
        if (triggerBtn && triggerBtn.parentNode) {
            triggerBtn.disabled = false;
            triggerBtn.classList.remove('is-loading');
            if (originalContent) triggerBtn.innerHTML = originalContent;
        }
    }
}

const pendingCheckins = new Set();
async function handleCheckinPlayer(player, forcePay = false, triggerBtn = null) {
    if (!player || !player.id) return;

    if (!player.is_paying && !forcePay) {
        promptPaymentCheckin(player, () => {
            if (activeSessionId) loadSessionDetails(activeSessionId, activeSessionDate);
            if (currentPublicHash) fetchMatchData(currentPublicHash, currentAdminToken);
        });
        return;
    }

    if (pendingCheckins.has(player.id)) return;
    pendingCheckins.add(player.id);

    let originalContent = '';
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.classList.add('is-loading');
        originalContent = triggerBtn.innerHTML;
        triggerBtn.innerHTML = '<span class="spin-icon">⏳</span> Chegando...';
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
    } finally {
        pendingCheckins.delete(player.id);
        if (triggerBtn && triggerBtn.parentNode) {
            triggerBtn.disabled = false;
            triggerBtn.classList.remove('is-loading');
            if (originalContent) triggerBtn.innerHTML = originalContent;
        }
    }
}

const pendingCheckouts = new Set();
async function handleCheckoutPlayer(player, triggerBtn = null) {
    if (!player || !player.id) return;
    if (pendingCheckouts.has(player.id)) return;
    pendingCheckouts.add(player.id);

    let originalContent = '';
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.classList.add('is-loading');
        originalContent = triggerBtn.innerHTML;
        const isSmallIcon = triggerBtn.classList.contains('btn-icon-sm');
        triggerBtn.innerHTML = isSmallIcon ? '<span class="spin-icon">⏳</span>' : '<span class="spin-icon">⏳</span> Saindo...';
    }

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
    } finally {
        pendingCheckouts.delete(player.id);
        if (triggerBtn && triggerBtn.parentNode) {
            triggerBtn.disabled = false;
            triggerBtn.classList.remove('is-loading');
            if (originalContent) triggerBtn.innerHTML = originalContent;
        }
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

async function handleSetCategory(playerId, isSpecial) {
    try {
        if (views.match && views.match.classList.contains('active') && currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/categoria`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, is_special: isSpecial })
            });
            if (res.ok) {
                const data = await res.json();
                renderMatchData(data);
                showToast(`Categoria atualizada para ${isSpecial ? currentBalanceConfig.label : 'Normal'}!`, 'success');
                return;
            }
        }

        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/categoria?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/categoria`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, is_special: isSpecial })
            });
            if (res.ok) {
                loadSessionDetails(activeSessionId, activeSessionDate);
                showToast(`Categoria atualizada para ${isSpecial ? currentBalanceConfig.label : 'Normal'}!`, 'success');
            }
        }
    } catch (e) {
        console.error('Erro ao atualizar categoria:', e);
        showToast('Erro ao atualizar categoria do jogador.', 'error');
    }
}

async function handleSetGoalkeeper(playerId, isGoalkeeper) {
    try {
        if (views.match && views.match.classList.contains('active') && currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/goleiro`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, is_goalkeeper: isGoalkeeper })
            });
            if (res.ok) {
                const data = await res.json();
                renderMatchData(data);
                showToast(`Jogador definido como ${isGoalkeeper ? 'Goleiro 🧤' : 'Linha ⚽'}!`, 'success');
                return;
            }
        }

        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/goleiro?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/goleiro`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId, is_goalkeeper: isGoalkeeper })
            });
            if (res.ok) {
                loadSessionDetails(activeSessionId, activeSessionDate);
                showToast(`Jogador definido como ${isGoalkeeper ? 'Goleiro 🧤' : 'Linha ⚽'}!`, 'success');
            }
        }
    } catch (e) {
        console.error('Erro ao atualizar status de goleiro:', e);
        showToast('Erro ao atualizar status de goleiro do jogador.', 'error');
    }
}

async function handleSetPresence(playerId, isConfirmed) {
    try {
        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey
                ? `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/presenca?key=${encodeURIComponent(adminKey)}`
                : `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/presenca`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_confirmed: isConfirmed })
            });
            if (res.ok) {
                showToast(isConfirmed ? '🟢 Presença confirmada!' : '⏳ Marcado como ausente.');
                await loadSessionDetails(activeSessionId, activeSessionDate);
            }
        } else if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/players/${playerId}/presenca`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_confirmed: isConfirmed })
            });
            if (res.ok) {
                showToast(isConfirmed ? '🟢 Presença confirmada!' : '⏳ Marcado como ausente.');
                await fetchMatchData(currentPublicHash, currentAdminToken);
            }
        }
    } catch (e) {
        console.error('Erro ao alternar presença:', e);
        alert('Erro ao alternar presença do jogador.');
    }
}

function handleRenamePlayer(player) {
    const newName = prompt(`Digite o novo nome para "${player.name}":`, player.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) {
        alert('O nome do jogador não pode ficar vazio.');
        return;
    }
    if (trimmed === player.name) return;
    executeRenamePlayer(player.id, trimmed);
}

async function executeRenamePlayer(playerId, newName) {
    try {
        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey
                ? `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/rename?key=${encodeURIComponent(adminKey)}`
                : `${API_BASE}/sessions/${activeSessionId}/players/${playerId}/rename`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            if (!res.ok) {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao renomear jogador'}`);
                return;
            }
            showToast(`✏️ Jogador renomeado para "${newName}"`);
            await loadSessionDetails(activeSessionId, activeSessionDate);
        } else if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/players/${playerId}/rename`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            if (res.ok) {
                showToast(`✏️ Jogador renomeado para "${newName}"`);
                await fetchMatchData(currentPublicHash, currentAdminToken);
            }
        }
    } catch (err) {
        console.error('Erro ao renomear jogador:', err);
        alert('Erro de conexão ao renomear jogador.');
    }
}

// ==========================================
// Rotation Feedback & Banner Animations
// ==========================================

function clearEnteringHighlights() {
    if (highlightDismissTimeout) {
        clearTimeout(highlightDismissTimeout);
        highlightDismissTimeout = null;
    }
    if (currentEnteringPlayerIds && currentEnteringPlayerIds.size > 0) {
        currentEnteringPlayerIds.clear();
        if (currentMatchData && currentMatchData.teams) {
            renderTeamPlayers(team1PlayersEl, currentMatchData.teams.team_1.players, currentMatchData.is_admin);
            renderTeamPlayers(team2PlayersEl, currentMatchData.teams.team_2.players, currentMatchData.is_admin);
            renderGoalkeeper(team1GkEl, currentMatchData.teams.team_1.goalkeeper, currentMatchData.is_admin);
            renderGoalkeeper(team2GkEl, currentMatchData.teams.team_2.goalkeeper, currentMatchData.is_admin);
        }
    }
}

function showRotationFeedback(winner, winnerLabel, enteringPlayers = []) {
    if (!matchResultNotification) return;

    if (bannerDismissTimeout) clearTimeout(bannerDismissTimeout);
    if (highlightDismissTimeout) clearTimeout(highlightDismissTimeout);

    // Track entering player IDs for highlighting pitch cards
    // In a draw where 2 whole teams enter (8+ players), do not blanket-highlight all players with generic neon!
    if (winner === 0 && enteringPlayers && enteringPlayers.length >= 8) {
        currentEnteringPlayerIds = new Set();
    } else if (enteringPlayers && enteringPlayers.length > 0) {
        currentEnteringPlayerIds = new Set(enteringPlayers.map(p => p.id));
    } else {
        currentEnteringPlayerIds = new Set();
    }

    // Auto-clear highlight after 5 seconds so players return to uniform clean styling
    highlightDismissTimeout = setTimeout(clearEnteringHighlights, 5000);

    // Configure Banner Content based on result
    if (winner === 0) {
        matchResultNotification.classList.add('draw-result');
        if (resultBannerIcon) resultBannerIcon.textContent = '🤝';
        if (resultBannerTitle) resultBannerTitle.textContent = 'Empate na Partida!';
        if (resultBannerSubtitle) {
            resultBannerSubtitle.textContent = (enteringPlayers && enteringPlayers.length >= 8)
                ? 'Dois novos times entraram em quadra após o empate!'
                : 'Rodada encerrada em empate e os times foram rodados!';
        }
    } else {
        matchResultNotification.classList.remove('draw-result');
        if (resultBannerIcon) resultBannerIcon.textContent = '🏆';
        if (resultBannerTitle) resultBannerTitle.textContent = `${winnerLabel || 'Time Vencedor'} Venceu!`;
        if (resultBannerSubtitle) resultBannerSubtitle.textContent = 'Vitória registrada com sucesso! Novo time lançado em quadra.';
    }

    // Render Entering Players Tags
    if (resultBannerEnteringTags && resultBannerEnteringSection) {
        resultBannerEnteringTags.innerHTML = '';
        if (enteringPlayers && enteringPlayers.length > 0) {
            resultBannerEnteringSection.classList.remove('hidden');
            enteringPlayers.forEach(p => {
                const tag = document.createElement('span');
                tag.className = 'entering-tag';
                tag.innerHTML = `<span class="badge-icon">⚡</span> ${p.name}`;
                resultBannerEnteringTags.appendChild(tag);
            });
        } else {
            resultBannerEnteringSection.classList.add('hidden');
        }
    }

    // Display Notification Banner
    matchResultNotification.classList.remove('hidden');

    // Pitch Glow Animation
    const pitchContainer = document.querySelector('.pitch-container');
    if (pitchContainer) {
        pitchContainer.classList.remove('court-flash');
        // Force reflow for animation restart
        void pitchContainer.offsetWidth;
        pitchContainer.classList.add('court-flash');
        setTimeout(() => pitchContainer.classList.remove('court-flash'), 1800);
    }

    // Auto-dismiss after 7 seconds
    bannerDismissTimeout = setTimeout(hideRotationFeedback, 7000);
}

function hideRotationFeedback() {
    if (bannerDismissTimeout) {
        clearTimeout(bannerDismissTimeout);
        bannerDismissTimeout = null;
    }
    if (matchResultNotification) {
        matchResultNotification.classList.add('hidden');
    }
    clearEnteringHighlights();
}

// ==========================================
// Batch Actions & Player Selection Logic
// ==========================================

function togglePlayerSelection(playerId, isSelected) {
    if (isSelected) {
        selectedPlayerIds.add(playerId);
    } else {
        selectedPlayerIds.delete(playerId);
    }
    updateBatchUI();
}

function clearPlayerSelection() {
    selectedPlayerIds.clear();
    updateBatchUI();
}

function updateBatchUI() {
    const count = selectedPlayerIds.size;
    if (batchSelectedCount) batchSelectedCount.textContent = count;

    if (count > 0 && batchActionBar) {
        batchActionBar.classList.remove('hidden');
    } else if (batchActionBar) {
        batchActionBar.classList.add('hidden');
    }

    // Sync all row checkboxes and tr.selected-row classes
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        const pId = parseInt(cb.dataset.playerId, 10);
        const checked = selectedPlayerIds.has(pId);
        cb.checked = checked;
        const tr = cb.closest('tr');
        if (tr) {
            if (checked) tr.classList.add('selected-row');
            else tr.classList.remove('selected-row');
        }
    });

    // Sync select-all checkboxes
    const allRowCBs = Array.from(document.querySelectorAll('.row-checkbox'));
    const allChecked = allRowCBs.length > 0 && allRowCBs.every(cb => cb.checked);
    [selectAllStats, selectAllPresence, selectAllPayment].forEach(headerCB => {
        if (headerCB) headerCB.checked = allChecked;
    });
}

function handleSelectAll(isSelectAll) {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        const pId = parseInt(cb.dataset.playerId, 10);
        if (pId) {
            if (isSelectAll) selectedPlayerIds.add(pId);
            else selectedPlayerIds.delete(pId);
        }
    });
    updateBatchUI();
}

function selectUnpaidPlayers() {
    clearPlayerSelection();
    currentPlayers.forEach(p => {
        if (!p.is_paying) selectedPlayerIds.add(p.id);
    });
    updateBatchUI();
}

function selectUnarrivedPlayers() {
    clearPlayerSelection();
    currentPlayers.forEach(p => {
        if (!p.has_arrived) selectedPlayerIds.add(p.id);
    });
    updateBatchUI();
}

async function executeBatchAction(action) {
    if (selectedPlayerIds.size === 0) return;

    const ids = Array.from(selectedPlayerIds);
    const actionLabel = action === 'pay' ? 'confirmar pagamento de' :
        action === 'unpay' ? 'desmarcar pagamento de' :
            action === 'checkin' ? 'fazer check-in / liberar' :
                action === 'checkout' ? 'fazer checkout de' : 'processar';

    if (!confirm(`Deseja realmente ${actionLabel} ${ids.length} jogador(es) selecionado(s)?`)) {
        return;
    }

    try {
        let response;
        if (views.match && views.match.classList.contains('active') && currentPublicHash && currentAdminToken) {
            response = await fetch(`${API_BASE}/sessions/hash/${currentPublicHash}/batch-action?token=${encodeURIComponent(currentAdminToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_ids: ids, action: action })
            });
            if (response.ok) {
                const data = await response.json();
                clearPlayerSelection();
                renderMatchData(data, true);
                return;
            }
        } else if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/players/batch-action?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/players/batch-action`;
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_ids: ids, action: action })
            });
            if (response.ok) {
                clearPlayerSelection();
                loadSessionDetails(activeSessionId, activeSessionDate);
                return;
            }
        }

        if (response && !response.ok) {
            const err = await response.json();
            alert(`Erro na ação em lote: ${err.detail || 'Falha ao processar'}`);
        }
    } catch (e) {
        console.error('Erro na ação em lote:', e);
        alert('Erro ao conectar para executar ação em lote.');
    }
}

function setupBatchListeners() {
    if (batchBtnPay) batchBtnPay.addEventListener('click', () => executeBatchAction('pay'));
    if (batchBtnUnpay) batchBtnUnpay.addEventListener('click', () => executeBatchAction('unpay'));
    if (batchBtnSpecial) batchBtnSpecial.addEventListener('click', () => executeBatchAction('set_special'));
    if (batchBtnUnspecial) batchBtnUnspecial.addEventListener('click', () => executeBatchAction('unset_special'));
    if (batchBtnGoalkeeper) batchBtnGoalkeeper.addEventListener('click', () => executeBatchAction('set_goalkeeper'));
    if (batchBtnUnGoalkeeper) batchBtnUnGoalkeeper.addEventListener('click', () => executeBatchAction('unset_goalkeeper'));
    if (batchBtnCheckin) batchBtnCheckin.addEventListener('click', () => executeBatchAction('checkin'));
    if (batchBtnCheckout) batchBtnCheckout.addEventListener('click', () => executeBatchAction('checkout'));
    if (batchBtnRemove) {
        batchBtnRemove.addEventListener('click', async () => {
            const count = selectedPlayerIds.size;
            if (count === 0) return;
            const confirmMsg = count === 1
                ? `Deseja realmente remover o jogador selecionado desta pelada?`
                : `Deseja realmente remover os ${count} jogadores selecionados desta pelada?`;
            if (!confirm(confirmMsg)) return;
            await executeBatchAction('remove');
        });
    }
    if (batchBtnClear) batchBtnClear.addEventListener('click', clearPlayerSelection);

    if (batchChipUnpaid) batchChipUnpaid.addEventListener('click', selectUnpaidPlayers);
    if (batchChipUnarrived) batchChipUnarrived.addEventListener('click', selectUnarrivedPlayers);

    [selectAllStats, selectAllPresence, selectAllPayment].forEach(cb => {
        if (cb) {
            cb.addEventListener('change', (e) => handleSelectAll(e.target.checked));
        }
    });
}

// Initialize Batch Action listeners
document.addEventListener('DOMContentLoaded', setupBatchListeners);

// ==========================================
// Quadra ao Vivo & Manager Feature
// ==========================================

function setupMatchViewListeners() {
    if (closeResultBannerBtn) {
        closeResultBannerBtn.addEventListener('click', hideRotationFeedback);
    }

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
            const specialInput = document.getElementById('add-is-special');
            const gkInput = document.getElementById('add-is-goalkeeper');
            if (specialInput) specialInput.checked = false;
            if (gkInput) gkInput.checked = false;
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
            const isSpecialInput = document.getElementById('add-is-special');
            const isGkInput = document.getElementById('add-is-goalkeeper');
            const doCheckinInput = document.getElementById('add-do-checkin');

            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) return;

            const is_paying = isPayingInput ? isPayingInput.checked : false;
            const is_special = isSpecialInput ? isSpecialInput.checked : false;
            const is_goalkeeper = isGkInput ? isGkInput.checked : false;
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
                        do_checkin: do_checkin,
                        is_special: is_special,
                        is_goalkeeper: is_goalkeeper
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
            const isSpecialInput = document.getElementById('quick-is-special');
            const isGkInput = document.getElementById('quick-is-goalkeeper');

            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) return;

            const is_paying = isPayingInput ? isPayingInput.checked : true;
            const is_special = isSpecialInput ? isSpecialInput.checked : false;
            const is_goalkeeper = isGkInput ? isGkInput.checked : false;

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
                            do_checkin: true,
                            is_special: is_special,
                            is_goalkeeper: is_goalkeeper
                        })
                    });

                    if (res.ok) {
                        if (nameInput) nameInput.value = '';
                        if (isSpecialInput) isSpecialInput.checked = false;
                        if (isGkInput) isGkInput.checked = false;
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
                            do_checkin: true,
                            is_special: is_special,
                            is_goalkeeper: is_goalkeeper
                        })
                    });

                    if (res.ok) {
                        if (nameInput) nameInput.value = '';
                        if (isSpecialInput) isSpecialInput.checked = false;
                        if (isGkInput) isGkInput.checked = false;
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

function renderMatchData(data, isManualAction = false) {
    currentMatchData = data;
    if (data.balance_config) {
        updateBalanceConfig(data.balance_config);
    }
    // Session Label
    matchSessionLabel.textContent = `Pelada #${data.session_id} • ${data.is_active ? 'Em Andamento' : 'Finalizada'}`;

    // Admin Panel & Badge
    const quickAddArrivalSection = document.getElementById('quick-add-arrival-section');
    if (data.is_admin) {
        adminBadge.classList.remove('hidden');
        adminControlsPanel.classList.remove('hidden');
        if (quickAddArrivalSection) quickAddArrivalSection.classList.remove('hidden');
    } else {
        adminBadge.classList.add('hidden');
        adminControlsPanel.classList.add('hidden');
        if (quickAddArrivalSection) quickAddArrivalSection.classList.add('hidden');
    }

    // Auto-detect rotation event for spectators polling live
    if (!isManualAction && data.last_event_type === 'rotate' && data.last_event_time) {
        if (lastSeenRotationEventTime && lastSeenRotationEventTime !== data.last_event_time) {
            const allCourtPlayers = (data.teams.team_1.players || [])
                .concat(data.teams.team_2.players || [])
                .concat(data.teams.team_1.goalkeeper ? [data.teams.team_1.goalkeeper] : [])
                .concat(data.teams.team_2.goalkeeper ? [data.teams.team_2.goalkeeper] : []);
            showRotationFeedback(null, null, allCourtPlayers);
        }
        lastSeenRotationEventTime = data.last_event_time;
    } else if (data.last_event_time) {
        lastSeenRotationEventTime = data.last_event_time;
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

    // Render Goalkeepers
    renderGoalkeeper(team1GkEl, t1.goalkeeper, data.is_admin);
    renderGoalkeeper(team2GkEl, t2.goalkeeper, data.is_admin);

    // Render Court Players
    renderTeamPlayers(team1PlayersEl, t1.players, data.is_admin);
    renderTeamPlayers(team2PlayersEl, t2.players, data.is_admin);

    // Render Next Team
    renderNextTeam(data.next_team, data.is_admin);

    // Render Goalkeeper Queue & Next GK
    renderGoalkeeperQueue(data.goalkeeper_queue, data.next_goalkeeper, data.is_admin);

    // Render Pending Check-in list (All confirmed players who haven't checked in yet)
    renderPendingCheckinList(data.all_players, data.is_admin);

    // Render Waiting Queue
    renderMatchQueue(data.queue, data.is_admin);

    // Update FAB queue count
    const fabQueueCount = document.getElementById('fab-queue-count');
    if (fabQueueCount) {
        const totalWaiting = (data.queue ? data.queue.length : 0) + (data.goalkeeper_queue ? data.goalkeeper_queue.length : 0);
        fabQueueCount.textContent = totalWaiting;
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
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 0.8rem; font-size: 0.85rem;">Nenhum jogador</div>`;
        return;
    }

    players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'player-card';

        const isEntering = currentEnteringPlayerIds.has(p.id);
        if (isEntering) {
            card.classList.add('entering-highlight');
        }

        const catMarker = p.is_special_category ? ` <span title="${currentBalanceConfig.label}">${currentBalanceConfig.emoji}</span>` : '';

        const info = document.createElement('div');
        info.className = 'player-card-info';
        info.innerHTML = `
            <span class="player-card-name">
                ${p.name}${catMarker}
                ${isEntering ? '<span class="new-entrant-badge">Entrou</span>' : ''}
            </span>
            <span class="player-card-stats">${p.points} pts</span>
        `;

        card.appendChild(info);

        if (isAdmin) {
            const actions = document.createElement('div');
            actions.className = 'player-card-actions';

            const btnDescer = document.createElement('button');
            btnDescer.className = 'btn-icon-sm descer';
            btnDescer.title = 'Descer para a reserva';
            btnDescer.textContent = '🪑';
            btnDescer.addEventListener('click', (e) => handlePlayerAction('descer', p.id, e.currentTarget));

            const btnSair = document.createElement('button');
            btnSair.className = 'btn-icon-sm sair';
            btnSair.title = 'Sair da pelada';
            btnSair.textContent = '👋';
            btnSair.addEventListener('click', (e) => handlePlayerAction('sair', p.id, e.currentTarget));

            actions.appendChild(btnDescer);
            actions.appendChild(btnSair);
            card.appendChild(actions);
        }

        container.appendChild(card);
    });
}

function renderGoalkeeper(container, gk, isAdmin) {
    if (!container) return;
    container.innerHTML = '';
    if (!gk) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    const strip = document.createElement('div');
    strip.className = 'goalkeeper-strip';

    const isEntering = currentEnteringPlayerIds.has(gk.id);
    if (isEntering) {
        strip.classList.add('entering-highlight');
    }

    const catMarker = gk.is_special_category ? ` <span title="${currentBalanceConfig.label}">${currentBalanceConfig.emoji}</span>` : '';

    const info = document.createElement('div');
    info.className = 'gk-strip-info';
    info.innerHTML = `
        <span class="gk-badge">🧤 GOL</span>
        <span class="gk-name">${gk.name}${catMarker}</span>
        <span class="gk-pts">${gk.points} pts</span>
        ${isEntering ? '<span class="new-entrant-badge">Entrou</span>' : ''}
    `;

    strip.appendChild(info);

    if (isAdmin) {
        const actions = document.createElement('div');
        actions.className = 'gk-strip-actions';

        const btnDescer = document.createElement('button');
        btnDescer.className = 'btn-icon-sm descer';
        btnDescer.title = 'Descer para a reserva de goleiros';
        btnDescer.textContent = '🪑';
        btnDescer.addEventListener('click', (e) => handlePlayerAction('descer', gk.id, e.currentTarget));

        const btnSair = document.createElement('button');
        btnSair.className = 'btn-icon-sm sair';
        btnSair.title = 'Sair da pelada';
        btnSair.textContent = '👋';
        btnSair.addEventListener('click', (e) => handlePlayerAction('sair', gk.id, e.currentTarget));

        actions.appendChild(btnDescer);
        actions.appendChild(btnSair);
        strip.appendChild(actions);
    }

    container.appendChild(strip);
}

function renderGoalkeeperQueue(gkQueue, nextGk, isAdmin) {
    const gkSection = document.getElementById('gk-queue-section');
    const gkCountBadge = document.getElementById('gk-queue-count-badge');
    const nextGkContainer = document.getElementById('next-gk-container');
    const gkQueueListEl = document.getElementById('match-gk-queue-list');

    if (!gkSection || !gkQueueListEl) return;

    const hasGkActivity = (gkQueue && gkQueue.length > 0) || nextGk;
    if (!hasGkActivity) {
        gkSection.classList.add('hidden');
        return;
    }
    gkSection.classList.remove('hidden');

    const count = gkQueue ? gkQueue.length : 0;
    if (gkCountBadge) {
        gkCountBadge.textContent = `${count} Goleiro(s)`;
    }

    if (nextGkContainer) {
        if (nextGk) {
            nextGkContainer.innerHTML = `
                <div class="next-gk-card">
                    <span class="num-badge">🧤 PRÓXIMO GOLEIRO</span>
                    <h4>${nextGk.name}</h4>
                    <p>${nextGk.cycles_waiting} rodada(s) esperando</p>
                </div>
            `;
            nextGkContainer.classList.remove('hidden');
        } else {
            nextGkContainer.innerHTML = '';
            nextGkContainer.classList.add('hidden');
        }
    }

    const liveNextGkContainer = document.getElementById('live-next-gk-container');
    if (liveNextGkContainer) {
        if (nextGk) {
            liveNextGkContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.35rem; min-width: 0;">
                    <span class="gk-badge">🧤 GOL</span>
                    <strong style="color: var(--text-main); font-size: 0.82rem;">${nextGk.name}</strong>
                    <span style="color: #fbbf24; font-size: 0.72rem; margin-left: 0.2rem;">(Próximo Goleiro)</span>
                </div>
                <span style="color: var(--text-muted); font-size: 0.72rem; flex-shrink: 0;">${nextGk.cycles_waiting} rodada(s) aguardando</span>
            `;
            liveNextGkContainer.classList.remove('hidden');
        } else {
            liveNextGkContainer.innerHTML = '';
            liveNextGkContainer.classList.add('hidden');
        }
    }

    gkQueueListEl.innerHTML = '';
    if (!gkQueue || gkQueue.length === 0) {
        gkQueueListEl.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum goleiro aguardando na fila.</td></tr>`;
        return;
    }

    gkQueue.forEach((p, index) => {
        const tr = document.createElement('tr');
        const payBadge = p.is_paying
            ? `<span class="status-badge paid ${isAdmin ? 'clickable-badge' : ''}" style="font-size:0.75rem;" title="${isAdmin ? 'Clique para desmarcar pagamento' : 'Status de pagamento'}">💳 Pago</span>`
            : `<span class="status-badge pending ${isAdmin ? 'clickable-badge' : ''}" style="font-size:0.75rem;" title="${isAdmin ? 'Clique para marcar como pago' : 'Status de pagamento'}">❌ Pendente</span>`;

        tr.innerHTML = `
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome">
                <strong>${p.name}</strong>
                <span class="status-badge goalkeeper ${isAdmin ? 'clickable-badge' : ''}" style="font-size: 0.7rem; margin-left: 0.25rem;" title="${isAdmin ? 'Clique para alternar para Jogador de Linha' : 'Goleiro'}">🧤 Gol</span>
            </td>
            <td data-label="Rodadas">${p.cycles_waiting} rodada(s)</td>
            <td data-label="Status">${payBadge}</td>
            <td class="action-cell"></td>
        `;

        if (isAdmin) {
            const gkBadgeEl = tr.querySelector('.status-badge.goalkeeper.clickable-badge');
            if (gkBadgeEl) {
                gkBadgeEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSetGoalkeeper(p.id, false);
                });
            }

            const payBadgeEl = tr.querySelector('.status-badge.paid.clickable-badge, .status-badge.pending.clickable-badge');
            if (payBadgeEl) {
                payBadgeEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSetPayment(p.id, !p.is_paying);
                });
            }

            const actionTd = tr.querySelector('.action-cell');
            const checkoutBtn = document.createElement('button');
            checkoutBtn.className = 'btn-action-sm checkout';
            checkoutBtn.textContent = '👋 Saiu';
            checkoutBtn.onclick = (e) => handleCheckoutPlayer(p, e.currentTarget);
            actionTd.appendChild(checkoutBtn);
        }

        gkQueueListEl.appendChild(tr);
    });
}

function renderNextTeam(nextPlayers, isAdmin) {
    const liveNextTeamListEl = document.getElementById('live-next-team-list');
    const liveNextTeamCountBadge = document.getElementById('live-next-team-count-badge');

    const singular = currentBalanceConfig.label.endsWith('s') ? currentBalanceConfig.label.slice(0, -1) : currentBalanceConfig.label;
    const countText = nextPlayers && nextPlayers.length > 0 ? `${nextPlayers.length} Jogador(es)` : '0 Jogadores';

    if (nextTeamCountBadge) nextTeamCountBadge.textContent = countText;
    if (liveNextTeamCountBadge) liveNextTeamCountBadge.textContent = countText;

    // 1. Render in Live Next Team Card (Directly on match view)
    if (liveNextTeamListEl) {
        liveNextTeamListEl.innerHTML = '';
        if (!nextPlayers || nextPlayers.length === 0) {
            liveNextTeamListEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 0.6rem; font-size: 0.82rem;">Nenhum jogador aguardando na fila.</div>`;
        } else {
            nextPlayers.forEach((p, index) => {
                const chip = document.createElement('div');
                chip.className = 'live-next-player-chip';
                const catBadge = p.is_special_category
                    ? `<span title="${currentBalanceConfig.label}">${currentBalanceConfig.emoji}</span>`
                    : '';
                chip.innerHTML = `
                    <div class="player-info">
                        <span class="order-num">#${index + 1}</span>
                        <span class="player-name">${p.name} ${catBadge}</span>
                    </div>
                `;
                if (isAdmin) {
                    const btnOut = document.createElement('button');
                    btnOut.className = 'btn-icon-sm sair';
                    btnOut.title = 'Marcar como saiu';
                    btnOut.textContent = '👋';
                    btnOut.onclick = (e) => handleCheckoutPlayer(p, e.currentTarget);
                    chip.appendChild(btnOut);
                }
                liveNextTeamListEl.appendChild(chip);
            });
        }
    }

    // 2. Render in Queue Modal
    if (nextTeamListEl) {
        nextTeamListEl.innerHTML = '';
        if (!nextPlayers || nextPlayers.length === 0) {
            nextTeamListEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 1rem;">Nenhum jogador aguardando na fila.</div>`;
        } else {
            nextPlayers.forEach((p, index) => {
                const card = document.createElement('div');
                card.className = 'next-player-card';
                const catBadge = p.is_special_category
                    ? `<span class="player-category-pill" style="margin-left: 0.2rem; font-size: 0.7rem;">${currentBalanceConfig.emoji} ${singular}</span>`
                    : '';
                card.innerHTML = `
                    <span class="num-badge">PRÓXIMO #${index + 1}</span>
                    <h4>${p.name} ${catBadge} ${p.is_paying ? '💳' : ''}</h4>
                    <p>${p.cycles_waiting} rodada(s) esperando</p>
                    <div class="next-player-action" style="margin-top: 0.5rem;"></div>
                `;

                if (isAdmin) {
                    const checkoutBtn = document.createElement('button');
                    checkoutBtn.className = 'btn-action-sm checkout';
                    checkoutBtn.textContent = '👋 Saiu';
                    checkoutBtn.onclick = (e) => handleCheckoutPlayer(p, e.currentTarget);
                    card.querySelector('.next-player-action').appendChild(checkoutBtn);
                }

                nextTeamListEl.appendChild(card);
            });
        }
    }
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
        const gkTag = p.is_goalkeeper ? `<span class="badge sm" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size:0.75rem;">🧤 Gol</span>` : '';
        const catTag = p.is_special_category ? `<span class="badge sm" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size:0.75rem;">${currentBalanceConfig.emoji}</span>` : '';
        card.innerHTML = `
            <div class="player-info-sub">
                <span class="player-name">${p.name} ${gkTag} ${catTag}</span>
                <div>${payStatus}</div>
            </div>
            <div class="card-action"></div>
        `;

        if (isAdmin) {
            const checkinBtn = document.createElement('button');
            checkinBtn.className = 'btn-action-sm checkin';
            checkinBtn.textContent = '📍 Chegou';
            checkinBtn.onclick = (e) => handleCheckinPlayer(p, false, e.currentTarget);
            card.querySelector('.card-action').appendChild(checkinBtn);

            if (!p.is_paying) {
                const liberarBtn = document.createElement('button');
                liberarBtn.className = 'btn-action-sm checkin';
                liberarBtn.style.background = 'rgba(56, 189, 248, 0.2)';
                liberarBtn.style.color = '#38bdf8';
                liberarBtn.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                liberarBtn.textContent = '🔓 Liberar';
                liberarBtn.onclick = (e) => handleLiberarPlayer(p, e.currentTarget);
                card.querySelector('.card-action').appendChild(liberarBtn);
            }
        }

        pendingContainer.appendChild(card);
    });
}

function renderMatchQueue(queuePlayers, isAdmin) {
    matchQueueListEl.innerHTML = '';
    if (!queuePlayers || queuePlayers.length === 0) {
        matchQueueListEl.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Fila de espera vazia.</td></tr>`;
        return;
    }

    const singular = currentBalanceConfig.label.endsWith('s') ? currentBalanceConfig.label.slice(0, -1) : currentBalanceConfig.label;

    queuePlayers.forEach((p, index) => {
        const tr = document.createElement('tr');
        const payBadge = p.is_paying
            ? `<span class="status-badge paid ${isAdmin ? 'clickable-badge' : ''}" style="font-size:0.75rem;" title="${isAdmin ? 'Clique para desmarcar pagamento' : 'Status de pagamento'}">💳 Pago</span>`
            : `<span class="status-badge pending ${isAdmin ? 'clickable-badge' : ''}" style="font-size:0.75rem;" title="${isAdmin ? 'Clique para marcar como pago' : 'Status de pagamento'}">❌ Pendente</span>`;

        const gkBadge = p.is_goalkeeper
            ? `<span class="status-badge goalkeeper ${isAdmin ? 'clickable-badge' : ''}" style="font-size:0.72rem;" title="${isAdmin ? 'Clique para alternar para Linha' : 'Goleiro'}">🧤 Gol</span>`
            : (isAdmin ? `<span class="status-badge goalkeeper default clickable-badge" style="font-size:0.72rem;" title="Clique para definir como Goleiro">⚽ Linha</span>` : '');

        const catBadge = p.is_special_category
            ? `<span class="status-badge category ${isAdmin ? 'clickable-badge' : ''}" style="font-size:0.72rem;" title="${isAdmin ? 'Clique para alternar categoria' : currentBalanceConfig.label}">${currentBalanceConfig.emoji} ${singular}</span>`
            : (isAdmin ? `<span class="status-badge category default clickable-badge" style="font-size:0.72rem;" title="Clique para marcar como ${currentBalanceConfig.label}">👤 Normal</span>` : '');

        const quotaBadge = p.is_skipped_by_quota
            ? `<span class="status-badge skipped-quota" title="Aguardando próxima vaga para manter limite de 1 por time">⏳ Aguarda vaga</span>`
            : '';

        tr.innerHTML = `
            <td data-label="">#${index + 1}</td>
            <td data-label="Nome">
                <strong>${p.name}</strong>
                ${quotaBadge}
            </td>
            <td data-label="Rodadas">${p.cycles_waiting} rodada(s)</td>
            <td data-label="Status">${gkBadge} ${catBadge} ${payBadge}</td>
            <td class="action-cell"></td>
        `;

        if (isAdmin) {
            const gkBadgeEl = tr.querySelector('.status-badge.goalkeeper.clickable-badge');
            if (gkBadgeEl) {
                gkBadgeEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSetGoalkeeper(p.id, !p.is_goalkeeper);
                });
            }

            const catBadgeEl = tr.querySelector('.status-badge.category.clickable-badge');
            if (catBadgeEl) {
                catBadgeEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSetCategory(p.id, !p.is_special_category);
                });
            }

            const payBadgeEl = tr.querySelector('.status-badge.paid.clickable-badge, .status-badge.pending.clickable-badge');
            if (payBadgeEl) {
                payBadgeEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSetPayment(p.id, !p.is_paying);
                });
            }

            const actionTd = tr.querySelector('.action-cell');
            const checkoutBtn = document.createElement('button');
            checkoutBtn.className = 'btn-action-sm checkout';
            checkoutBtn.textContent = '👋 Saiu';
            checkoutBtn.onclick = (e) => handleCheckoutPlayer(p, e.currentTarget);
            actionTd.appendChild(checkoutBtn);
        }

        matchQueueListEl.appendChild(tr);
    });
}

let isRotatingMatch = false;
async function handleRotateMatch(winner) {
    if (!currentPublicHash || !currentAdminToken) return;
    if (isRotatingMatch) return;

    isRotatingMatch = true;

    const btns = [btnWinT1, btnDraw, btnWinT2];
    const prevTexts = new Map();
    btns.forEach(btn => {
        if (btn) {
            prevTexts.set(btn, btn.textContent);
            btn.disabled = true;
            btn.classList.add('is-loading');
        }
    });

    let targetBtn = null;
    if (winner === 1) targetBtn = btnWinT1;
    else if (winner === 2) targetBtn = btnWinT2;
    else if (winner === 0) targetBtn = btnDraw;

    if (targetBtn) {
        targetBtn.innerHTML = '<span class="spin-icon">⏳</span> Registrando...';
    }

    let rotationSuccess = false;
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

        // Trigger visual feedback notification for match result and entering team
        const lastRes = data.last_result || {};
        const entering = data.entering_players || [];
        showRotationFeedback(lastRes.winner, lastRes.winner_label, entering);

        renderMatchData(data, true);
        rotationSuccess = true;
    } catch (error) {
        console.error('Erro na rotação:', error);
        alert('Erro de conexão ao registrar resultado.');
    } finally {
        isRotatingMatch = false;
        btns.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('is-loading');
                if (!rotationSuccess && prevTexts.has(btn)) {
                    btn.textContent = prevTexts.get(btn);
                }
            }
        });
        if (!rotationSuccess && targetBtn && targetBtn.innerHTML.includes('⏳')) {
            targetBtn.textContent = prevTexts.get(targetBtn) || targetBtn.textContent;
        } else if (rotationSuccess && targetBtn === btnDraw) {
            btnDraw.textContent = '🤝 Empatou';
        }
    }
}

const pendingPlayerActions = new Set();
async function handlePlayerAction(action, playerId, triggerBtn = null) {
    if (!currentPublicHash || !currentAdminToken) return;

    const actionKey = `${action}_${playerId}`;
    if (pendingPlayerActions.has(actionKey)) return;

    const actionText = action === 'descer' ? 'descer este jogador para a reserva' : 'remover este jogador da pelada';
    if (!confirm(`Tem certeza que deseja ${actionText}?`)) return;

    if (pendingPlayerActions.has(actionKey)) return;
    pendingPlayerActions.add(actionKey);

    let originalContent = '';
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.classList.add('is-loading');
        originalContent = triggerBtn.innerHTML;
        triggerBtn.innerHTML = '<span class="spin-icon">⏳</span>';
    }

    // Clear entering highlights so the new replacement player and existing teammates have matching uniform styling
    clearEnteringHighlights();

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
    } finally {
        pendingPlayerActions.delete(actionKey);
        if (triggerBtn && triggerBtn.parentNode) {
            triggerBtn.disabled = false;
            triggerBtn.classList.remove('is-loading');
            if (originalContent) triggerBtn.innerHTML = originalContent;
        }
    }
}

async function handleRestartPelada() {
    const confirmMsg = "Tem certeza que deseja recomeçar a pelada?\n\nA pelada atual será encerrada e salva no histórico, e uma NOVA pelada será iniciada mantendo apenas a lista de jogadores pagantes.";
    if (!confirm(confirmMsg)) return;

    try {
        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/recomecar?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/recomecar`;
            const response = await fetch(url, { method: 'POST' });
            if (!response.ok) {
                const err = await response.json();
                alert(`Erro: ${err.detail || 'Falha ao recomeçar a pelada'}`);
                return;
            }
            const data = await response.json();
            if (data.new_session_id) {
                activeSessionId = data.new_session_id;
            }
            await loadSessions();
            if (activeSessionId) {
                await loadSessionDetails(activeSessionId, activeSessionDate);
            }
            alert("🔄 Nova pelada iniciada com sucesso! A lista de pagantes foi mantida.");
        }
    } catch (err) {
        console.error('Erro ao recomeçar a pelada:', err);
        alert('Erro de conexão ao tentar recomeçar a pelada.');
    }
}

async function handleDrawTeams() {
    if (!activeSessionId) return;

    if (!confirm('Deseja realizar o sorteio dos times para esta pelada?')) return;

    try {
        const adminKey = getAdminKey();
        const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/sortear?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/sortear`;
        const res = await fetch(url, { method: 'POST' });
        if (res.ok) {
            alert('🎲 Sorteio de times realizado com sucesso!');
            await loadSessionDetails(activeSessionId, activeSessionDate);
        } else {
            const err = await res.json();
            alert(`Erro: ${err.detail || 'Falha ao realizar o sorteio'}`);
        }
    } catch (e) {
        console.error('Erro ao sortear times:', e);
        alert('Erro de conexão ao tentar realizar o sorteio.');
    }
}

// ==========================================
// Search & Chip Filters Setup
// ==========================================

function setupSearchAndFilters() {
    if (playerSearchInput) {
        playerSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            if (clearSearchBtn) {
                if (searchQuery) {
                    clearSearchBtn.classList.remove('hidden');
                } else {
                    clearSearchBtn.classList.add('hidden');
                }
            }
            renderAllTables(currentPlayers);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchQuery = '';
            if (playerSearchInput) playerSearchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            renderAllTables(currentPlayers);
        });
    }

    const chipFilters = document.querySelectorAll('.chip-filter');
    chipFilters.forEach(chip => {
        chip.addEventListener('click', () => {
            chipFilters.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            paymentFilter = chip.getAttribute('data-filter') || 'all';
            renderPaymentTable(currentPlayers);
        });
    });
}

function handleCopyPaidList() {
    if (!currentPlayers || currentPlayers.length === 0) {
        showToast('Nenhum jogador na lista para copiar.');
        return;
    }

    const youthEmoji = (currentBalanceConfig && currentBalanceConfig.emoji) || '🧒';
    const sortAlpha = (arr) => arr.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

    const relevant = currentPlayers;
    const paid = sortAlpha(relevant.filter(p => p.is_paying));
    const pending = sortAlpha(relevant.filter(p => !p.is_paying));
    const percent = relevant.length > 0 ? Math.round((paid.length / relevant.length) * 100) : 0;

    const dateStr = activeSessionDate ? new Date(activeSessionDate).toLocaleDateString('pt-BR') : 'Hoje';
    const checkinUrl = activeSessionCheckinCode ? `${window.location.origin}/#/checkin/${activeSessionCheckinCode}` : `${window.location.origin}`;

    let text = `⚽ *Pelada ${dateStr} - Lista de Pagamentos*\n`;
    text += `💰 *Status:* ${paid.length}/${relevant.length} pagos (${percent}%)\n\n`;

    if (paid.length > 0) {
        text += `💳 *PAGOS (${paid.length}):*\n`;
        paid.forEach((p, idx) => {
            const gkTag = p.is_goalkeeper ? ' 🧤' : '';
            const youthTag = p.is_special_category ? ` ${youthEmoji}` : '';
            text += `${idx + 1}. ✅ ${p.name}${gkTag}${youthTag}\n`;
        });
        text += `\n`;
    }

    if (pending.length > 0) {
        text += `❌ *PENDENTES (${pending.length}):*\n`;
        pending.forEach((p, idx) => {
            const gkTag = p.is_goalkeeper ? ' 🧤' : '';
            const youthTag = p.is_special_category ? ` ${youthEmoji}` : '';
            text += `${idx + 1}. ❌ ${p.name}${gkTag}${youthTag}\n`;
        });
        text += `\n`;
    }

    text += `📍 *Fazer Check-in:* ${checkinUrl}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Lista de pagantes copiada!');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            promptFallbackCopy(text);
        });
    } else {
        promptFallbackCopy(text);
    }
}

function handleCopyPresenceList() {
    if (!currentPlayers || currentPlayers.length === 0) {
        showToast('Nenhum jogador na lista para copiar.');
        return;
    }

    const youthEmoji = (currentBalanceConfig && currentBalanceConfig.emoji) || '🧒';
    const sortAlpha = (arr) => arr.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

    // 1. Goleiros confirmados
    const confirmedGks = sortAlpha(currentPlayers.filter(p => (p.is_confirmed || p.has_arrived) && p.is_goalkeeper));

    // 2. Linha confirmada (Pagos)
    const confirmedPaid = sortAlpha(currentPlayers.filter(p => (p.is_confirmed || p.has_arrived) && !p.is_goalkeeper && p.is_paying));

    // 3. Linha confirmada (Pendente)
    const confirmedPending = sortAlpha(currentPlayers.filter(p => (p.is_confirmed || p.has_arrived) && !p.is_goalkeeper && !p.is_paying));

    // 4. Pagos que não irão
    const absentPaid = sortAlpha(currentPlayers.filter(p => (!p.is_confirmed && !p.has_arrived) && p.is_paying));

    const dateStr = activeSessionDate ? new Date(activeSessionDate).toLocaleDateString('pt-BR') : 'Hoje';
    const checkinUrl = activeSessionCheckinCode ? `${window.location.origin}/#/checkin/${activeSessionCheckinCode}` : `${window.location.origin}`;

    let text = `⚽ *Lista de Presença - Pelada ${dateStr}*\n\n`;

    // Seção separada de Goleiros
    if (confirmedGks.length > 0) {
        text += `🧤 *Goleiros* (${confirmedGks.length})\n`;
        confirmedGks.forEach((p, idx) => {
            const youthTag = p.is_special_category ? ` ${youthEmoji}` : '';
            const payTag = p.is_paying ? ' (Pago)' : ' (Pendente)';
            text += `${idx + 1} - ${p.name}${youthTag}${payTag}\n`;
        });
        text += `\n`;
    }

    // Presença confirmada (Linha - Pagos)
    if (confirmedPaid.length > 0) {
        text += `🟢 *Presença confirmada (Linha - Pagos)* (${confirmedPaid.length})\n`;
        confirmedPaid.forEach((p, idx) => {
            const youthTag = p.is_special_category ? ` ${youthEmoji}` : '';
            text += `${idx + 1} - ${p.name}${youthTag}\n`;
        });
        text += `\n`;
    }

    // Presença confirmada (Linha - Pendente)
    if (confirmedPending.length > 0) {
        text += `⏳ *Presença confirmada (Linha - Pendente)* (${confirmedPending.length})\n`;
        confirmedPending.forEach((p, idx) => {
            const youthTag = p.is_special_category ? ` ${youthEmoji}` : '';
            text += `${idx + 1} - ${p.name}${youthTag}\n`;
        });
        text += `\n`;
    }

    // Pagos que não irão
    if (absentPaid.length > 0) {
        text += `🏖️ *Pagos que não irão* (${absentPaid.length})\n`;
        absentPaid.forEach((p, idx) => {
            const gkTag = p.is_goalkeeper ? ' 🧤' : '';
            const youthTag = p.is_special_category ? ` ${youthEmoji}` : '';
            text += `${idx + 1} - ${p.name}${gkTag}${youthTag}\n`;
        });
        text += `\n`;
    }

    text += `📍 *Fazer Check-in:* ${checkinUrl}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Lista de presença copiada!');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            promptFallbackCopy(text, '📋 Lista de presença copiada!');
        });
    } else {
        promptFallbackCopy(text, '📋 Lista de presença copiada!');
    }
}

function promptFallbackCopy(text, msg = '📋 Lista copiada!') {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(msg);
}

function handleOpenQrModal() {
    let code = activeSessionCheckinCode;
    if (!code && activeSessionId) {
        const sess = currentSessions.find(s => s.id === activeSessionId);
        if (sess) code = sess.checkin_code || sess.public_hash;
    }
    if (!code && currentPublicHash) {
        code = currentPublicHash;
    }

    if (!code) {
        alert('Código de check-in não encontrado para esta pelada.');
        return;
    }

    const checkinUrl = `${window.location.origin}/#/checkin/${code}`;
    if (qrCodeUrlText) qrCodeUrlText.textContent = checkinUrl;

    const qrTarget = document.getElementById('qr-code-target');
    if (qrTarget) {
        renderQRCode(checkinUrl, qrTarget);
    }

    openModal(qrCodeModal);
}

// ==========================================
// Check-in View Implementation
// ==========================================

function setupCheckinListeners() {
    if (checkinNameInput) {
        checkinNameInput.addEventListener('input', handleCheckinInput);
        checkinNameInput.addEventListener('focus', handleCheckinInput);
        checkinNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCheckinSubmit();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#checkin-form-container') && checkinSuggestions) {
            checkinSuggestions.classList.add('hidden');
        }
    });

    if (btnSubmitCheckin) {
        btnSubmitCheckin.addEventListener('click', handleCheckinSubmit);
    }

    if (btnGotoMatch) {
        btnGotoMatch.addEventListener('click', () => {
            if (checkinSessionData && checkinSessionData.public_hash) {
                window.location.hash = `#/match/${checkinSessionData.public_hash}`;
            }
        });
    }

    if (btnCheckinAnother) {
        btnCheckinAnother.addEventListener('click', () => {
            if (checkinFormContainer) checkinFormContainer.classList.remove('hidden');
            if (checkinSuccessContainer) checkinSuccessContainer.classList.add('hidden');
            if (checkinNameInput) {
                checkinNameInput.value = '';
                checkinNameInput.focus();
            }
            checkinSelectedPlayer = null;
            if (checkinCurrentCode) loadCheckinView(checkinCurrentCode);
        });
    }
}

async function loadCheckinView(checkinCode) {
    checkinCurrentCode = checkinCode;
    showView('checkin');

    if (checkinFormContainer) checkinFormContainer.classList.remove('hidden');
    if (checkinSuccessContainer) checkinSuccessContainer.classList.add('hidden');
    if (checkinSuggestions) checkinSuggestions.classList.add('hidden');
    if (checkinNameInput) checkinNameInput.value = '';
    checkinSelectedPlayer = null;

    try {
        const response = await fetch(`${API_BASE}/checkin/${checkinCode}`);
        if (!response.ok) {
            throw new Error('Pelada não encontrada');
        }

        checkinSessionData = await response.json();
        renderCheckinViewData(checkinSessionData);
    } catch (err) {
        console.error('Erro ao carregar dados de check-in:', err);
        if (checkinPeladaTitle) checkinPeladaTitle.textContent = 'Pelada Não Encontrada';
        if (checkinPeladaSubtitle) checkinPeladaSubtitle.textContent = 'Verifique o link ou QR Code escaneado.';
    }
}

function renderCheckinViewData(data) {
    const date = data.created_at ? new Date(data.created_at) : new Date();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(date);

    if (checkinPeladaTitle) {
        checkinPeladaTitle.textContent = `Pelada #${data.session_id}`;
    }
    if (checkinPeladaSubtitle) {
        checkinPeladaSubtitle.textContent = `${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} • Auto Check-in`;
    }

    if (checkinSessionStatusBadge) {
        if (data.is_active) {
            checkinSessionStatusBadge.className = 'badge active';
            checkinSessionStatusBadge.textContent = '⚽ Pelada em andamento';
        } else {
            checkinSessionStatusBadge.className = 'badge inactive';
            checkinSessionStatusBadge.textContent = '🛑 Pelada finalizada';
        }
    }

    // Render quick selection name chips
    if (checkinQuickNames) {
        checkinQuickNames.innerHTML = '';
        const players = data.players || [];
        const confirmedList = players.filter(p => p.is_confirmed || !p.has_arrived);

        if (confirmedList.length === 0) {
            const quickSelectSec = document.getElementById('checkin-quick-select-section');
            if (quickSelectSec) quickSelectSec.classList.add('hidden');
        } else {
            const quickSelectSec = document.getElementById('checkin-quick-select-section');
            if (quickSelectSec) quickSelectSec.classList.remove('hidden');

            confirmedList.forEach(p => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = `quick-name-chip ${p.has_arrived ? 'arrived' : ''}`;
                chip.innerHTML = `${p.has_arrived ? '✅' : '⚪'} ${p.name} ${p.is_paying ? '<span style="font-size:0.75rem;">💳</span>' : ''}`;

                if (!p.has_arrived) {
                    chip.addEventListener('click', () => {
                        document.querySelectorAll('.quick-name-chip').forEach(c => c.classList.remove('selected'));
                        chip.classList.add('selected');
                        checkinSelectedPlayer = p;
                        if (checkinNameInput) {
                            checkinNameInput.value = p.name;
                            if (checkinSuggestions) checkinSuggestions.classList.add('hidden');
                        }
                    });
                }
                checkinQuickNames.appendChild(chip);
            });
        }
    }
}

function handleCheckinInput(e) {
    const val = (e.target.value || '').trim().toLowerCase();
    if (!checkinSuggestions || !checkinSessionData) return;

    const players = checkinSessionData.players || [];
    if (!val) {
        checkinSuggestions.classList.add('hidden');
        return;
    }

    const matches = players.filter(p => p.name.toLowerCase().includes(val));
    if (matches.length === 0) {
        checkinSuggestions.innerHTML = `<div style="padding: 0.75rem 1rem; color: #ef4444; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">⚠️ Jogador não cadastrado na pelada.</div>`;
        checkinSuggestions.classList.remove('hidden');
        return;
    }

    checkinSuggestions.innerHTML = '';
    matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <span class="suggestion-name">${p.name}</span>
            <span style="font-size: 0.8rem; font-weight: 600; color: ${p.has_arrived ? '#10b981' : (p.is_paying ? '#34d399' : '#f87171')};">
                ${p.has_arrived ? '✅ Na Quadra' : (p.is_paying ? '💳 Pago (Liberado)' : '❌ Pagamento Pendente')}
            </span>
        `;
        item.addEventListener('click', () => {
            checkinNameInput.value = p.name;
            checkinSelectedPlayer = p;
            checkinSuggestions.classList.add('hidden');
        });
        checkinSuggestions.appendChild(item);
    });

    checkinSuggestions.classList.remove('hidden');
}

async function handleCheckinSubmit() {
    const name = (checkinNameInput ? checkinNameInput.value : '').trim();
    if (!name) {
        alert('Por favor, digite seu nome ou selecione na lista.');
        if (checkinNameInput) checkinNameInput.focus();
        return;
    }

    if (!checkinCurrentCode) return;

    const players = checkinSessionData ? (checkinSessionData.players || []) : [];
    let playerObj = checkinSelectedPlayer;
    if (!playerObj) {
        playerObj = players.find(p => p.name.toLowerCase() === name.toLowerCase());
    }

    if (!playerObj) {
        alert(`⚠️ O jogador "${name}" não foi encontrado na lista desta pelada.\n\nO auto check-in só é permitido para jogadores pré-cadastrados. Solicite ao administrador para incluir seu nome na lista.`);
        return;
    }

    if (!playerObj.is_paying) {
        alert(`⚠️ Olá, ${playerObj.name}!\n\nSeu pagamento consta como PENDENTE. O auto check-in só é liberado para jogadores com pagamento confirmado.\n\nEfetue o pagamento ou solicite a liberação com o administrador da pelada.`);
        return;
    }

    if (btnSubmitCheckin) {
        btnSubmitCheckin.disabled = true;
        btnSubmitCheckin.textContent = '⏳ Registrando chegada...';
    }

    try {
        const payload = { name: playerObj.name, player_id: playerObj.id };

        const res = await fetch(`${API_BASE}/checkin/${checkinCurrentCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            alert(`Aviso: ${err.detail || 'Falha ao registrar check-in'}`);
            return;
        }

        const result = await res.json();
        renderCheckinSuccess(result);
    } catch (err) {
        console.error('Erro no checkin:', err);
        alert('Erro de conexão ao realizar check-in.');
    } finally {
        if (btnSubmitCheckin) {
            btnSubmitCheckin.disabled = false;
            btnSubmitCheckin.textContent = '📍 Confirmar Chegada (Cheguei!)';
        }
    }
}

function renderCheckinSuccess(result) {
    if (checkinFormContainer) checkinFormContainer.classList.add('hidden');
    if (checkinSuccessContainer) checkinSuccessContainer.classList.remove('hidden');

    const player = result.player || {};
    if (checkinSuccessPlayerName) checkinSuccessPlayerName.textContent = `${player.name}`;
    if (checkinSuccessMsg) checkinSuccessMsg.textContent = result.message || 'Chegada registrada na quadra!';

    if (checkinOrderBadge) {
        checkinOrderBadge.textContent = player.arrival_order ? `#${player.arrival_order}` : 'Confirmado';
    }

    if (checkinQueueBadge) {
        if (player.is_playing) {
            checkinQueueBadge.textContent = '⚽ Em Quadra';
            checkinQueueBadge.style.color = '#10b981';
        } else if (player.is_next_team) {
            checkinQueueBadge.textContent = '🔥 Próximo Time';
            checkinQueueBadge.style.color = '#f59e0b';
        } else if (player.queue_position) {
            checkinQueueBadge.textContent = `Fila #${player.queue_position}`;
            checkinQueueBadge.style.color = '#38bdf8';
        } else {
            checkinQueueBadge.textContent = 'Aguardando';
            checkinQueueBadge.style.color = '#94a3b8';
        }
    }

    if (checkinPayBadge) {
        if (player.is_paying) {
            checkinPayBadge.textContent = '💳 Pago';
            checkinPayBadge.style.color = '#10b981';
        } else {
            checkinPayBadge.textContent = '❌ Pendente';
            checkinPayBadge.style.color = '#ef4444';
        }
    }

    showToast(`📍 Check-in confirmado para ${player.name}!`);
}

// ==========================================
// Standard Compliant QR Code Generator
// ==========================================

function renderQRCode(text, containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        new QRCode(containerEl, {
            text: text,
            width: 220,
            height: 220,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        containerEl.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem;">Carregando biblioteca de QR Code...</p>`;
    }
}

// ==========================================
// WhatsApp List Import
// ==========================================

function setupImportWhatsappListeners() {
    const btnImportWpp = document.getElementById('btn-import-wpp');
    const importWppModal = document.getElementById('import-wpp-modal');
    const closeImportWppBtn = document.getElementById('close-import-wpp-modal-btn');
    const cancelImportWppBtn = document.getElementById('btn-cancel-import-wpp');
    const importWppText = document.getElementById('import-wpp-text');
    const submitImportWppBtn = document.getElementById('btn-submit-import-wpp');

    if (btnImportWpp) {
        btnImportWpp.addEventListener('click', () => {
            if (importWppText) {
                importWppText.value = '';
            }
            updateImportWppPreview('');
            openModal(importWppModal);
            if (importWppText) importWppText.focus();
        });
    }

    if (closeImportWppBtn) {
        closeImportWppBtn.addEventListener('click', () => closeModal(importWppModal));
    }
    if (cancelImportWppBtn) {
        cancelImportWppBtn.addEventListener('click', () => closeModal(importWppModal));
    }

    if (importWppText) {
        importWppText.addEventListener('input', (e) => {
            updateImportWppPreview(e.target.value);
        });
    }

    if (submitImportWppBtn) {
        submitImportWppBtn.addEventListener('click', handleSubmitImportWpp);
    }
}

function parseWhatsappTextJS(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split('\n');
    const names = [];
    const ignoreKeywords = [
        "ranca", "pelada", "futebol", "coletes", "cores", "convidado",
        "jogadores", "horário", "horario", "local", "quadra", "regras", "pix"
    ];

    lines.forEach(line => {
        const lineClean = line.trim();
        if (!lineClean) return;

        let match = lineClean.match(/^\s*([0-9]{1,3})\s*[\-\.\)\:\–\—]\s*(.+)$/);
        if (!match) {
            match = lineClean.match(/^\s*([0-9]{1,3})\s+([A-Za-zÀ-ÖØ-öø-ÿ].+)$/);
        }

        if (match) {
            let candidate = match[2].trim();
            candidate = candidate.replace(/[^\w\s\.\-À-ÖØ-öø-ÿ]/g, '').trim();
            candidate = candidate.replace(/\b(goleiro|gol|gk|pago|pendente|convidado|mensalista|confirmado)\b/gi, '').trim();
            candidate = candidate.replace(/[\(\)\[\]\-]+$/g, '').trim();

            if (candidate && candidate.length >= 2) {
                const lower = candidate.toLowerCase();
                if (!ignoreKeywords.some(kw => lower.startsWith(kw))) {
                    names.push(candidate);
                }
            }
        }
    });

    return names;
}

function updateImportWppPreview(text) {
    const previewSection = document.getElementById('import-wpp-preview-section');
    const countBadge = document.getElementById('import-wpp-count-badge');
    const namesContainer = document.getElementById('import-wpp-names-container');
    const submitBtn = document.getElementById('btn-submit-import-wpp');

    const names = parseWhatsappTextJS(text);

    if (names.length > 0) {
        if (previewSection) previewSection.classList.remove('hidden');
        if (countBadge) countBadge.textContent = `${names.length} jogador(es)`;
        if (namesContainer) {
            namesContainer.innerHTML = names.map(n => `<span class="badge secondary" style="font-size: 0.8rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.25rem 0.5rem; border-radius: 6px;">👤 ${n}</span>`).join('');
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Confirmar Importação (${names.length} jogadores)`;
        }
    } else {
        if (previewSection) previewSection.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Confirmar Importação';
        }
    }
}

async function handleSubmitImportWpp() {
    const importWppText = document.getElementById('import-wpp-text');
    const importWppModal = document.getElementById('import-wpp-modal');
    const checkArrived = document.getElementById('import-wpp-check-arrived');
    const checkPaid = document.getElementById('import-wpp-check-paid');
    const submitBtn = document.getElementById('btn-submit-import-wpp');

    const text = importWppText ? importWppText.value.trim() : '';
    if (!text) return;

    const markArrived = checkArrived ? checkArrived.checked : false;
    const markPaid = checkPaid ? checkPaid.checked : false;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Importando...';
    }

    try {
        if (activeSessionId) {
            const adminKey = getAdminKey();
            const url = adminKey ? `${API_BASE}/sessions/${activeSessionId}/import-whatsapp?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${activeSessionId}/import-whatsapp`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    mark_arrived: markArrived,
                    mark_paid: markPaid
                })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao importar lista'}`);
                return;
            }

            const data = await res.json();
            closeModal(importWppModal);
            showToast(`📋 ${data.imported_count} jogador(es) importados do WhatsApp!`);
            await loadSessionDetails(activeSessionId, activeSessionDate);
        } else if (currentPublicHash) {
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/import-whatsapp`;
            if (currentAdminToken) url += `?token=${encodeURIComponent(currentAdminToken)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    mark_arrived: markArrived,
                    mark_paid: markPaid
                })
            });

            if (res.ok) {
                closeModal(importWppModal);
                showToast(`📋 Jogadores importados com sucesso!`);
                await fetchMatchData(currentPublicHash, currentAdminToken);
            }
        }
    } catch (err) {
        console.error('Erro ao importar lista WhatsApp:', err);
        alert('Erro de conexão ao importar lista do WhatsApp.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}


