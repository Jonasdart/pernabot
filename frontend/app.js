const API_BASE = window.location.origin;

// DOM Elements
const views = {
    auth: document.getElementById('auth-view'),
    dashboard: document.getElementById('dashboard-view'),
    roster: document.getElementById('roster-view'),
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
let currentGroupActiveSession = null;
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

let toastTimeout = null;
let toastHideTimeout = null;

function showToast(message, duration = 3500) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
    if (toastHideTimeout) {
        clearTimeout(toastHideTimeout);
        toastHideTimeout = null;
    }

    toast.className = 'toast';
    const lower = message.toLowerCase();
    if (message.includes('⚠️') || lower.includes('atenção') || lower.includes('aviso')) {
        toast.classList.add('toast-warning');
    } else if (message.includes('❌') || lower.includes('erro') || lower.includes('falha')) {
        toast.classList.add('toast-error');
    } else if (message.includes('✅') || message.includes('📥') || message.includes('⭐') || lower.includes('sucesso')) {
        toast.classList.add('toast-success');
    }

    toast.textContent = message;
    toast.classList.remove('hidden');

    toast.onclick = () => {
        toast.classList.remove('show');
        toastHideTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 280);
    };

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastHideTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 280);
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSorting();
    setupMatchViewListeners();
    setupSearchAndFilters();
    setupCheckinListeners();
    setupImportWhatsappListeners();

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.hash = '';
            showView('sessions');
        });
    }

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
        return;
    }

    // All management views require ADMIN_KEY
    const adminKey = getAdminKey();
    if (!adminKey) {
        showView('auth');
        setupGlobalAuthForm();
        return;
    }

    if (hash === '#/roster') {
        showView('roster');
        loadRosterData();
    } else if (hash === '#/sessions') {
        showView('sessions');
        loadSessions();
    } else if (hash === '#/players' || hash === '#/matchday') {
        navigateToMatchday();
    } else {
        showView('dashboard');
        loadDashboardData();
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
    Object.values(views).forEach(view => {
        if (view) view.classList.remove('active');
    });
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }

    const mainNavbar = document.getElementById('main-navbar');
    if (viewName === 'match' || viewName === 'checkin' || viewName === 'auth') {
        if (mainNavbar) mainNavbar.classList.add('hidden');
    } else {
        if (mainNavbar && getAdminKey()) mainNavbar.classList.remove('hidden');
    }

    // Update navbar active link
    document.querySelectorAll('.main-navbar .nav-link').forEach(link => {
        const target = link.getAttribute('data-nav');
        if (target === `${viewName}-view` || target === viewName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function getAdminKey() {
    return localStorage.getItem('pelada_admin_key') || '';
}

function handleAdminUnauthorized(msg = 'Sessão expirada ou credencial inválida.') {
    localStorage.removeItem('pelada_admin_key');
    const mainNavbar = document.getElementById('main-navbar');
    if (mainNavbar) mainNavbar.classList.add('hidden');
    showView('auth');
    const errEl = document.getElementById('global-auth-error');
    if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
    }
    const inputEl = document.getElementById('global-admin-key-input');
    if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
    }
    setupGlobalAuthForm();
}

function setupGlobalAuthForm() {
    const form = document.getElementById('global-auth-form');
    const input = document.getElementById('global-admin-key-input');
    const submitBtn = document.getElementById('global-auth-submit-btn');
    const errEl = document.getElementById('global-auth-error');

    if (!form || form.dataset.listenerAttached) return;
    form.dataset.listenerAttached = 'true';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = input ? input.value.trim() : '';
        if (!val) return;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Validando...';
        }
        if (errEl) errEl.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE}/groups/default?key=${encodeURIComponent(val)}`);
            if (res.status === 401) {
                if (errEl) {
                    errEl.textContent = 'Senha incorreta. Tente novamente.';
                    errEl.classList.remove('hidden');
                }
                if (input) {
                    input.value = '';
                    input.focus();
                }
                return;
            }
            if (!res.ok) throw new Error('Erro ao conectar ao servidor');

            // Success!
            localStorage.setItem('pelada_admin_key', val);
            const mainNav = document.getElementById('main-navbar');
            if (mainNav) mainNav.classList.remove('hidden');
            showToast('✅ Acesso autorizado!');
            handleRoute();
        } catch (err) {
            console.error('Erro na autenticação:', err);
            if (errEl) {
                errEl.textContent = 'Erro ao validar senha. Verifique sua conexão.';
                errEl.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '🔓 Entrar no Painel';
            }
        }
    });
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
    if (!sessionId) return;
    activeSessionId = sessionId;

    let dateObj = null;
    if (date instanceof Date && !isNaN(date.getTime())) {
        dateObj = date;
    } else if (typeof date === 'string' && date) {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
    }

    if (!dateObj && currentGroupActiveSession && currentGroupActiveSession.id === sessionId && currentGroupActiveSession.created_at) {
        const parsed = new Date(currentGroupActiveSession.created_at);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
    }

    if (!dateObj && Array.isArray(currentSessions)) {
        const sess = currentSessions.find(s => s.id === sessionId);
        if (sess) {
            activeSessionCheckinCode = sess.checkin_code || sess.public_hash;
            if (sess.created_at) {
                const parsed = new Date(sess.created_at);
                if (!isNaN(parsed.getTime())) dateObj = parsed;
            }
        }
    }

    if (!dateObj) {
        dateObj = new Date();
    }
    activeSessionDate = dateObj;

    if (currentGroupActiveSession && currentGroupActiveSession.id === sessionId) {
        activeSessionCheckinCode = currentGroupActiveSession.checkin_code || currentGroupActiveSession.public_hash;
    }

    showView('players');

    const loadingHtml = `<tr><td colspan="7" style="text-align:center;"><div class="loader"></div></td></tr>`;
    if (playersList) playersList.innerHTML = loadingHtml;
    if (presenceList) presenceList.innerHTML = loadingHtml;
    if (paymentList) paymentList.innerHTML = loadingHtml;

    if (sessionTitle) {
        sessionTitle.textContent = `Pelada - ${dateObj.toLocaleDateString('pt-BR')}`;
    }

    try {
        const adminKey = getAdminKey();
        const url = adminKey ? `${API_BASE}/sessions/${sessionId}/players?key=${encodeURIComponent(adminKey)}` : `${API_BASE}/sessions/${sessionId}/players`;
        const response = await fetch(url);

        if (response.status === 401) {
            renderSessionAuthForm(sessionId, dateObj);
            return;
        }

        if (!response.ok) throw new Error(`Falha ao carregar jogadores: ${response.status}`);

        currentPlayers = await response.json();
        renderAllTables(currentPlayers);
    } catch (error) {
        const errorHtml = `<tr><td colspan="7" style="color: #ef4444; text-align: center;">Erro ao carregar jogadores da sessão.</td></tr>`;
        if (playersList) playersList.innerHTML = errorHtml;
        if (presenceList) presenceList.innerHTML = errorHtml;
        if (paymentList) paymentList.innerHTML = errorHtml;
        console.error('Erro em loadSessionDetails:', error);
    }
}

function renderSessionAuthForm(sessionId, date) {
    const authHtml = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2.5rem 1rem;">
                <div style="max-width: 360px; margin: 0 auto; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; padding: 1.8rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <div style="font-size: 2.4rem; margin-bottom: 0.5rem;">🔒</div>
                    <h3 style="color: #ffffff; margin-bottom: 0.4rem; font-size: 1.2rem;">Acesso de Administrador</h3>
                    <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 1.2rem; line-height: 1.4;">Digite a credencial de administrador para acessar os dados deste Dia de Jogo.</p>
                    <form id="session-auth-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <input type="password" id="session-admin-key-input" placeholder="Credencial / Senha" required style="padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.4); color: #fff; text-align: center; outline: none; font-size: 0.95rem;">
                        <button type="submit" class="btn primary sm" style="padding: 0.75rem; font-weight: 600;">🔓 Entrar</button>
                    </form>
                </div>
            </td>
        </tr>
    `;
    if (playersList) playersList.innerHTML = authHtml;
    if (presenceList) presenceList.innerHTML = authHtml;
    if (paymentList) paymentList.innerHTML = authHtml;

    const form = document.getElementById('session-auth-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = document.getElementById('session-admin-key-input').value.trim();
            if (val) {
                localStorage.setItem('pelada_admin_key', val);
                await loadSessionDetails(sessionId, date);
            }
        });
    }
}

