// State
const STORAGE_KEY = 'sports_tracker_data';
// activityData removed, using 'activities' array instead.
let activities = [];
let currentActivityId = null;
let viewMode = 'day'; // Global default, but cards track their own
let isLoadingHistory = false;
let earliestLoadedMonth = null;
let earliestLoadedYear = null;
let swiperObserver = null;
let selectedDate = null; // Track selected date for retroactive check-in


// DOM Elements
const totalCountEl = document.getElementById('total-count');
const currentStreakEl = document.getElementById('current-streak');
// const logBtn = document.getElementById('log-btn'); // REMOVED
const catCharacter = document.getElementById('cat-character');
const appContainer = document.querySelector('.app-container');
// We will wipe the existing static container and build the swiper dynamically.

// Load Data
const storedData = localStorage.getItem('activityData');
if (storedData) {
    const parsed = JSON.parse(storedData);
    // Migration Check: Is it an array?
    if (Array.isArray(parsed)) {
        // Already new format (or just an array? New format is object {activities: []})
        // Wait, plan said structure is { activities: [], currentActivityId: ... }
        // Let's store the WHOLE state object in a new key? Or reuse 'activityData'? 
        // Reusing 'activityData' is risky if format changes.
        // Let's check checks.

        if (parsed.activities) {
            activities = parsed.activities;
            currentActivityId = parsed.currentActivityId || activities[0].id;
        } else {
            // Old Format: This parsed object is the data map itself { "date": count }
            migrateData(parsed);
        }
    } else {
        // It's an object. Is it old data map or new root object?
        if (parsed.activities) {
            activities = parsed.activities;
            currentActivityId = parsed.currentActivityId || (activities[0] ? activities[0].id : null);
        } else {
            // Assume Old Format
            migrateData(parsed);
        }
    }
} else {
    // No data, start empty
    activities = [];
}

function migrateData(oldData) {
    const newId = 'act_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const defaultActivity = {
        id: newId,
        name: "Activity Tracker",
        created_at: Date.now(),
        data: oldData,
        viewMode: 'day' // Default view per activity
    };
    activities = [defaultActivity];
    currentActivityId = newId;
    saveData();
}

function saveData() {
    const root = {
        activities: activities,
        currentActivityId: currentActivityId
    };
    localStorage.setItem('activityData', JSON.stringify(root));
}

function createActivity(name) {
    const newId = 'act_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const newActivity = {
        id: newId,
        name: name,
        created_at: Date.now(),
        name: name,
        created_at: Date.now(),
        data: {},
        viewMode: viewMode // Use current global view mode preference
    };
    activities.push(newActivity);
    currentActivityId = newId;
    saveData();
    return newActivity;
}

// Helper to get current activity object
function getCurrentActivity() {
    return activities.find(a => a.id === currentActivityId) || activities[0];
}

const catWrapper = document.getElementById('cat-wrapper');

const heatmapGrid = document.getElementById('heatmap-grid');
const heatmapContainer = document.querySelector('.heatmap-scroll');
const shareBtn = document.getElementById('share-btn');
// Capture the full app container to include Header + Stats
const captureArea = document.querySelector('.app-container');
const viewToggleDay = document.getElementById('view-day');
const viewToggleMonth = document.getElementById('view-month');
const swiperPagination = document.querySelector('.swiper-pagination');

// Modal Elements
const addActivityModal = document.getElementById('add-activity-modal');
const activityNameInput = document.getElementById('activity-name-input');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm');
// ... (existing code)



// Initialization
function init() {
    initCat();

    // Cat Interaction
    if (catCharacter) {
        catCharacter.addEventListener('click', logWorkout);
    }

    // Swiper Observer
    swiperObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const id = card.dataset.id;

                // Update State
                if (id && id !== currentActivityId) {
                    currentActivityId = id;
                    saveData();
                }

                // Update Pagination
                const index = Array.from(swiperContainer.children).indexOf(card);
                updatePagination(index);
            }
        });
    }, { root: document.getElementById('swiper-container'), threshold: 0.6 });

    renderActivities();
    setupModalListeners();
}

function setupModalListeners() {
    modalCancelBtn.addEventListener('click', closeModal);
    modalConfirmBtn.addEventListener('click', handleCreateActivity);

    // Close on click outside (optional)
    addActivityModal.addEventListener('click', (e) => {
        if (e.target === addActivityModal) closeModal();
    });

    // Enter key
    activityNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateActivity();
        }
    });
}


