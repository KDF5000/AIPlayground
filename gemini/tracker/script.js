// State
const STORAGE_KEY = 'sports_tracker_data';
let activityData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let viewMode = 'day'; // 'day' or 'month'

// DOM Elements
const totalCountEl = document.getElementById('total-count');
const currentStreakEl = document.getElementById('current-streak');
// const logBtn = document.getElementById('log-btn'); // REMOVED
const catCharacter = document.getElementById('cat-character');
const catWrapper = document.getElementById('cat-wrapper');

const heatmapGrid = document.getElementById('heatmap-grid');
const heatmapContainer = document.querySelector('.heatmap-scroll');
const shareBtn = document.getElementById('share-btn');
// Capture the full app container to include Header + Stats
const captureArea = document.querySelector('.app-container');
const viewToggleDay = document.getElementById('view-day');
const viewToggleYear = document.getElementById('view-year');

// ... (existing code)

function createYearCard(year) {
    // ...
    // Inside the loop:
    const monthStart = dayjs(`${year}-${m + 1}-01`);
    const label = document.createElement('div');
    label.className = 'month-label';
    label.textContent = monthStart.format('MMM');
    col.appendChild(label);

    const daysInMonth = monthStart.daysInMonth(); // FIXED

    const chunks = [
        { s: 1, e: 7 }, { s: 8, e: 14 }, { s: 15, e: 21 }, { s: 22, e: 28 }, { s: 29, e: 31 }
    ];
    // ...
}

// Initialization
function init() {
    renderStats();
    renderHeatmap();
    initCat(); // New: Position the cat
    setupListeners();
}

function initCat() {
    // Random side: 0 = left, 1 = right
    const side = Math.random() < 0.5 ? 'left' : 'right';

    // Random height: between 10% and 40% from bottom (to avoid header)
    const bottomPos = 10 + Math.random() * 30;

    catWrapper.className = `cat-wrapper pos-${side}`;
    catWrapper.style.bottom = `${bottomPos}%`;
}

// Logic: Check-in
function logWorkout() {
    const today = dayjs().format('YYYY-MM-DD');

    // Shake Animation
    catWrapper.classList.add('shaking');
    setTimeout(() => catWrapper.classList.remove('shaking'), 400); // Remove after anim

    // Increment count
    activityData[today] = (activityData[today] || 0) + 1;
    saveData();

    // Update UI
    renderStats();
    renderHeatmap();

    // Optional: Respawn cat elsewhere after check-in?
    setTimeout(initCat, 800);
}

// Logic: Save to LocalStorage
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activityData));
}

// Logic: Rendering Stats
function renderStats() {
    // Total Check-ins
    const total = Object.values(activityData).reduce((sum, count) => sum + count, 0);
    totalCountEl.textContent = total;

    // Current Streak
    let streak = 0;
    let currentDay = dayjs();

    // specific check for today: if logged, streak starts counting, if not, check yesterday
    if (activityData[currentDay.format('YYYY-MM-DD')]) {
        streak++;
        currentDay = currentDay.subtract(1, 'day');
    } else {
        // If not logged today, check yesterday to see if streak is active
        const yesterday = currentDay.subtract(1, 'day');
        if (!activityData[yesterday.format('YYYY-MM-DD')]) {
            streak = 0;
        } else {
            currentDay = yesterday;
        }
    }

    // Iterate backwards
    while (streak > 0 || (streak === 0 && activityData[currentDay.format('YYYY-MM-DD')])) {
        if (activityData[currentDay.format('YYYY-MM-DD')]) {
            if (streak === 0 && !activityData[dayjs().format('YYYY-MM-DD')]) {
                // edge case refactor: simplified loop is better
                streak++;
            } else if (streak > 0) {
                streak++;
            }
        } else {
            break;
        }
        currentDay = currentDay.subtract(1, 'day');
    }

    currentStreakEl.textContent = calculateStreak();
}

function calculateStreak() {
    const dates = Object.keys(activityData).sort();
    if (dates.length === 0) return 0;

    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    let lastDate = dates[dates.length - 1];

    // Streak broken if last entry is not today or yesterday
    if (lastDate !== today && lastDate !== yesterday) return 0;

    let streak = 1; // start with the valid last entry
    let checkDate = dayjs(lastDate).subtract(1, 'day');

    for (let i = dates.length - 2; i >= 0; i--) {
        if (dates[i] === checkDate.format('YYYY-MM-DD')) {
            streak++;
            checkDate = checkDate.subtract(1, 'day');
        } else {
            break;
        }
    }
    return streak;
}


