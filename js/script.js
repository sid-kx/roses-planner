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
    let orders = JSON.parse(localStorage.getItem('roseRoomOrders')) || [];

    // Render Tables
    function renderTables() {
        const upcomingBody = document.getElementById('upcomingTableBody');
        const pastBody = document.getElementById('pastTableBody');
        const today = new Date().toISOString().split('T')[0];

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

        const todayISO = new Date().toISOString().split('T')[0];

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
        selectedDateStr = now.toISOString().split('T')[0];
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
    if (orderForm) orderForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const newOrder = {
            client: document.getElementById('clientName').value,
            date: document.getElementById('orderDate').value,
            size: parseInt(document.getElementById('bouquetSize').value, 10),
            type: document.getElementById('orderType').value,
            details: document.getElementById('bouquetDetails').value,
            total: parseFloat(document.getElementById('totalPrice').value),
            paid: parseFloat(document.getElementById('paidPrice').value),
            due: parseFloat(document.getElementById('amountLeft').value)
        };

        const editIdx = document.getElementById('editIndex').value;

        if (editIdx !== "") {
            orders[editIdx] = newOrder;
        } else {
            orders.push(newOrder);
        }

        localStorage.setItem('roseRoomOrders', JSON.stringify(orders));
        closeModal();
        renderTables();
        renderCalendar();
    });

    // FINAL init for planner page
    wireCalendarControls();
    setViewToToday();
    renderTables();
});