const swiperContainer = document.getElementById('swiper-container');

function renderActivities() {
    swiperContainer.innerHTML = '';

    // 1. Render existing activities
    activities.forEach(activity => {
        const card = createActivityCard(activity);
        if (swiperObserver) swiperObserver.observe(card);
        swiperContainer.appendChild(card);
    });

    // 2. Render "Add Activity" card
    const addCard = createAddActivityCard();
    if (swiperObserver) swiperObserver.observe(addCard);
    swiperContainer.appendChild(addCard);

    // 3. Render Pagination
    renderPagination();

    // 3. Scroll to current activity
    // setTimeout to allow layout
    setTimeout(() => {
        const activeCard = document.querySelector(`.activity-card[data-id="${currentActivityId}"]`);
        if (activeCard) {
            activeCard.scrollIntoView({ inline: 'center', behavior: 'auto' });
        }
    }, 0);
}

function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.dataset.id = activity.id;

    // Stats Card
    const stats = document.createElement('div');
    stats.className = 'stats-card';
    stats.innerHTML = `
        <h3 class="stats-title">${activity.name}</h3>
        <div class="stats-row">
            <div class="stat-item">
                <span class="stat-value total-count">...</span>
                <span class="stat-label">Total Check-ins</span>
            </div>
            <div class="stat-item">
                <span class="stat-value current-streak">...</span>
                <span class="stat-label">Current Streak</span>
            </div>
        </div>
    `;
    card.appendChild(stats);

    // Heatmap Card
    const data = activity.data;
    const heatmapContainer = document.createElement('div');
    heatmapContainer.className = 'heatmap-container heatmap-scroll-wrapper';

    heatmapContainer.innerHTML = `
        <div class="heatmap-header">
            <div class="header-left">
                <div class="view-toggles">
                    <span class="toggle-option view-day active" data-mode="day">Day</span>
                    <span class="toggle-divider">/</span>
                    <span class="toggle-option view-month" data-mode="month">Month</span>
                </div>
            </div>
            <button class="icon-button share-btn" title="Share Snapshot">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
        </div>
        <div class="legend-container">
            <span class="legend-label">Less</span>
            <div class="legend-scale">
                 <div class="legend-box level-0"></div><div class="legend-box level-1"></div><div class="legend-box level-2"></div><div class="legend-box level-3"></div><div class="legend-box level-4"></div>
            </div>
            <span class="legend-label">More</span>
        </div>
        <div class="heatmap-scroll"></div>
    `;

    card.appendChild(heatmapContainer);

    // Render content immediately
    // Update references because we changed class names/structure
    // updateCardStats checks .total-count, which is inside stats-section (fine)
    // renderCardHeatmap checks .heatmap-scroll, which is inside heatmap-section (fine)

    updateCardStats(card, activity);
    renderCardHeatmap(card, activity);

    return card;
}

function createAddActivityCard() {
    const card = document.createElement('div');
    card.className = 'activity-card new-activity-card';
    card.innerHTML = `
        <div class="add-button">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Activity</span>
        </div>
    `;
    card.addEventListener('click', () => {
        openModal();
    });
    return card;
}

// Modal Functions
function openModal() {
    addActivityModal.classList.add('active');
    activityNameInput.value = '';
    setTimeout(() => activityNameInput.focus(), 100);
}

function closeModal() {
    addActivityModal.classList.remove('active');
    activityNameInput.blur();
}

function handleCreateActivity() {
    // Prevent double submission if already closed or handling
    if (!addActivityModal.classList.contains('active')) return;

    const name = activityNameInput.value.trim();
    if (name) {
        // Close first to prevent re-entry
        closeModal();
        createActivity(name);
        renderActivities();
    }
}

// Pagination Functions
function renderPagination() {
    if (!swiperPagination) return;
    swiperPagination.innerHTML = '';
    const count = activities.length + 1; // +1 for Add Card

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.className = 'swiper-pagination-bullet';
        if (i === 0) dot.classList.add('swiper-pagination-bullet-active');

        // Optional: Click to scroll
        dot.addEventListener('click', () => {
            const targetCard = swiperContainer.children[i];
            if (targetCard) targetCard.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        });

        swiperPagination.appendChild(dot);
    }
}

function updatePagination(activeIndex) {
    if (!swiperPagination) return;
    const dots = swiperPagination.children;
    for (let i = 0; i < dots.length; i++) {
        if (i === activeIndex) {
            dots[i].classList.add('swiper-pagination-bullet-active');
        } else {
            dots[i].classList.remove('swiper-pagination-bullet-active');
        }
    }
}