// Logic: Heatmap
function setupListeners() {
    catCharacter.addEventListener('click', logWorkout);
    shareBtn.addEventListener('click', exportTimeline);

    viewToggleDay.addEventListener('click', () => setView('day'));
    viewToggleYear.addEventListener('click', () => setView('year'));

    // Infinite Scroll Listener
    heatmapContainer.addEventListener('scroll', handleScroll);
}

function handleScroll() {
    if (isLoadingHistory) return;

    // Threshold to load more: < 100px from left
    if (heatmapContainer.scrollLeft < 100) {
        isLoadingHistory = true;
        // Small delay to allow scroll interaction to settle slightly or just debounce
        setTimeout(() => {
            prependHistory();
            isLoadingHistory = false;
        }, 50);
    }
}

function renderHeatmap() {
    heatmapContainer.innerHTML = '';
    earliestLoadedMonth = null;
    earliestLoadedYear = null;
    isLoadingHistory = false;

    if (viewMode === 'day') {
        renderCalendarSwiper(true); // true = initial load
        updateLegend('day');
    } else {
        renderYearSwiper(true);
        updateLegend('week');
    }
}

function prependHistory() {
    // Capture old scroll height/width? 
    // Is horizontal, so we need scrollWidth.
    const oldScrollWidth = heatmapContainer.scrollWidth;

    if (viewMode === 'day') {
        renderCalendarSwiper(false); // false = prepend
    } else {
        renderYearSwiper(false);
    }

    // Adjust scroll position to maintain view
    const newScrollWidth = heatmapContainer.scrollWidth;
    heatmapContainer.scrollLeft += (newScrollWidth - oldScrollWidth);
}

function renderCalendarSwiper(isInitial) {
    const monthsLoading = 6; // Load 6 months at a time
    let startMonth;

    if (isInitial) {
        // Initial: Load last 12 months
        startMonth = dayjs().startOf('month');
        // We render backwards from startMonth? No, we render a list.
        // Let's determine the range.
        // Range: [End - 11 months] to [End]
        // But for prepend logic, we track "Earliest Loaded".

        // Initial approach: Render [Today-11mo] ... [Today].
        // Earliest = Today-11mo.

        let current = dayjs().subtract(11, 'month').startOf('month');
        earliestLoadedMonth = current.clone();

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < 12; i++) {
            const card = createMonthCard(current);
            fragment.appendChild(card);
            current = current.add(1, 'month');
        }
        heatmapContainer.appendChild(fragment);
        scrollToEnd();

    } else {
        // Prepend: Load 6 months BEFORE earliestLoadedMonth
        let current = earliestLoadedMonth.subtract(monthsLoading, 'month');
        // Limit? optional.

        // We need to render from (Earliest - 6) to (Earliest - 1)
        const fragment = document.createDocumentFragment();

        earliestLoadedMonth = current.clone(); // Update new earliest

        for (let i = 0; i < monthsLoading; i++) {
            const card = createMonthCard(current);
            fragment.appendChild(card);
            current = current.add(1, 'month');
        }

        // Prepend to container
        heatmapContainer.insertBefore(fragment, heatmapContainer.firstChild);
    }
}

function createMonthCard(monthStart) {
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

    const startDay = (monthStart.day() + 6) % 7; // 0=Mon, 6=Sun

    // Check Previous Month for Overflow
    const prevMonth = monthStart.subtract(1, 'month');
    const prevDaysInMonth = prevMonth.daysInMonth();
    const prevStartDay = (prevMonth.day() + 6) % 7;
    const prevTotalSlots = prevStartDay + prevDaysInMonth;
    const prevHasOverflow = prevTotalSlots > 35; // More than 5 rows (35 slots)

    // Render leading slots (either empty or overflow from prev month)
    for (let i = 0; i < startDay; i++) {
        // Calculate which day of prev month this slot represents
        // The last slot (startDay - 1) is prevMonth last day.
        // The slot (i) is: prevDaysInMonth - (startDay - 1 - i)
        const dayNum = prevDaysInMonth - (startDay - 1 - i);

        // logic: Is this specific day part of the overflow?
        // Overflow days are those with index >= 35 in the PREV month's grid.
        // Prev grid index for dayNum: prevStartDay + (dayNum - 1)
        const prevSlotIndex = prevStartDay + (dayNum - 1);

        if (prevHasOverflow && prevSlotIndex >= 35) {
            // Render this overflow day
            const date = prevMonth.date(dayNum);
            const dateStr = date.format('YYYY-MM-DD');
            const count = activityData[dateStr] || 0;

            const cell = document.createElement('div');
            cell.className = 'calendar-cell prev-month';
            cell.textContent = dayNum;
            cell.dataset.level = getLevel(count, 'day');
            if (dateStr === dayjs().format('YYYY-MM-DD')) {
                cell.style.border = '1px solid var(--accent-color)';
            }
            grid.appendChild(cell);
        } else {
            // Standard empty slot
            const empty = document.createElement('div');
            empty.className = 'calendar-cell empty';
            grid.appendChild(empty);
        }
    }

    const daysInMonth = monthStart.daysInMonth();
    const todayStr = dayjs().format('YYYY-MM-DD');

    for (let d = 1; d <= daysInMonth; d++) {
        // Stop if we exceed 5 rows (35 slots)
        // Current index in THIS grid:
        const currentSlotIndex = startDay + (d - 1);
        if (currentSlotIndex >= 35) break;

        const date = monthStart.date(d);
        const dateStr = date.format('YYYY-MM-DD');
        const count = activityData[dateStr] || 0;

        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = d;
        cell.dataset.level = getLevel(count, 'day');

        if (dateStr === todayStr) {
            cell.style.border = '1px solid var(--accent-color)';
        }

        grid.appendChild(cell);
    }

    card.appendChild(grid);
    return card;
}


