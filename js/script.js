// Supabase setup
const SUPABASE_URL = "https://zsohiwpwfeburwcilhpk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb2hpd3B3ZmVidXJ3Y2lsaHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzEwNDYsImV4cCI6MjA5MzA0NzA0Nn0.zu_E75L4aa-Wc_1G6Y3NNDQ3bx4BqHj7FHyjEG7tVLY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

onReady(() => {
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

        // If already logged in, send to planner
        supabaseClient.auth.getSession().then(({ data }) => {
            if (data.session) {
                window.location.href = 'planner.html';
            }
        });

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('email')?.value.trim();
                const password = document.getElementById('password')?.value;

                if (!email || !password) {
                    alert('Enter your email and password.');
                    return;
                }

                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    const err = document.getElementById('error-msg');
                    if (err) {
                        err.textContent = 'Invalid email or password';
                        err.classList.remove('hidden');
                    } else {
                        alert('Invalid email or password');
                    }
                    return;
                }

                if (data.session) {
                    window.location.href = 'planner.html';
                }
            });
        }

        return; // stop here on login page
    }

    // --- Planner Logic ---
    if (!isPlanner) return;

    // Real Supabase Auth Check
    async function protectPlannerPage() {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error || !data.session) {
            window.location.href = 'index.html';
            return false;
        }

        return true;
    }

    // Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    // State
    let orders = [];

    // --- Local per-device storage (no cloud sync) ---
    const STORAGE_KEY = 'roseRoomOrders';

    function newId() {
        // Prefer crypto UUID when available
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `ord_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    function loadOrdersFromLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            orders = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(orders)) orders = [];
        } catch {
            orders = [];
        }

        // Normalize minimal fields the UI expects
        orders = orders.map(o => ({
            id: String(o.id || newId()),
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
        })).filter(o => o.date);

        orders.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
    }

    function saveOrdersToLocal() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
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
    let selectedDateStr = toISODate(new Date());

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
        document.body.classList.add('modal-open');

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
        document.body.classList.remove('modal-open');

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

    // Mobile fix: if the Save button isn't a real submit button (type="button"), the form submit handler won't fire.
    // Force a submit on click so iPhone/Android always save.
    if (orderForm) {
        const saveBtn =
            document.getElementById('saveOrderBtn') ||
            document.getElementById('saveOrder') ||
            orderForm.querySelector('button[type="submit"], input[type="submit"], button');

        if (saveBtn) {
            saveBtn.addEventListener('click', (ev) => {
                // If it's not a submit button, force submit
                const btnType = (saveBtn.getAttribute('type') || '').toLowerCase();
                if (btnType && btnType !== 'submit') {
                    ev.preventDefault();
                }

                if (typeof orderForm.requestSubmit === 'function') {
                    orderForm.requestSubmit();
                } else {
                    orderForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            });
        }

        orderForm.addEventListener('submit', async (e) => {
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

            const savedOrder = await saveOrderToSupabase(newOrder);

            if (!savedOrder) return;

            await loadOrdersFromSupabase();

            closeModal();
            renderTables();
            renderCalendar();
        });
    }

    // FINAL init for planner page after Supabase confirms the user is logged in
    protectPlannerPage().then(async (allowed) => {
        if (!allowed) return;

        wireCalendarControls();
        await loadOrdersFromSupabase();
        setViewToToday();
        renderTables();
    });
});