function initCat() {
    // Always on left side for easier mobile thumb reach
    const side = 'left';

    // Random height: between 30% and 60% from bottom
    // This range is optimal for thumb reach on mobile devices
    const bottomPos = 30 + Math.random() * 30;

    catWrapper.className = `cat-wrapper pos-${side}`;
    catWrapper.style.bottom = `${bottomPos}%`;
}

// Logic: Check-in
function logWorkout() {
    const today = dayjs().format('YYYY-MM-DD');
    const currentActivity = getCurrentActivity();
    const data = currentActivity.data;

    let targetDate = today;
    if (selectedDate) {
        targetDate = selectedDate;
        // Verify it's not future
        if (dayjs(targetDate).isAfter(dayjs(), 'day')) {
            // Should be prevented by UI but safe check
            alert("Cannot check in for future dates!");
            return;
        }
    }

    // Shake animation
    catWrapper.classList.add('shaking');
    setTimeout(() => {
        catWrapper.classList.remove('shaking');
    }, 500);

    // Update Data
    if (!data[targetDate]) {
        data[targetDate] = 1;
    } else {
        data[targetDate]++;
    }

    // Save
    saveData(); // Saves the whole activities array

    // Clear selection
    selectedDate = null;

    // Respawn Cat
    initCat();

    // Re-render Active Card
    const activeCard = document.querySelector(`.activity-card[data-id="${currentActivityId}"]`);
    if (activeCard) {
        updateCardStats(activeCard, currentActivity);
        renderCardHeatmap(activeCard, currentActivity);
    }
}

// Logic: Save to LocalStorage
function saveData() {
    const root = {
        activities: activities,
        currentActivityId: currentActivityId
    };
    localStorage.setItem('activityData', JSON.stringify(root));
}

// --- Helper Functions for Per-Card Rendering ---

function updateCardStats(card, activity) {
    const data = activity.data;
    const today = dayjs();

    // 1. Total
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    const totalEl = card.querySelector('.total-count');
    if (totalEl) totalEl.textContent = total;

    // 2. Streak
    let streak = 0;
    let d = dayjs();
    // Check today first
    if (data[d.format('YYYY-MM-DD')]) {
        streak++;
    }
    // Check previous days
    while (true) {
        d = d.subtract(1, 'day');
        if (data[d.format('YYYY-MM-DD')]) {
            streak++;
        } else {
            break;
        }
    }
    const streakEl = card.querySelector('.current-streak');
    if (streakEl) streakEl.textContent = streak;
}

function renderCardHeatmap(card, activity) {
    const container = card.querySelector('.heatmap-scroll');
    if (!container) return;

    container.innerHTML = '';

    // Check view mode for this activity (default 'day' if not set)
    const mode = activity.viewMode || 'day';

    // Update Toggles UI state
    const toggleDay = card.querySelector('.view-day');
    const toggleMonth = card.querySelector('.view-month');
    if (mode === 'day') {
        toggleDay.classList.add('active');
        toggleMonth.classList.remove('active');
    } else {
        toggleMonth.classList.add('active');
        toggleDay.classList.remove('active');
    }

    // Attach Toggle Listeners
    toggleDay.onclick = () => setCardView(card, activity, 'day');
    toggleMonth.onclick = () => setCardView(card, activity, 'month');

    // Attach Share Listener
    const shareBtn = card.querySelector('.share-btn');
    // shareBtn.onclick = () => exportCardTimeline(card, activity); 
    // Commented out until exportCardTimeline is defined or refactored.

    // Render Logic
    if (mode === 'day') {
        const currentMonth = dayjs().startOf('month');
        // Render current month plus previous 2
        for (let i = 2; i >= 0; i--) {
            const m = currentMonth.subtract(i, 'month');
            const monthCard = createMonthCard(m, activity.data, (dateStr, cellElement) => {
                handleDateSelection(dateStr, cellElement);
            });
            container.appendChild(monthCard);
        }
        // Scroll to bottom/end
        setTimeout(() => {
            container.scrollLeft = container.scrollWidth;
        }, 10);
    } else {
        // Render Month Grid (Year View) - Show Current + Past 2 Years
        const currentYear = dayjs().year();
        for (let i = 2; i >= 0; i--) {
            const year = currentYear - i;
            const yearCard = createMonthViewCard(year, activity.data);
            container.appendChild(yearCard);
        }
        // Scroll to bottom/end (Current Year)
        // Need requestAnimationFrame or slight timeout for layout to stabilize? 
        // Just setting it immediately usually works if DOM is synchronous, but images/fonts can affect it.
        // Elements are div blocks so it should be fine.
        setTimeout(() => {
            container.scrollLeft = container.scrollWidth;
        }, 10);
    }
}