async function navigateToMatchday() {
    showView('players');
    if (!currentGroup || !currentGroupActiveSession) {
        await loadDashboardData();
    }

    const activeSession = currentGroupActiveSession;
    if (activeSession) {
        activeSessionId = activeSession.id;
        activeSessionCheckinCode = activeSession.checkin_code || activeSession.public_hash;
        const date = activeSession.created_at ? new Date(activeSession.created_at) : new Date();
        await loadSessionDetails(activeSession.id, date);
    } else if (activeSessionId) {
        await loadSessionDetails(activeSessionId, activeSessionDate || new Date());
    } else {
        if (sessionTitle) sessionTitle.textContent = '⚽ Dia de Jogo';
        const emptyHtml = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <p style="font-size: 1.15rem; color: #f1f5f9; margin-bottom: 0.5rem; font-weight: 600;">Nenhum Dia de Jogo em andamento</p>
                    <p style="font-size: 0.85rem; margin-bottom: 1.5rem;">Inicie um novo dia de jogo para abrir a lista de presença e começar as partidas.</p>
                    <button class="btn primary" onclick="handleOpenNewMatchday()">🚀 Iniciar Novo Dia de Jogo</button>
                </td>
            </tr>
        `;
        if (playersList) playersList.innerHTML = emptyHtml;
        if (presenceList) presenceList.innerHTML = emptyHtml;
        if (paymentList) paymentList.innerHTML = emptyHtml;
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
            const adminKey = getAdminKey();
            let url = `${API_BASE}/sessions/hash/${currentPublicHash}/liberar`;
            const params = [];
            if (currentAdminToken) params.push(`token=${encodeURIComponent(currentAdminToken)}`);
            if (adminKey) params.push(`key=${encodeURIComponent(adminKey)}`);
            if (params.length > 0) url += `?${params.join('&')}`;
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
        if (!getAdminKey()) {
            showToast('⚠️ Pagamento pendente! O check-in requer confirmação de pagamento pelo organizador da pelada.');
            return;
        }
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

let importWppCurrentMode = 'match'; // 'match' ou 'roster'

function handleOpenImportWppModal(mode = 'match') {
    importWppCurrentMode = mode;
    const importWppModal = document.getElementById('import-wpp-modal');
    const importWppText = document.getElementById('import-wpp-text');
    const titleEl = document.getElementById('import-wpp-modal-title');
    const descEl = document.getElementById('import-wpp-modal-desc');
    const matchOpts = document.getElementById('import-wpp-match-options');
    const rosterOpts = document.getElementById('import-wpp-roster-options');

    if (mode === 'roster') {
        if (titleEl) titleEl.textContent = '📥 Importar Membros para o Elenco';
        if (descEl) descEl.textContent = 'Cole a lista do WhatsApp para cadastrar os jogadores diretamente no elenco da pelada:';
        if (matchOpts) matchOpts.classList.add('hidden');
        if (rosterOpts) rosterOpts.classList.remove('hidden');
    } else {
        if (titleEl) titleEl.textContent = '📥 Importar Lista de Presença do WhatsApp';
        if (descEl) descEl.textContent = 'Cole a mensagem copiada do WhatsApp com a lista numerada de jogadores para o dia de jogo:';
        if (matchOpts) matchOpts.classList.remove('hidden');
        if (rosterOpts) rosterOpts.classList.add('hidden');
    }

    if (importWppText) {
        importWppText.value = '';
    }
    updateImportWppPreview('');
    openModal(importWppModal);
    if (importWppText) importWppText.focus();
}

function setupImportWhatsappListeners() {
    const btnImportWpp = document.getElementById('btn-import-wpp');
    const importWppModal = document.getElementById('import-wpp-modal');
    const closeImportWppBtn = document.getElementById('close-import-wpp-modal-btn');
    const cancelImportWppBtn = document.getElementById('btn-cancel-import-wpp');
    const importWppText = document.getElementById('import-wpp-text');
    const submitImportWppBtn = document.getElementById('btn-submit-import-wpp');

    if (btnImportWpp) {
        btnImportWpp.addEventListener('click', () => handleOpenImportWppModal('match'));
    }

    const btnImportRosterWpp = document.getElementById('btn-import-roster-wpp');
    if (btnImportRosterWpp) {
        btnImportRosterWpp.addEventListener('click', () => handleOpenImportWppModal('roster'));
    }

    const btnDashImportWpp = document.getElementById('btn-dash-import-wpp');
    if (btnDashImportWpp) {
        btnDashImportWpp.addEventListener('click', () => handleOpenImportWppModal('roster'));
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
    const names = parseWhatsappTextJS(text);
    const countBadge = document.getElementById('import-wpp-count-badge');
    const namesContainer = document.getElementById('import-wpp-names-container');
    const previewSection = document.getElementById('import-wpp-preview-section');
    const submitBtn = document.getElementById('btn-submit-import-wpp');

    if (countBadge) countBadge.textContent = names.length;

    if (names.length > 0) {
        if (previewSection) previewSection.classList.remove('hidden');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Confirmar Importação (${names.length})`;
        }

        if (namesContainer) {
            namesContainer.innerHTML = '';
            names.forEach((name, idx) => {
                const tag = document.createElement('span');
                tag.style.cssText = 'background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #e0f2fe; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 500;';
                tag.textContent = `${idx + 1}. ${name}`;
                namesContainer.appendChild(tag);
            });
        }
    } else {
        if (previewSection) previewSection.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Confirmar Importação';
        }
        if (namesContainer) namesContainer.innerHTML = '';
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

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Importando...';
    }

    try {
        if (importWppCurrentMode === 'roster') {
            if (!currentGroup) await loadDashboardData();
            const memberTypeSelect = document.getElementById('import-wpp-member-type-select');
            const memberType = memberTypeSelect ? memberTypeSelect.value : 'mensalista';

            const adminKey = getAdminKey();
            const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/import-whatsapp?key=${encodeURIComponent(adminKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    member_type: memberType
                })
            });

            if (res.status === 401) {
                handleAdminUnauthorized();
                return;
            }

            if (!res.ok) {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Falha ao importar membros'}`);
                return;
            }

            const data = await res.json();
            closeModal(importWppModal);
            showToast(`📥 ${data.imported_count} membro(s) cadastrados no elenco!`);
            await loadRosterData();
            await loadDashboardData();
            return;
        }

        const markArrived = checkArrived ? checkArrived.checked : false;
        const markPaid = checkPaid ? checkPaid.checked : false;

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

