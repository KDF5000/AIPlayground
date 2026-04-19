const dayjs = require('../../utils/dayjs.min.js');

Page({
    data: {
        activities: [],
        currentActivityId: null,
        swiperIndex: 0,
        addModalVisible: false,
        newActivityName: '',
        swiperHeight: 500,
        selectedDate: null,
        catStyle: '',
        catClass: 'pos-left',
        isShaking: false,
    },

    onLoad() {
        wx.showShareMenu({ menus: ['shareAppMessage'] });
        this.initData();
        this.initCat();
    },

    // --- Data Init & Persistence ---

    initData() {
        const storedData = wx.getStorageSync('activityData');
        let activities = [];
        let currentActivityId = null;

        if (storedData && storedData.activities) {
            activities = storedData.activities;
            currentActivityId = storedData.currentActivityId || (activities[0] ? activities[0].id : null);
        }

        if (activities.length === 0) {
            const defaultAct = this.createNewActivityObject('Activity Tracker');
            activities = [defaultAct];
            currentActivityId = defaultAct.id;
            this.saveData(activities, currentActivityId);
        }

        const processed = activities.map(a => this.processActivity(a));
        const currentIndex = processed.findIndex(a => a.id === currentActivityId);

        this.setData({
            activities: processed,
            currentActivityId,
            swiperIndex: Math.max(0, currentIndex),
        }, () => {
            wx.nextTick(() => this.updateSwiperHeight());
        });
    },

    saveData(activities, currentId) {
        wx.setStorageSync('activityData', {
            activities: activities.map(a => ({
                id: a.id,
                name: a.name,
                created_at: a.created_at,
                data: a.data,
                viewMode: a.viewMode,
            })),
            currentActivityId: currentId,
        });
    },

    createNewActivityObject(name) {
        return {
            id: 'act_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
            name,
            created_at: Date.now(),
            data: {},
            viewMode: 'day',
        };
    },

    // --- Data Processing ---

    processActivity(activity) {
        const data = activity.data || {};
        const totalCheckins = Object.values(data).reduce((sum, n) => sum + n, 0);
        const daysActive = Object.keys(data).length;
        const viewMode = activity.viewMode || 'day';

        const heatmapData = viewMode === 'day'
            ? { type: 'day', months: this.generateDayViewGrids(data) }
            : { type: 'month', years: this.generateMonthViewGrids(data) };

        return { ...activity, stats: { total: totalCheckins, days: daysActive }, heatmap: heatmapData, viewMode };
    },

    generateDayViewGrids(dataMap) {
        const currentMonth = dayjs().startOf('month');
        // 12 months (1 year) with paging scroll
        return Array.from({ length: 12 }, (_, i) =>
            this.buildMonthGrid(currentMonth.subtract(11 - i, 'month'), dataMap)
        );
    },

    buildMonthGrid(monthStart, dataMap) {
        const daysInMonth = monthStart.daysInMonth();
        const startDay = (monthStart.day() + 6) % 7; // Mon=0
        const todayStr = dayjs().format('YYYY-MM-DD');
        const cells = [];

        // Leading prev-month cells (matches web version logic)
        const prevMonth = monthStart.subtract(1, 'month');
        const prevDaysInMonth = prevMonth.daysInMonth();
        const prevStartDay = (prevMonth.day() + 6) % 7;
        const prevHasOverflow = (prevStartDay + prevDaysInMonth) > 35;

        for (let i = 0; i < startDay; i++) {
            const dayNum = prevDaysInMonth - (startDay - 1 - i);
            const prevSlotIndex = prevStartDay + (dayNum - 1);
            if (prevHasOverflow && prevSlotIndex >= 35) {
                const dateStr = prevMonth.date(dayNum).format('YYYY-MM-DD');
                cells.push({
                    type: 'prev-month', day: dayNum, date: dateStr,
                    level: this.getLevel(dataMap[dateStr] || 0, 'day'), isToday: false,
                });
            } else {
                cells.push({ type: 'empty', day: 0, date: '', level: 0, isToday: false });
            }
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = monthStart.date(d).format('YYYY-MM-DD');
            cells.push({
                type: 'day', day: d, date: dateStr,
                level: this.getLevel(dataMap[dateStr] || 0, 'day'),
                isToday: dateStr === todayStr,
            });
        }

        // Trailing empty cells (pad to 35)
        const remaining = Math.max(0, 35 - cells.length);
        for (let i = 0; i < remaining; i++) {
            cells.push({ type: 'empty', day: 0, date: '', level: 0, isToday: false });
        }

        return { title: monthStart.format('MMMM YYYY'), cells };
    },

    generateMonthViewGrids(dataMap) {
        const currentYear = dayjs().year();
        return [2, 1, 0].map(i => ({
            title: String(currentYear - i),
            columns: this.buildYearColumns(currentYear - i, dataMap),
        }));
    },

    buildYearColumns(year, dataMap) {
        const chunks = [{ s: 1, e: 7 }, { s: 8, e: 14 }, { s: 15, e: 21 }, { s: 22, e: 28 }, { s: 29, e: 31 }];
        return Array.from({ length: 12 }, (_, m) => {
            const monthStart = dayjs(`${year}-${m + 1}-01`);
            const daysInMonth = monthStart.daysInMonth();
            const weeks = chunks.map(chunk => {
                if (chunk.s > daysInMonth) return { level: 0, opacity: '0.3' };
                let count = 0;
                for (let d = chunk.s; d <= Math.min(chunk.e, daysInMonth); d++) {
                    count += dataMap[monthStart.date(d).format('YYYY-MM-DD')] || 0;
                }
                return { level: this.getLevel(count, 'week'), opacity: '1' };
            });
            return { label: monthStart.format('MMM'), weeks };
        });
    },

    getLevel(count, mode) {
        if (count === 0) return 0;
        if (mode === 'day') {
            if (count <= 1) return 1;
            if (count <= 3) return 2;
            if (count <= 6) return 3;
            return 4;
        }
        if (count <= 2) return 1;
        if (count <= 5) return 2;
        if (count <= 10) return 3;
        return 4;
    },

    // --- Layout ---

    updateSwiperHeight() {
        const idx = this.data.swiperIndex;
        const isAddCard = idx >= this.data.activities.length;
        const cardId = isAddCard ? '#card-new' : `#card-${idx}`;

        wx.createSelectorQuery().in(this).select(cardId).boundingClientRect().exec(res => {
            if (res && res[0] && res[0].height > 0) {
                this.setData({ swiperHeight: res[0].height + 24 });
            }
        });
    },

    // --- Swiper & View ---

    onSwiperChange(e) {
        const idx = e.detail.current;
        const activities = this.data.activities;

        this.setData({ swiperIndex: idx, selectedDate: null });

        if (idx < activities.length) {
            const id = activities[idx].id;
            if (id !== this.data.currentActivityId) {
                this.setData({ currentActivityId: id });
                this.saveData(activities, id);
            }
        }

        wx.nextTick(() => this.updateSwiperHeight());
    },

    toggleViewMode(e) {
        const mode = e.currentTarget.dataset.mode;
        const activityId = e.currentTarget.dataset.id;
        const activities = this.data.activities;
        const index = activities.findIndex(a => a.id === activityId);
        if (index === -1 || activities[index].viewMode === mode) return;

        activities[index] = this.processActivity({ ...activities[index], viewMode: mode });
        this.setData({ activities }, () => {
            wx.nextTick(() => this.updateSwiperHeight());
        });
        this.saveData(activities, this.data.currentActivityId);
    },

    // --- Cat ---

    initCat() {
        const bottom = 30 + Math.random() * 30;
        this.setData({ catStyle: `bottom: ${bottom}%;`, catClass: 'pos-left' });
    },

    onCatTap() {
        const currentId = this.data.currentActivityId;
        const activities = this.data.activities;
        const index = activities.findIndex(a => a.id === currentId);
        if (index === -1) return;

        const targetDate = this.data.selectedDate || dayjs().format('YYYY-MM-DD');
        const isRetro = targetDate !== dayjs().format('YYYY-MM-DD');

        if (dayjs(targetDate).isAfter(dayjs(), 'day')) {
            wx.showToast({ title: 'Cannot check in for future!', icon: 'none' });
            return;
        }

        // Shake animation
        this.setData({ isShaking: true });
        setTimeout(() => this.setData({ isShaking: false }), 500);

        // Update data (copy to avoid direct mutation)
        const activity = { ...activities[index], data: { ...activities[index].data } };
        activity.data[targetDate] = (activity.data[targetDate] || 0) + 1;
        activities[index] = this.processActivity(activity);

        this.setData({ activities, selectedDate: null });
        this.saveData(activities, currentId);
        this.initCat();

        wx.showToast({
            title: isRetro ? `Logged for ${targetDate}` : 'Checked in!',
            icon: 'success',
            duration: 1500,
        });
    },

    // --- Retroactive check-in ---

    onDayTap(e) {
        const date = e.currentTarget.dataset.date;
        if (!date) return;

        if (dayjs(date).isAfter(dayjs(), 'day')) {
            wx.showToast({ title: 'Cannot select future date!', icon: 'none' });
            return;
        }

        // Toggle selection
        if (this.data.selectedDate === date) {
            this.setData({ selectedDate: null });
        } else {
            this.setData({ selectedDate: date });
            wx.showToast({ title: 'Now tap the cat to check in!', icon: 'none', duration: 2000 });
        }
    },

    // --- Add Activity Modal ---

    openAddModal() {
        this.setData({ addModalVisible: true, newActivityName: '' });
    },

    closeAddModal() {
        this.setData({ addModalVisible: false });
    },

    preventBubbling() {},

    onInputName(e) {
        this.setData({ newActivityName: e.detail.value });
    },

    confirmAddActivity() {
        const name = this.data.newActivityName.trim();
        if (!name) return;

        const newAct = this.createNewActivityObject(name);
        const activities = this.data.activities;
        activities.push(this.processActivity(newAct));

        this.setData({
            activities,
            addModalVisible: false,
            currentActivityId: newAct.id,
            swiperIndex: activities.length - 1,
        }, () => {
            wx.nextTick(() => this.updateSwiperHeight());
        });
        this.saveData(activities, newAct.id);
    },

    // --- Share ---

    onShareTap() {
        wx.showToast({ title: 'Tap ··· menu to share', icon: 'none', duration: 2000 });
    },

    onShareAppMessage() {
        const activity = this.data.activities.find(a => a.id === this.data.currentActivityId);
        return {
            title: activity ? `${activity.name} — Activity Tracker` : 'Activity Tracker',
            path: '/pages/index/index',
        };
    },
});