function setCardView(triggerCard, triggerActivity, mode) {
    // 1. Update Global State
    viewMode = mode;
    activities.forEach(a => a.viewMode = mode);
    saveData();

    // 2. Update UI for ALL cards
    const allCards = document.querySelectorAll('.activity-card');
    allCards.forEach(card => {
        const id = card.dataset.id;
        if (id) { // Skip "New Activity" card which has no ID
            const activity = activities.find(a => a.id === id);
            if (activity) {
                renderCardHeatmap(card, activity);
            }
        }
    });
}



function createMonthCard(monthStart, dataMap, onDateClick) {
    const card = document.createElement('div');
    card.className = 'view-card';

    const title = document.createElement('div');
    title.className = 'view-title';
    title.textContent = monthStart.format('MMMM YYYY');
    card.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Headers
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'calendar-header';
        h.textContent = d;
        grid.appendChild(h);
    });

    const startDay = (monthStart.day() + 6) % 7;
    const prevMonth = monthStart.subtract(1, 'month');
    const prevDaysInMonth = prevMonth.daysInMonth();
    const prevStartDay = (prevMonth.day() + 6) % 7;
    const prevTotalSlots = prevStartDay + prevDaysInMonth;
    const prevHasOverflow = prevTotalSlots > 35;

    // Leading slots
    for (let i = 0; i < startDay; i++) {
        const dayNum = prevDaysInMonth - (startDay - 1 - i);
        const prevSlotIndex = prevStartDay + (dayNum - 1);

        if (prevHasOverflow && prevSlotIndex >= 35) {
            const date = prevMonth.date(dayNum);
            const dateStr = date.format('YYYY-MM-DD');
            const count = dataMap[dateStr] || 0;
            const level = getLevel(count, 'day');

            const cell = document.createElement('div');
            cell.className = 'calendar-cell prev-month';
            cell.textContent = dayNum;
            cell.dataset.level = level;
            grid.appendChild(cell);
        } else {
            const empty = document.createElement('div');
            empty.className = 'calendar-cell empty';
            grid.appendChild(empty);
        }
    }

    const daysInMonth = monthStart.daysInMonth();
    const todayStr = dayjs().format('YYYY-MM-DD');
    const maxDaysToRender = Math.min(daysInMonth, 35 - startDay);

    for (let d = 1; d <= maxDaysToRender; d++) {
        const date = monthStart.date(d);
        const dateStr = date.format('YYYY-MM-DD');
        const count = dataMap[dateStr] || 0;

        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = d;
        cell.dataset.level = getLevel(count, 'day');
        if (dateStr === todayStr) cell.style.border = '1px solid var(--accent-color)';

        // Add click listener for retroactive check-in
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', (e) => {
            if (onDateClick) onDateClick(dateStr, e.target);
        });

        grid.appendChild(cell);
    }

    // Fill remaining
    const totalDayCells = startDay + maxDaysToRender;
    const remainingSlots = 35 - totalDayCells;
    for (let i = 0; i < remainingSlots; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-cell empty';
        grid.appendChild(empty);
    }

    card.appendChild(grid);
    return card;
}

function handleDateSelection(dateStr, cellElement) {
    // 1. Check if future
    if (dayjs(dateStr).isAfter(dayjs(), 'day')) {
        alert("Cannot check in for future dates!");
        return;
    }

    // 2. Toggle Selection
    if (selectedDate === dateStr) {
        // Deselect
        selectedDate = null;
        cellElement.classList.remove('selected');
    } else {
        // Select new
        selectedDate = dateStr;

        // Remove 'selected' from all other cells
        document.querySelectorAll('.calendar-cell.selected').forEach(el => el.classList.remove('selected'));

        // Add to clicked
        cellElement.classList.add('selected');
    }
}