// ==========================================================================
// MÓDULO DE GESTÃO DA PELADA: GRUPO, ELENCO & MENSALIDADES
// ==========================================================================

let currentGroup = null;
let currentRosterMembers = [];
const today = new Date();
let ledgerCurrentYear = today.getFullYear();
let ledgerCurrentMonth = today.getMonth() + 1;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function formatFrequencyText(type, configStr) {
    if (!type || type === 'weekly') {
        try {
            const parsed = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
            const days = parsed.days || [1];
            const dayNames = days.map(d => WEEKDAY_NAMES[d] || `Dia ${d}`).join(', ');
            return `📅 Toda ${dayNames}`;
        } catch (e) {
            return '📅 Toda Terça-feira';
        }
    } else if (type === 'monthly') {
        try {
            const parsed = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
            const day = parsed.day_of_month || 15;
            return `📅 Todo dia ${day} do mês`;
        } catch (e) {
            return '📅 Mensal';
        }
    } else if (type === 'biweekly') {
        return '📅 Quinzenal';
    } else if (type === 'on_demand') {
        return '📅 Sob Demanda / Avulso';
    }
    return '📅 Regular';
}

async function loadDashboardData() {
    const adminKey = getAdminKey();
    if (!adminKey) {
        handleAdminUnauthorized();
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/groups/default?key=${encodeURIComponent(adminKey)}&year=${ledgerCurrentYear}&month=${ledgerCurrentMonth}`);
        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (!res.ok) throw new Error('Falha ao carregar dados da pelada');
        const data = await res.json();
        currentGroup = data.group;

        // Atualizar Navbar
        const navTitle = document.getElementById('nav-group-name');
        if (navTitle && currentGroup) navTitle.textContent = currentGroup.name;

        // Atualizar Hero do Dashboard
        const dashName = document.getElementById('dash-group-name');
        if (dashName && currentGroup) dashName.textContent = currentGroup.name;

        const dashFreq = document.getElementById('dash-freq-badge');
        if (dashFreq && currentGroup) {
            dashFreq.textContent = formatFrequencyText(currentGroup.frequency_type, currentGroup.frequency_config);
        }

        const dashFee = document.getElementById('dash-fee-badge');
        if (dashFee && currentGroup) {
            dashFee.textContent = `💰 R$ ${(currentGroup.monthly_fee || 0).toFixed(2).replace('.', ',')} / mês`;
        }

        const dashDue = document.getElementById('dash-due-badge');
        if (dashDue && currentGroup) {
            dashDue.textContent = `🗓️ Vence dia ${currentGroup.due_day || 10}`;
        }

        // Atualizar Métricas
        const monthName = MONTH_NAMES[data.month - 1];
        const monthNameEl = document.getElementById('dash-metric-month-name');
        if (monthNameEl) monthNameEl.textContent = monthName;

        const totalMemEl = document.getElementById('dash-metric-total-members');
        if (totalMemEl) totalMemEl.textContent = data.total_members || 0;

        const detailEl = document.getElementById('dash-metric-types-detail');
        if (detailEl) detailEl.textContent = `${data.total_mensalistas || 0} Mensalistas · ${data.total_avulsos || 0} Avulsos`;

        const ratioEl = document.getElementById('dash-metric-paid-ratio');
        if (ratioEl) ratioEl.textContent = `${data.paid_mensalistas_count || 0} / ${data.total_mensalistas || 0}`;

        const percentVal = data.total_mensalistas > 0 ? Math.round((data.paid_mensalistas_count / data.total_mensalistas) * 100) : 0;
        const percentEl = document.getElementById('dash-metric-paid-percent');
        if (percentEl) percentEl.textContent = `${percentVal}% adimplentes`;

        const collEl = document.getElementById('dash-metric-collected');
        if (collEl) collEl.textContent = `R$ ${(data.total_collected || 0).toFixed(2).replace('.', ',')}`;

        const expEl = document.getElementById('dash-metric-expected');
        if (expEl) expEl.textContent = `Previsto: R$ ${(data.expected_monthly || 0).toFixed(2).replace('.', ',')}`;

        const sessCountEl = document.getElementById('dash-metric-sessions-count');
        if (sessCountEl) sessCountEl.textContent = data.total_sessions_count || 0;

        // Status da Sessão Ativa
        currentGroupActiveSession = data.active_session || null;
        renderActiveMatchStatus(data.active_session);

    } catch (e) {
        console.error('Erro no loadDashboardData:', e);
    }
}

function renderActiveMatchStatus(activeSession) {
    const container = document.getElementById('dash-match-status-content');
    if (!container) return;

    if (activeSession) {
        activeSessionId = activeSession.id;
        currentGroupActiveSession = activeSession;
        const dateStr = activeSession.created_at ? new Date(activeSession.created_at).toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : 'Sessão aberta';

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: rgba(0,210,255,0.05); border: 1px solid rgba(0,210,255,0.2); border-radius: 12px; padding: 1rem 1.2rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                        <span class="badge active">🟢 Em Andamento</span>
                        <strong style="color: #ffffff; font-size: 1.05rem;">${dateStr}</strong>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">Código de check-in na quadra: <strong style="color: var(--primary);">${activeSession.checkin_code || activeSession.public_hash}</strong></p>
                </div>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                    <button class="btn primary sm" onclick="handleOpenActiveMatchLive('${activeSession.public_hash}', '${activeSession.admin_token}')">👁️ Quadra ao Vivo</button>
                    <button class="btn secondary sm" onclick="handleOpenActiveMatchPlayers(${activeSession.id})">📋 Lista de Presença</button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
                <p style="font-size: 1rem; margin-bottom: 0.8rem;">Nenhum Dia de Jogo ativo no momento.</p>
                <button class="btn primary sm" onclick="handleOpenNewMatchday()">🚀 Iniciar Novo Dia de Jogo</button>
            </div>
        `;
    }
}

