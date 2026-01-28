// Credentials
const USER = "aikam.bhinder12";
const PASS = "121209";

function getInputValue(possibleIds, possibleNames) {
    for (const id of possibleIds) {
        const el = document.getElementById(id);
        if (el && typeof el.value === 'string') return el.value;
    }
    for (const name of possibleNames) {
        const el = document.querySelector(`input[name="${name}"]`);
        if (el && typeof el.value === 'string') return el.value;
    }
    return null;
}

// Run only after DOM is ready (fixes null elements + broken calendar/buttons when script loads in <head>)
function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

onReady(async () => {
    // Detect page by DOM instead of relying on filenames (works for file://, Live Server, renames, etc.)
    const hasPlannerUI = !!(
        document.getElementById('monthCalendar') ||
        document.getElementById('calendarMonthLabel') ||
        document.getElementById('selectedDayOrders') ||
        document.getElementById('orderModal') ||
        document.getElementById('orderForm')
    );
    const hasLoginUI = !!document.getElementById('loginForm');

    const isPlanner = hasPlannerUI;
    const isLogin = hasLoginUI && !hasPlannerUI;

    // --- Login Logic ---
    if (isLogin) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const u = getInputValue(['username', 'user', 'login-username', 'email'], ['username', 'user', 'email']);
                const p = getInputValue(['password', 'pass', 'login-password'], ['password', 'pass']);

                if (u === null || p === null) {
                    console.error('Login inputs not found. Expected ids like #username/#password or name="username"/name="password".');
                    alert('Login inputs not found. Check your input IDs (username/password) in index.html.');
                    return;
                }

                console.log('Entered username:', u);
                console.log('Entered password length:', String(p).length);

                if (u === USER && p === PASS) {
                    // Set session flag
                    sessionStorage.setItem('isLoggedIn', 'true');
                    window.location.href = 'planner.html';
                } else {
                    const err = document.getElementById('error-msg');
                    if (err) err.classList.remove('hidden');
                    else alert('Wrong username or password');
                }
            });
        }
        return; // stop here on login page
    }

    // --- Planner Logic ---
    if (!isPlanner) return;

    // Security Check
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    // State
    let orders = [];

    // --- Google Sheets (Apps Script Web App) Sync ---
    const API_URL = "https://script.google.com/macros/s/AKfycbwldHSxSeAYigHWgDHz6mTQkJQ4k0gXk0EBBQAIEG8ozwURoOywxae781CO32b9ldtx/exec";
    const API_TOKEN = "roseplanner_2026_7f3c9a1b2d4e6f8a0c1e3b5a7d9f";
    const LOCAL_CACHE_KEY = 'roseRoomOrders';

    // Apps Script web apps often redirect script.google.com -> script.googleusercontent.com.
    // Some browsers may change POST to GET on redirect, so we cache the final resolved endpoint and POST to it.
    const API_POST_URL_KEY = 'roseRoomApiPostUrl';
    let API_POST_URL = localStorage.getItem(API_POST_URL_KEY) || API_URL;

    async function apiListOrders() {
        const res = await fetch(`${API_URL}?action=list&token=${encodeURIComponent(API_TOKEN)}`, {
            method: 'GET',
            cache: 'no-store',
            redirect: 'follow'
        });

        // Cache resolved endpoint for POSTs (strip query params)
        try {
            const resolved = String(res.url || '');
            if (resolved) {
                API_POST_URL = resolved.split('?')[0];
                localStorage.setItem(API_POST_URL_KEY, API_POST_URL);
            }
        } catch { /* ignore */ }

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`Non-JSON response from server: ${text.slice(0, 120)}`);
        }

        if (!data.ok) throw new Error(data.error || 'Failed to list orders');
        return Array.isArray(data.orders) ? data.orders : [];
    }

    async function apiUpsertOrder(order) {
        // IMPORTANT: use text/plain to avoid CORS preflight (Apps Script Web Apps often fail OPTIONS requests)
        const res = await fetch(API_POST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'upsert', token: API_TOKEN, order }),
            redirect: 'follow'
        });

        // Apps Script returns JSON text
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`Non-JSON response from server: ${text.slice(0, 120)}`);
        }

        if (!data.ok) throw new Error(data.error || 'Failed to save order');
        return true;
    }

    // Basic normalizer (Sheets may return numbers as strings)
    function normalizeOrder(o) {
        return {
            id: String(o.id || ''),
            date: String(o.date || ''),
            client: String(o.client || ''),
            size: Number(o.size || 0),
            type: String(o.type || ''),
            details: String(o.details || ''),
            total: Number(o.total || 0),
            paid: Number(o.paid || 0),
            due: Number(o.due || 0),
            createdAt: String(o.createdAt || ''),
            updatedAt: String(o.updatedAt || '')
        };
    }

    function newId() {
        // Prefer crypto UUID when available
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `ord_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    async function loadOrders() {
        // 1) Try online first
        try {
            const remote = await apiListOrders();
            orders = remote.map(normalizeOrder).filter(o => o.id && o.date);
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(orders));
            return;
        } catch (err) {
            console.warn('Online sync failed, using local cache:', err);
        }

        // 2) Fallback to local cache
        try {
            orders = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY)) || [];
        } catch {
            orders = [];
        }
    }

    // Render Tables
    function renderTables() {
        const upcomingBody = document.getElementById('upcomingTableBody');
        const pastBody = document.getElementById('pastTableBody');
        const today = toISODate(new Date());

        if (!upcomingBody || !pastBody) return;

        upcomingBody.innerHTML = '';
        pastBody.innerHTML = '';

        orders.forEach((o, index) => {
            const row = `
                <tr>
                    <td>${o.date}</td>
                    <td><strong>${o.client}</strong></td>
                    <td>${o.size} roses — ${o.details}</td>
                    <td>${o.type}</td>
                    <td>$${o.total}</td>
                    <td style="color:${o.due > 0 ? 'red' : 'green'}">${o.due > 0 ? '$' + o.due + ' Due' : 'Paid'}</td>
                    <td><button class="btn-edit" onclick="openModal(${index})">Edit</button></td>
                </tr>
            `;

            if (o.date >= today) {
                upcomingBody.innerHTML += row;
            } else {
                pastBody.innerHTML += row;
            }
        });
    }

    // ---- Monthly Calendar (Advanced) ----
    const monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth(); // 0-11
    let selectedDateStr = new Date().toISOString().split('T')[0];

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function toISODate(d) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function parseISODate(iso) {
        const [y, m, dd] = String(iso).split('-').map(Number);
        if (!y || !m || !dd) return null;
        return new Date(y, m - 1, dd);
    }

    function isSameISO(a, b) {
        return String(a) === String(b);
    }

    function formatDisplayDate(iso) {
        const d = parseISODate(iso);
        if (!d) return iso;
        return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    function getOrdersForDate(iso) {
        return orders.filter(o => o.date === iso);
    }

    function getMonthGrid(year, monthIndex) {
        const firstOfMonth = new Date(year, monthIndex, 1);
        const startDay = firstOfMonth.getDay(); // 0=Sun
        const gridStart = new Date(year, monthIndex, 1 - startDay);

        const cells = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            cells.push({
                date: d,
                iso: toISODate(d),
                dayNum: d.getDate(),
                isOutside: d.getMonth() !== monthIndex,
            });
        }
        return cells;
    }

    function renderSelectedDayPanel(iso) {
        const labelEl = document.getElementById('selectedDateLabel');
        const countEl = document.getElementById('selectedDateCount');
        const listEl = document.getElementById('selectedDayOrders');

        if (!labelEl || !countEl || !listEl) return;

        const dayOrders = getOrdersForDate(iso);
        labelEl.textContent = formatDisplayDate(iso);
        countEl.textContent = `${dayOrders.length} ${dayOrders.length === 1 ? 'order' : 'orders'}`;

        if (dayOrders.length === 0) {
            listEl.innerHTML = `<div class="empty-state">No orders for this day.</div>`;
            return;
        }

        listEl.innerHTML = dayOrders
            .map((o) => {
                const paidStatus = (Number(o.due) > 0)
                    ? `<span class="badge">$${Number(o.due).toFixed(2)} due</span>`
                    : `<span class="badge">Paid</span>`;

                return `
                    <div class="order-item">
                        <div>
                            <strong>${o.client}</strong>
                            <div class="order-sub">${o.size} roses — ${o.details}</div>
                            <div class="order-sub">Type: ${o.type} • Total: $${Number(o.total).toFixed(2)} • Paid: $${Number(o.paid).toFixed(2)}</div>
                        </div>
                        <div>${paidStatus}</div>
                    </div>
                `;
            })
            .join('');
    }

    function renderCalendar() {
        const monthLabel = document.getElementById('calendarMonthLabel');
        const gridEl = document.getElementById('monthCalendar');
        if (!monthLabel || !gridEl) return;

        const todayISO = toISODate(new Date());

        monthLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;
        const cells = getMonthGrid(viewYear, viewMonth);

        gridEl.innerHTML = '';
        const fragment = document.createDocumentFragment();

        cells.forEach((cell) => {
            const dayOrders = getOrdersForDate(cell.iso);
            const count = dayOrders.length;

            const el = document.createElement('div');
            el.className = 'day-cell';
            el.setAttribute('role', 'gridcell');
            el.dataset.date = cell.iso;

            if (cell.isOutside) el.classList.add('is-outside');
            if (isSameISO(cell.iso, todayISO)) el.classList.add('today');
            if (isSameISO(cell.iso, selectedDateStr)) el.classList.add('is-selected');
            if (count > 0) el.classList.add('has-orders');

            const previewNames = dayOrders.slice(0, 2).map(o => o.client).join(', ');
            const extra = count > 2 ? ` +${count - 2} more` : '';
            const previewText = count > 0 ? `${previewNames}${extra}` : '';

            el.innerHTML = `
                <div class="day-num">${cell.dayNum}</div>
                <div class="day-meta">
                    <div class="order-count">${count > 0 ? `<span class="badge">${count}</span> Orders` : `<span class="badge" style="opacity:.35">0</span> Orders`}</div>
                    <div class="client-preview">${previewText}</div>
                </div>
            `;

            el.addEventListener('click', () => {
                selectedDateStr = cell.iso;
                renderCalendar();
                renderSelectedDayPanel(selectedDateStr);
            });

            fragment.appendChild(el);
        });

        gridEl.appendChild(fragment);
        renderSelectedDayPanel(selectedDateStr);
    }

    function setViewToToday() {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        selectedDateStr = toISODate(now);
        renderCalendar();
    }

    function wireCalendarControls() {
        const prevBtn = document.getElementById('prevMonthBtn');
        const nextBtn = document.getElementById('nextMonthBtn');
        const todayBtn = document.getElementById('todayBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                viewMonth -= 1;
                if (viewMonth < 0) {
                    viewMonth = 11;
                    viewYear -= 1;
                }
                renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                viewMonth += 1;
                if (viewMonth > 11) {
                    viewMonth = 0;
                    viewYear += 1;
                }
                renderCalendar();
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                setViewToToday();
            });
        }
    }

    // Modal Functions
    window.openModal = function(editIndex = null) {
        const modal = document.getElementById('orderModal');
        const form = document.getElementById('orderForm');
        if (!modal || !form) return;
        modal.classList.remove('hidden');

        if (editIndex !== null) {
            document.getElementById('modalTitle').innerText = "Edit Order";
            document.getElementById('editIndex').value = editIndex;
            const o = orders[editIndex];

            document.getElementById('clientName').value = o.client;
            document.getElementById('orderDate').value = o.date;
            document.getElementById('bouquetSize').value = o.size;
            document.getElementById('orderType').value = o.type;
            document.getElementById('bouquetDetails').value = o.details;
            document.getElementById('totalPrice').value = o.total;
            document.getElementById('paidPrice').value = o.paid;
            calcRemaining();
        } else {
            document.getElementById('modalTitle').innerText = "Add New Order";
            document.getElementById('editIndex').value = "";
            form.reset();
        }
    };

    window.closeModal = function () {
        const modal = document.getElementById('orderModal');
        if (!modal) return;

        modal.classList.add('hidden');

        const form = document.getElementById('orderForm');
        if (form) form.reset();
    };

    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    window.calcRemaining = function() {
        const total = parseFloat(document.getElementById('totalPrice').value) || 0;
        const paid = parseFloat(document.getElementById('paidPrice').value) || 0;
        document.getElementById('amountLeft').value = (total - paid).toFixed(2);
    };

    const orderForm = document.getElementById('orderForm');
    if (orderForm) orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editIdxRaw = document.getElementById('editIndex').value;
        const isEdit = editIdxRaw !== "";
        const editIdx = isEdit ? Number(editIdxRaw) : null;

        // Preserve id/createdAt on edits
        const existing = (isEdit && orders[editIdx]) ? orders[editIdx] : null;

        const newOrder = {
            id: existing?.id || newId(),
            client: document.getElementById('clientName').value.trim(),
            date: document.getElementById('orderDate').value,
            size: parseInt(document.getElementById('bouquetSize').value, 10),
            type: document.getElementById('orderType').value,
            details: document.getElementById('bouquetDetails').value.trim(),
            total: parseFloat(document.getElementById('totalPrice').value) || 0,
            paid: parseFloat(document.getElementById('paidPrice').value) || 0,
            due: parseFloat(document.getElementById('amountLeft').value) || 0,
            createdAt: existing?.createdAt || "",
            updatedAt: ""
        };

        try {
            // Save online
            await apiUpsertOrder(newOrder);

            // Update local state
            if (isEdit) {
                orders[editIdx] = newOrder;
            } else {
                orders.push(newOrder);
            }

            // Update local cache
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(orders));

            closeModal();
            renderTables();
            renderCalendar();
        } catch (err) {
            console.error('Save failed:', err);
            alert(`Could not save to the online sheet.\n\n${String(err && err.message ? err.message : err)}`);
        }
    });

    // FINAL init for planner page
    wireCalendarControls();
    await loadOrders();
    setViewToToday();
    renderTables();
});