function createMonthViewCard(year, dataMap) {
    const card = document.createElement('div');
    card.className = 'view-card';

    const title = document.createElement('div');
    title.className = 'view-title';
    title.textContent = year;
    card.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'month-grid';

    for (let m = 0; m < 12; m++) {
        const col = document.createElement('div');
        col.className = 'month-column';

        const monthStart = dayjs(`${year}-${m + 1}-01`);
        const label = document.createElement('div');
        label.className = 'month-label';
        label.textContent = monthStart.format('MMM');
        col.appendChild(label);

        const daysInMonth = monthStart.daysInMonth();

        const chunks = [
            { s: 1, e: 7 }, { s: 8, e: 14 }, { s: 15, e: 21 }, { s: 22, e: 28 }, { s: 29, e: 31 }
        ];

        chunks.forEach(chunk => {
            const cell = document.createElement('div');
            cell.className = 'week-cell';

            if (chunk.s > daysInMonth) {
                // Render empty filler cell
                cell.dataset.level = 0;
                cell.style.opacity = '0.3'; // Optional: make it look "deactivated"
            } else {
                let weekCount = 0;
                let end = Math.min(chunk.e, daysInMonth);
                for (let d = chunk.s; d <= end; d++) {
                    const ds = monthStart.date(d).format('YYYY-MM-DD');
                    weekCount += (dataMap[ds] || 0); // FIXED: use dataMap
                }
                cell.dataset.level = getLevel(weekCount, 'week');
                cell.title = `${monthStart.format('MMM')} W${Math.ceil(chunk.s / 7)}: ${weekCount}`;
            }
            col.appendChild(cell);
        });

        grid.appendChild(col);
    }

    card.appendChild(grid);
    return card;
}

function scrollToEnd() {
    setTimeout(() => {
        if (heatmapContainer) heatmapContainer.scrollLeft = heatmapContainer.scrollWidth;
    }, 0);
}

function updateLegend(mode) {
    // Optional: Update legend text if needed
}

function getLevel(count, mode) {
    if (count === 0) return 0;

    if (mode === 'day') {
        if (count <= 1) return 1;
        if (count <= 3) return 2;
        if (count <= 6) return 3;
        return 4;
    } else { // Week
        // Weekly thresholds
        if (count <= 2) return 1;
        if (count <= 5) return 2;
        if (count <= 10) return 3;
        return 4;
    }
}


function setView(mode) {
    if (viewMode === mode) return;
    viewMode = mode;

    if (mode === 'day') {
        viewToggleDay.classList.add('active');
        viewToggleMonth.classList.remove('active');
    } else {
        viewToggleMonth.classList.add('active');
        viewToggleDay.classList.remove('active');
    }

    renderHeatmap();
}


// Export Logic
function exportCardTimeline(card, activity) {
    const shareBtn = card.querySelector('.share-btn');
    if (!shareBtn) return;

    const originalIcon = shareBtn.innerHTML;
    // Loading Spinner
    shareBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
    shareBtn.style.opacity = '0.7';

    // Target the specific activity card for capture
    // visual tweak: We might want to capture just the card content.
    html2canvas(card, {
        backgroundColor: '#0f172a',
        scale: 2,
        onclone: (clonedDoc) => {
            const clonedCard = clonedDoc.querySelector(`[data-id="${activity.id}"]`);
            if (clonedCard) {
                // Layout Cleanups for Share Image

                // Hide Header Controls (Toggle, Share Btn) inside THIS card
                const header = clonedCard.querySelector('.heatmap-header');
                if (header) header.style.display = 'none';

                // Adjust Styles for Snapshot
                clonedCard.style.padding = '24px';
                clonedCard.style.width = 'auto';
                clonedCard.style.maxWidth = '480px';
                clonedCard.style.height = 'auto'; // Hug content
                clonedCard.style.border = 'none'; // Optional
                clonedCard.style.background = '#0f172a';

                // Ensure heatmap-scroll is fully expanded? 
                // It might need overflow: visible
                const scroll = clonedCard.querySelector('.heatmap-scroll');
                if (scroll) {
                    scroll.style.overflow = 'visible';
                    scroll.style.height = 'auto';
                }
            }
        },
        ignoreElements: (element) => {
            // Exclude "New Activity" button if somehow visible? No.
            // Exclude Cat? The cat is outside the card in `cat-wrapper`, so it won't be captured if we capture `card`.
            // Perfect.
            return false;
        }
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${activity.name.replace(/\s+/g, '-').toLowerCase()}-${dayjs().format('YYYYMMDD')}.png`;
        link.href = canvas.toDataURL();
        link.click();

        shareBtn.innerHTML = originalIcon;
        shareBtn.style.opacity = '1';
    }).catch(err => {
        console.error(err);
        shareBtn.innerHTML = originalIcon;
        shareBtn.style.opacity = '1';
        alert('Failed to generate image');
    });
}

// Run
init();