function handleOpenActiveMatchLive(publicHash, adminToken) {
    if (publicHash) {
        window.location.hash = adminToken ? `#/match/${publicHash}?admin=${adminToken}` : `#/match/${publicHash}`;
    }
}

function handleOpenActiveMatchPlayers(sessionId) {
    activeSessionId = sessionId;
    const date = (currentGroupActiveSession && currentGroupActiveSession.created_at)
        ? new Date(currentGroupActiveSession.created_at)
        : new Date();
    window.location.hash = '#/matchday';
    loadSessionDetails(sessionId, date);
}

async function loadRosterData() {
    if (!currentGroup) {
        await loadDashboardData();
    }
    if (!currentGroup) return;

    try {
        const adminKey = getAdminKey();
        if (!adminKey) {
            handleAdminUnauthorized();
            return;
        }
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/members?key=${encodeURIComponent(adminKey)}&year=${ledgerCurrentYear}&month=${ledgerCurrentMonth}`);
        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (!res.ok) throw new Error('Falha ao carregar elenco');
        currentRosterMembers = await res.json();

        renderRosterMembers(currentRosterMembers);
        renderMonthlyPayments(currentRosterMembers);
        populatePeladaConfigForm(currentGroup);
    } catch (e) {
        console.error('Erro ao carregar elenco:', e);
    }
}

function renderRosterMembers(members) {
    const listEl = document.getElementById('roster-members-list');
    if (!listEl) return;

    const searchInput = document.getElementById('roster-search-input');
    const query = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
    const filtered = query ? members.filter(m => m.name.toLowerCase().includes(query)) : members;

    if (filtered.length === 0) {
        listEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum membro encontrado.</td></tr>`;
        return;
    }

    listEl.innerHTML = '';
    filtered.forEach((m, idx) => {
        const tr = document.createElement('tr');

        const isMensalista = m.member_type === 'mensalista';
        const typeBadge = `<span class="member-badge-type ${isMensalista ? 'mensalista' : 'avulso'}" style="cursor: pointer;" title="Clique para alternar Mensalista / Avulso" onclick="handleToggleMemberType(${m.id}, '${isMensalista ? 'avulso' : 'mensalista'}')">${isMensalista ? '⭐ Mensalista' : '🎟️ Avulso'}</span>`;

        const posBadge = m.is_goalkeeper ? `<span class="badge" style="background: rgba(34,197,94,0.15); color: #4ade80;">🧤 Goleiro</span>` : `<span style="color: var(--text-muted); font-size: 0.85rem;">Linha</span>`;

        const catBadge = m.category && m.category !== 'default' ? `<span class="badge" style="background: rgba(168,85,247,0.15); color: #c084fc;">${m.category}</span>` : `<span style="color: var(--text-muted); font-size: 0.85rem;">Padrão</span>`;

        let payBadge = '-';
        if (isMensalista) {
            const isPaid = m.payment_status === 'paid';
            payBadge = `<span class="payment-status-pill ${isPaid ? 'paid' : 'pending'}" onclick="handleTogglePayment(${m.id}, ${ledgerCurrentYear}, ${ledgerCurrentMonth}, '${m.payment_status}')" title="Clique para alternar">${isPaid ? '✅ Pago' : '⏳ Pendente'}</span>`;
        }

        tr.innerHTML = `
            <td style="color: var(--text-muted); font-size: 0.85rem;">${idx + 1}</td>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td>${typeBadge}</td>
            <td>${posBadge}</td>
            <td>${catBadge}</td>
            <td>${payBadge}</td>
            <td style="text-align: right;">
                <button class="btn secondary sm" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="handleOpenEditMemberModal(${m.id})">✏️ Editar</button>
                <button class="btn secondary sm danger-hover" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; margin-left: 0.3rem;" onclick="handleDeleteMember(${m.id})">🗑️</button>
            </td>
        `;
        listEl.appendChild(tr);
    });
}