function renderYearSwiper(isInitial) {
    const yearsLoading = 3;

    if (isInitial) {
        // Initial: Load last 3 years
        let currentYear = dayjs().year() - 2;
        earliestLoadedYear = currentYear;

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 3; i++) {
            fragment.appendChild(createYearCard(currentYear));
            currentYear++;
        }
        heatmapContainer.appendChild(fragment);
        scrollToEnd();

    } else {
        // Prepend: Load 3 years BEFORE earliest
        let currentYear = earliestLoadedYear - yearsLoading;
        earliestLoadedYear = currentYear; // update

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < yearsLoading; i++) {
            fragment.appendChild(createYearCard(currentYear));
            currentYear++;
        }
        heatmapContainer.insertBefore(fragment, heatmapContainer.firstChild);
    }
}

function createYearCard(year) {
    const card = document.createElement('div');
    card.className = 'view-card';

    const title = document.createElement('div');
    title.className = 'view-title';
    title.textContent = year;
    card.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'year-grid';

    for (let m = 0; m < 12; m++) {
        const col = document.createElement('div');
        col.className = 'year-column';

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
                    weekCount += (activityData[ds] || 0);
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
        viewToggleYear.classList.remove('active');
    } else {
        viewToggleYear.classList.add('active');
        viewToggleDay.classList.remove('active');
    }

    renderHeatmap();
}


function exportTimeline() {
    const originalIcon = shareBtn.innerHTML;
    // Loading State (Spinner)
    shareBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;

    // Add a spin animation style if not present, or just rely on visual change.
    // simpler: just change opacity or color if no CSS animation.
    shareBtn.style.opacity = '0.7';


    html2canvas(captureArea, {
        backgroundColor: '#0f172a', // App background color
        scale: 2, // Higher resolution
        onclone: (clonedDoc) => {
            // Layout Cleanups for Share Image
            const app = clonedDoc.querySelector('.app-container');
            const header = clonedDoc.querySelector('.heatmap-header');

            // Hide the entire heatmap header (Title, Toggles, Share Btn)
            if (header) header.style.display = 'none';

            // Reduce vertical whitespace and ensure consistent padding
            if (app) {
                // IMPORTANT: Override all sizing constraints to "hug" content
                app.style.height = 'auto';
                app.style.minHeight = '0';
                app.style.width = 'auto'; // allow shrinkage
                app.style.maxWidth = '480px';

                // Uniform padding around the content
                app.style.padding = '24px';

                app.style.gap = '16px';
                app.style.justifyContent = 'flex-start';
                app.style.flexGrow = '0';
            }

            // Ensure body allows shrinking
            clonedDoc.body.style.minHeight = '0';
            clonedDoc.body.style.height = 'auto';
            clonedDoc.documentElement.style.height = 'auto';
        },
        ignoreElements: (element) => {
            // Exclude the Cat
            if (element.id === 'cat-wrapper') return true;
            return false;
        }
    }).then(canvas => {
        // Create download link
        const link = document.createElement('a');
        link.download = `my-activity-${dayjs().format('YYYYMMDD')}.png`;
        link.href = canvas.toDataURL();
        link.click();

        // Restore
        shareBtn.innerHTML = originalIcon;
        shareBtn.style.opacity = '1';
    }).catch(err => {
        console.error(err);
        shareBtn.innerHTML = originalIcon; // Restore on error too
        shareBtn.style.opacity = '1';
        alert('Failed to generate image');
    });
}


// Run
init();