function renderMonthlyPayments(members) {
    const listEl = document.getElementById('roster-payments-list');
    if (!listEl) return;

    // Atualizar labels do mês
    const monthName = MONTH_NAMES[ledgerCurrentMonth - 1];
    const monthLabelEl = document.getElementById('current-ledger-month-label');
    if (monthLabelEl) monthLabelEl.textContent = `${monthName} ${ledgerCurrentYear}`;

    const summaryMonthEl = document.getElementById('ledger-summary-month-name');
    if (summaryMonthEl) summaryMonthEl.textContent = `${monthName}/${ledgerCurrentYear}`;

    const mensalistas = members.filter(m => m.member_type === 'mensalista');
    const paidMensalistas = mensalistas.filter(m => m.payment_status === 'paid');
    const totalCollected = paidMensalistas.reduce((acc, m) => acc + (m.paid_amount || (currentGroup ? currentGroup.monthly_fee : 50)), 0);

    const paidCountEl = document.getElementById('ledger-paid-count');
    if (paidCountEl) paidCountEl.textContent = `${paidMensalistas.length} / ${mensalistas.length}`;

    const percent = mensalistas.length > 0 ? Math.round((paidMensalistas.length / mensalistas.length) * 100) : 0;
    const percentEl = document.getElementById('ledger-percent-badge');
    if (percentEl) percentEl.textContent = `${percent}% Pago`;

    const totalBadgeEl = document.getElementById('ledger-total-badge');
    if (totalBadgeEl) totalBadgeEl.textContent = `R$ ${totalCollected.toFixed(2).replace('.', ',')}`;

    const progressFill = document.getElementById('ledger-progress-fill');
    if (progressFill) progressFill.style.width = `${percent}%`;

    if (mensalistas.length === 0) {
        listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum mensalista cadastrado no elenco. Cadastre membros como Mensalistas para controlar a mensalidade.</td></tr>`;
        return;
    }

    listEl.innerHTML = '';
    mensalistas.forEach((m, idx) => {
        const tr = document.createElement('tr');
        const isPaid = m.payment_status === 'paid';
        const feeVal = currentGroup ? currentGroup.monthly_fee : 50.0;
        const dateStr = m.paid_at ? new Date(m.paid_at).toLocaleDateString('pt-BR') : '-';

        tr.innerHTML = `
            <td style="color: var(--text-muted); font-size: 0.85rem;">${idx + 1}</td>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td>R$ ${feeVal.toFixed(2).replace('.', ',')}</td>
            <td>
                <span class="payment-status-pill ${isPaid ? 'paid' : 'pending'}" onclick="handleTogglePayment(${m.id}, ${ledgerCurrentYear}, ${ledgerCurrentMonth}, '${m.payment_status}')" title="Clique para alternar">
                    ${isPaid ? '✅ Pago' : '⏳ Pendente'}
                </span>
            </td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</td>
            <td style="text-align: right;">
                <button class="btn ${isPaid ? 'secondary sm' : 'primary sm'}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="handleTogglePayment(${m.id}, ${ledgerCurrentYear}, ${ledgerCurrentMonth}, '${m.payment_status}')">
                    ${isPaid ? 'Desfazer' : 'Dar Baixa ✅'}
                </button>
            </td>
        `;
        listEl.appendChild(tr);
    });
}

async function handleTogglePayment(memberId, year, month, currentStatus) {
    if (!currentGroup) return;
    const shouldPay = (currentStatus !== 'paid');
    const adminKey = getAdminKey();

    try {
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/payments/toggle?key=${encodeURIComponent(adminKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                member_id: memberId,
                year: year,
                month: month,
                is_paid: shouldPay,
                amount: currentGroup.monthly_fee || 50.0
            })
        });

        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (!res.ok) throw new Error('Falha ao atualizar pagamento');
        const data = await res.json();
        showToast(shouldPay ? '💳 Mensalidade marcada como PAGA!' : '🔄 Mensalidade desmarcada para pendente');
        await loadRosterData();
        await loadDashboardData();
    } catch (e) {
        console.error('Erro ao alternar mensalidade:', e);
        showToast('Erro ao atualizar mensalidade.');
    }
}

async function handleToggleMemberType(memberId, newType) {
    const adminKey = getAdminKey();
    try {
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/members/${memberId}?key=${encodeURIComponent(adminKey)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_type: newType })
        });
        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (res.ok) {
            showToast(`Membro alterado para ${newType === 'mensalista' ? '⭐ Mensalista' : '🎟️ Avulso'}!`);
            await loadRosterData();
            await loadDashboardData();
        }
    } catch (e) {
        console.error('Erro ao alternar tipo de membro:', e);
    }
}

async function handleDeleteMember(memberId) {
    if (!confirm('Deseja desativar este membro do elenco da pelada?')) return;
    const adminKey = getAdminKey();
    try {
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/members/${memberId}?key=${encodeURIComponent(adminKey)}`, {
            method: 'DELETE'
        });
        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (res.ok) {
            showToast('Membro removido do elenco ativo.');
            await loadRosterData();
            await loadDashboardData();
        }
    } catch (e) {
        console.error('Erro ao deletar membro:', e);
    }
}

function handleOpenEditMemberModal(memberId) {
    const member = currentRosterMembers.find(m => m.id === memberId);
    if (!member) return;

    document.getElementById('member-modal-title').textContent = '✏️ Editar Membro';
    document.getElementById('member-edit-id').value = member.id;
    document.getElementById('member-name-input').value = member.name;
    document.getElementById('member-type-select').value = member.member_type || 'mensalista';
    document.getElementById('member-phone-input').value = member.phone || '';
    document.getElementById('member-is-goalkeeper').checked = Boolean(member.is_goalkeeper);
    document.getElementById('member-is-special').checked = (member.category === 'jovem');

    openModal(document.getElementById('member-modal'));
}

function populatePeladaConfigForm(group) {
    if (!group) return;
    const nameInput = document.getElementById('cfg-pelada-name');
    if (nameInput) nameInput.value = group.name || '';

    const freqSelect = document.getElementById('cfg-frequency-type');
    if (freqSelect) freqSelect.value = group.frequency_type || 'weekly';

    const weeklyBox = document.getElementById('cfg-weekly-days-box');
    const monthlyBox = document.getElementById('cfg-monthly-day-box');

    if (group.frequency_type === 'monthly') {
        if (weeklyBox) weeklyBox.classList.add('hidden');
        if (monthlyBox) monthlyBox.classList.remove('hidden');
        try {
            const p = JSON.parse(group.frequency_config || '{}');
            const dayInput = document.getElementById('cfg-month-day');
            if (dayInput) dayInput.value = p.day_of_month || 15;
        } catch (e) {}
    } else {
        if (weeklyBox) weeklyBox.classList.remove('hidden');
        if (monthlyBox) monthlyBox.classList.add('hidden');
        try {
            const p = JSON.parse(group.frequency_config || '{}');
            const days = p.days || [1];
            document.querySelectorAll('input[name="cfg-day"]').forEach(cb => {
                cb.checked = days.includes(parseInt(cb.value));
            });
        } catch (e) {}
    }

    const feeInput = document.getElementById('cfg-monthly-fee');
    if (feeInput) feeInput.value = (group.monthly_fee || 50.0).toFixed(2);

    const matchFeeInput = document.getElementById('cfg-match-fee');
    if (matchFeeInput) matchFeeInput.value = (group.per_match_fee || 15.0).toFixed(2);

    const dueDayInput = document.getElementById('cfg-due-day');
    if (dueDayInput) dueDayInput.value = group.due_day || 10;

    const pixInput = document.getElementById('cfg-pix-key');
    if (pixInput) pixInput.value = group.pix_key || '';
}

async function handleSavePeladaConfig() {
    if (!currentGroup) return;

    const name = document.getElementById('cfg-pelada-name').value.trim();
    const frequencyType = document.getElementById('cfg-frequency-type').value;

    let frequencyConfig = '{"days": [1]}';
    if (frequencyType === 'weekly') {
        const selectedDays = [];
        document.querySelectorAll('input[name="cfg-day"]:checked').forEach(cb => {
            selectedDays.push(parseInt(cb.value));
        });
        frequencyConfig = JSON.stringify({ days: selectedDays.length ? selectedDays : [1] });
    } else if (frequencyType === 'monthly') {
        const dayVal = parseInt(document.getElementById('cfg-month-day').value) || 15;
        frequencyConfig = JSON.stringify({ day_of_month: dayVal });
    }

    const monthlyFee = parseFloat(document.getElementById('cfg-monthly-fee').value) || 50.0;
    const perMatchFee = parseFloat(document.getElementById('cfg-match-fee').value) || 15.0;
    const dueDay = parseInt(document.getElementById('cfg-due-day').value) || 10;
    const pixKey = document.getElementById('cfg-pix-key').value.trim();
    const adminKey = getAdminKey();

    try {
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}?key=${encodeURIComponent(adminKey)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                frequency_type: frequencyType,
                frequency_config: frequencyConfig,
                monthly_fee: monthlyFee,
                per_match_fee: perMatchFee,
                due_day: dueDay,
                pix_key: pixKey
            })
        });

        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (!res.ok) throw new Error('Falha ao salvar configurações');
        showToast('⚙️ Configurações da pelada salvas com sucesso!');
        await loadDashboardData();
    } catch (e) {
        console.error('Erro ao salvar config:', e);
        showToast('Erro ao salvar configurações.');
    }
}

async function handleOpenNewMatchday() {
    if (!currentGroup) await loadDashboardData();
    if (!currentGroup) return;

    const confirmMsg = "Deseja abrir um NOVO Dia Oficial de Jogo para a pelada?\n\nA pelada anterior será arquivada e o novo dia começará limpo, mantendo todos os membros e configurações intactos.";
    if (!confirm(confirmMsg)) return;

    const adminKey = getAdminKey();
    try {
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/matchdays/new?key=${encodeURIComponent(adminKey)}`, {
            method: 'POST'
        });

        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (!res.ok) throw new Error('Falha ao criar novo dia de jogo');
        const data = await res.json();
        showToast('🚀 Novo Dia de Jogo aberto com sucesso!');

        activeSessionId = data.session_id;
        window.location.hash = `#/match/${data.public_hash}?admin=${data.admin_token}`;
        await loadDashboardData();
    } catch (e) {
        console.error('Erro ao abrir novo dia:', e);
        showToast('Erro ao abrir novo dia de jogo.');
    }
}

async function handleAddMensalistasToMatchday() {
    if (!currentGroup) await loadDashboardData();
    if (!currentGroup || !activeSessionId) {
        showToast('Nenhum dia de jogo ativo selecionado.');
        return;
    }

    const adminKey = getAdminKey();
    try {
        const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/matchdays/${activeSessionId}/add-members?key=${encodeURIComponent(adminKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all_mensalistas: true })
        });

        if (res.status === 401) {
            handleAdminUnauthorized();
            return;
        }
        if (!res.ok) throw new Error('Falha ao importar mensalistas');
        const data = await res.json();
        showToast(`⭐ ${data.added_count} mensalista(s) adicionados à presença!`);
        await loadSessionDetails(activeSessionId, activeSessionDate);
    } catch (e) {
        console.error('Erro ao adicionar mensalistas:', e);
        showToast('Erro ao importar mensalistas.');
    }
}

function handleCopyPaymentLedger() {
    if (!currentGroup || !currentRosterMembers) return;
    const monthName = MONTH_NAMES[ledgerCurrentMonth - 1];
    const mensalistas = currentRosterMembers.filter(m => m.member_type === 'mensalista');
    const paid = mensalistas.filter(m => m.payment_status === 'paid');
    const pending = mensalistas.filter(m => m.payment_status !== 'paid');

    let text = `⚽ *MENSALIDADE PELADA - ${currentGroup.name.toUpperCase()}*\n`;
    text += `📅 Referência: *${monthName}/${ledgerCurrentYear}*\n`;
    text += `💵 Valor: *R$ ${(currentGroup.monthly_fee || 50).toFixed(2).replace('.', ',')}*\n`;
    text += `🗓️ Vencimento: *Dia ${currentGroup.due_day || 10}*\n\n`;

    text += `✅ *PAGOS (${paid.length}/${mensalistas.length}):*\n`;
    if (paid.length === 0) {
        text += `_Nenhum pagamento registrado ainda_\n`;
    } else {
        paid.forEach((m, i) => {
            text += `${i + 1}. ${m.name} 👍\n`;
        });
    }

    text += `\n⏳ *PENDENTES (${pending.length}):*\n`;
    if (pending.length === 0) {
        text += `_Todos os mensalistas estão em dia! 🚀_\n`;
    } else {
        pending.forEach((m, i) => {
            text += `${i + 1}. ${m.name}\n`;
        });
    }

    if (currentGroup.pix_key) {
        text += `\n🔑 *CHAVE PIX:*\n\`${currentGroup.pix_key}\`\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Lista de cobrança copiada para o WhatsApp!');
    }).catch(() => {
        promptFallbackCopy(text, '📋 Lista de cobrança copiada!');
    });
}

function setupRosterAndDashboardListeners() {
    // Navbar links
    document.querySelectorAll('.main-navbar .nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetNav = btn.getAttribute('data-nav');
            if (targetNav === 'dashboard-view') {
                window.location.hash = '#/dashboard';
            } else if (targetNav === 'roster-view') {
                window.location.hash = '#/roster';
            } else if (targetNav === 'players-view') {
                window.location.hash = '#/matchday';
            } else if (targetNav === 'sessions-view') {
                window.location.hash = '#/sessions';
            }
        });
    });

    const btnLogout = document.getElementById('nav-btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('Deseja sair da área administrativa da pelada?')) {
                localStorage.removeItem('pelada_admin_key');
                const navbar = document.getElementById('main-navbar');
                if (navbar) navbar.classList.add('hidden');
                showToast('Você saiu da gestão.');
                showView('auth-view');
            }
        });
    }

    // Dashboard quick action buttons
    const btnDashNew = document.getElementById('btn-dash-new-matchday');
    if (btnDashNew) btnDashNew.addEventListener('click', handleOpenNewMatchday);

    const btnDashMatch = document.getElementById('btn-dash-goto-match');
    if (btnDashMatch) {
        btnDashMatch.addEventListener('click', () => {
            if (currentPublicHash) {
                window.location.hash = currentAdminToken ? `#/match/${currentPublicHash}?admin=${currentAdminToken}` : `#/match/${currentPublicHash}`;
            } else {
                handleOpenNewMatchday();
            }
        });
    }

    const btnDashRoster = document.getElementById('btn-dash-manage-roster');
    if (btnDashRoster) btnDashRoster.addEventListener('click', () => { window.location.hash = '#/roster'; });

    const btnDashPay = document.getElementById('btn-dash-manage-payments');
    if (btnDashPay) {
        btnDashPay.addEventListener('click', () => {
            window.location.hash = '#/roster';
            const payTabBtn = document.querySelector('[data-roster-tab="tab-roster-payments"]');
            if (payTabBtn) payTabBtn.click();
        });
    }

    const btnDashPix = document.getElementById('btn-dash-copy-pix');
    if (btnDashPix) {
        btnDashPix.addEventListener('click', () => {
            if (currentGroup && currentGroup.pix_key) {
                navigator.clipboard.writeText(currentGroup.pix_key);
                showToast(`🔑 Chave PIX copiada: ${currentGroup.pix_key}`);
            } else {
                showToast('Nenhuma chave PIX configurada nas opções da pelada.');
            }
        });
    }

    const btnDashMatchHub = document.getElementById('btn-dash-open-matchday-hub');
    if (btnDashMatchHub) {
        btnDashMatchHub.addEventListener('click', () => {
            window.location.hash = '#/matchday';
        });
    }

    // Botão Adicionar Mensalistas à Presença no Dia de Jogo
    const btnAddMensalistas = document.getElementById('btn-add-mensalistas-to-match');
    if (btnAddMensalistas) btnAddMensalistas.addEventListener('click', handleAddMensalistasToMatchday);

    // Roster sub-tabs navigation
    document.querySelectorAll('[data-roster-tab]').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            document.querySelectorAll('[data-roster-tab]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#roster-view .tab-content').forEach(c => c.classList.remove('active'));

            tabBtn.classList.add('active');
            const target = document.getElementById(tabBtn.getAttribute('data-roster-tab'));
            if (target) target.classList.add('active');
        });
    });

    // Month picker buttons in Monthly Payments Ledger
    const btnPrevMonth = document.getElementById('btn-prev-month');
    if (btnPrevMonth) {
        btnPrevMonth.addEventListener('click', () => {
            ledgerCurrentMonth--;
            if (ledgerCurrentMonth < 1) {
                ledgerCurrentMonth = 12;
                ledgerCurrentYear--;
            }
            loadRosterData();
        });
    }

    const btnNextMonth = document.getElementById('btn-next-month');
    if (btnNextMonth) {
        btnNextMonth.addEventListener('click', () => {
            ledgerCurrentMonth++;
            if (ledgerCurrentMonth > 12) {
                ledgerCurrentMonth = 1;
                ledgerCurrentYear++;
            }
            loadRosterData();
        });
    }

    // Copy ledger button
    const btnCopyLedger = document.getElementById('btn-copy-payment-ledger');
    if (btnCopyLedger) btnCopyLedger.addEventListener('click', handleCopyPaymentLedger);

    // Member search filter
    const rosterSearchInput = document.getElementById('roster-search-input');
    if (rosterSearchInput) {
        rosterSearchInput.addEventListener('input', () => {
            renderRosterMembers(currentRosterMembers);
        });
    }

    // Frequency Selector type change (weekly / monthly / on_demand)
    const freqSelect = document.getElementById('cfg-frequency-type');
    if (freqSelect) {
        freqSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const weeklyBox = document.getElementById('cfg-weekly-days-box');
            const monthlyBox = document.getElementById('cfg-monthly-day-box');
            if (val === 'weekly') {
                if (weeklyBox) weeklyBox.classList.remove('hidden');
                if (monthlyBox) monthlyBox.classList.add('hidden');
            } else if (val === 'monthly') {
                if (weeklyBox) weeklyBox.classList.add('hidden');
                if (monthlyBox) monthlyBox.classList.remove('hidden');
            } else {
                if (weeklyBox) weeklyBox.classList.add('hidden');
                if (monthlyBox) monthlyBox.classList.add('hidden');
            }
        });
    }

    // Save pelada config button
    const btnSaveConfig = document.getElementById('btn-save-pelada-config');
    if (btnSaveConfig) btnSaveConfig.addEventListener('click', handleSavePeladaConfig);

    // Member Modal handlers
    const btnNewMember = document.getElementById('btn-new-member');
    const memberModal = document.getElementById('member-modal');
    const closeMemberModalBtn = document.getElementById('close-member-modal-btn');
    const btnCancelMember = document.getElementById('btn-cancel-member');
    const memberForm = document.getElementById('member-form');

    if (btnNewMember && memberModal) {
        btnNewMember.addEventListener('click', () => {
            document.getElementById('member-modal-title').textContent = '➕ Adicionar Membro';
            document.getElementById('member-edit-id').value = '';
            document.getElementById('member-name-input').value = '';
            document.getElementById('member-type-select').value = 'mensalista';
            document.getElementById('member-phone-input').value = '';
            document.getElementById('member-is-goalkeeper').checked = false;
            document.getElementById('member-is-special').checked = false;
            openModal(memberModal);
        });
    }

    if (closeMemberModalBtn && memberModal) {
        closeMemberModalBtn.addEventListener('click', () => closeModal(memberModal));
    }
    if (btnCancelMember && memberModal) {
        btnCancelMember.addEventListener('click', () => closeModal(memberModal));
    }

    if (memberForm) {
        memberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentGroup) return;

            const editId = document.getElementById('member-edit-id').value;
            const name = document.getElementById('member-name-input').value.trim();
            const memberType = document.getElementById('member-type-select').value;
            const phone = document.getElementById('member-phone-input').value.trim();
            const isGk = document.getElementById('member-is-goalkeeper').checked;
            const isSpecial = document.getElementById('member-is-special').checked;
            const category = isSpecial ? 'jovem' : 'default';

            if (!name) return;

            const adminKey = getAdminKey();
            if (!adminKey) {
                handleAdminUnauthorized();
                return;
            }

            try {
                if (editId) {
                    const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/members/${editId}?key=${encodeURIComponent(adminKey)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            member_type: memberType,
                            is_goalkeeper: isGk,
                            category: category,
                            phone: phone
                        })
                    });
                    if (res.status === 401) {
                        handleAdminUnauthorized();
                        return;
                    }
                    if (!res.ok) throw new Error('Falha ao atualizar membro');
                    showToast('Membro atualizado com sucesso!');
                } else {
                    const res = await fetch(`${API_BASE}/groups/${currentGroup.id}/members?key=${encodeURIComponent(adminKey)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            member_type: memberType,
                            is_goalkeeper: isGk,
                            category: category,
                            phone: phone
                        })
                    });
                    if (res.status === 401) {
                        handleAdminUnauthorized();
                        return;
                    }
                    if (!res.ok) throw new Error('Falha ao criar membro');
                    showToast('Novo membro adicionado ao elenco!');
                }
                closeModal(memberModal);
                await loadRosterData();
                await loadDashboardData();
            } catch (err) {
                console.error('Erro ao salvar membro:', err);
                showToast('Erro ao salvar dados do membro.');
            }
        });
    }
}

// Inicializar listeners do Dashboard e Elenco
document.addEventListener('DOMContentLoaded', () => {
    setupRosterAndDashboardListeners();
});

// Expor handlers chamados via onclick dinâmico no window
window.handleToggleMemberType = handleToggleMemberType;
window.handleTogglePayment = handleTogglePayment;
window.handleOpenEditMemberModal = handleOpenEditMemberModal;
window.handleDeleteMember = handleDeleteMember;
window.handleOpenActiveMatchLive = handleOpenActiveMatchLive;
window.handleOpenActiveMatchPlayers = handleOpenActiveMatchPlayers;
window.handleOpenNewMatchday = handleOpenNewMatchday;
window.escapeHtml = escapeHtml;




