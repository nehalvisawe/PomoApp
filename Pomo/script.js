class PomodoroTimer {
    constructor() {
        this.isRunning = false;
        this.currentTime = 0;
        this.totalTime = 25 * 60; // 25 minutes in seconds
        this.sessionType = 'focus'; // 'focus', 'shortBreak', 'longBreak'
        this.sessionCount = 0;
        this.completedSessions = 0;
        this.timer = null;
        
        // Settings
        this.settings = {
            focusTime: 25,
            shortBreak: 5,
            longBreak: 15,
            longBreakInterval: 4,
            soundEnabled: true,
            notificationsEnabled: true
        };

        // Statistics
        this.stats = {
            dailyStats: {},
            totalSessions: 0,
            longestStreak: 0,
            currentStreak: 0
        };

        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadStats();
        this.setupEventListeners();
        this.updateDisplay();
        this.updateStats();
        this.setupKeyboardShortcuts();
        this.requestNotificationPermission();
        this.drawChart();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['pomodoroSettings']);
            if (result.pomodoroSettings) {
                this.settings = { ...this.settings, ...result.pomodoroSettings };
            }
            this.applySettings();
        } catch (error) {
            console.log('Using default settings');
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.sync.set({ pomodoroSettings: this.settings });
        } catch (error) {
            console.log('Settings saved locally');
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.sync.get(['pomodoroStats']);
            if (result.pomodoroStats) {
                this.stats = { ...this.stats, ...result.pomodoroStats };
            }
        } catch (error) {
            console.log('Using default stats');
        }
    }

    async saveStats() {
        try {
            await chrome.storage.sync.set({ pomodoroStats: this.stats });
        } catch (error) {
            console.log('Stats saved locally');
        }
    }

    applySettings() {
        document.getElementById('focusTime').value = this.settings.focusTime;
        document.getElementById('shortBreak').value = this.settings.shortBreak;
        document.getElementById('longBreak').value = this.settings.longBreak;
        document.getElementById('longBreakInterval').value = this.settings.longBreakInterval;
        document.getElementById('soundEnabled').checked = this.settings.soundEnabled;
        document.getElementById('notificationsEnabled').checked = this.settings.notificationsEnabled;
        
        if (this.sessionType === 'focus') {
            this.totalTime = this.settings.focusTime * 60;
            this.currentTime = this.totalTime;
        }
    }

    setupEventListeners() {
        // Timer controls
        document.getElementById('startPauseBtn').addEventListener('click', () => this.toggleTimer());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
        document.getElementById('skipBtn').addEventListener('click', () => this.skipSession());

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const focusTime = parseInt(e.target.dataset.focus);
                const breakTime = parseInt(e.target.dataset.break);
                this.settings.focusTime = focusTime;
                this.settings.shortBreak = breakTime;
                this.applySettings();
                this.resetTimer();
                this.saveSettings();
            });
        });

        // Settings
        document.getElementById('focusTime').addEventListener('change', (e) => {
            this.settings.focusTime = parseInt(e.target.value);
            this.saveSettings();
            if (this.sessionType === 'focus') {
                this.resetTimer();
            }
        });

        document.getElementById('shortBreak').addEventListener('change', (e) => {
            this.settings.shortBreak = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('longBreak').addEventListener('change', (e) => {
            this.settings.longBreak = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('longBreakInterval').addEventListener('change', (e) => {
            this.settings.longBreakInterval = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('soundEnabled').addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('notificationsEnabled').addEventListener('change', (e) => {
            this.settings.notificationsEnabled = e.target.checked;
            this.saveSettings();
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey) {
                if (e.key === 'P') {
                    e.preventDefault();
                    this.toggleTimer();
                } else if (e.key === 'R') {
                    e.preventDefault();
                    this.resetTimer();
                }
            }
        });
    }

    toggleTimer() {
        if (this.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        this.isRunning = true;
        document.getElementById('startPauseBtn').textContent = 'Pause';
        
        this.timer = setInterval(() => {
            this.currentTime--;
            this.updateDisplay();
            
            if (this.currentTime <= 0) {
                this.completeSession();
            }
        }, 1000);
    }

    pauseTimer() {
        this.isRunning = false;
        document.getElementById('startPauseBtn').textContent = 'Start';
        clearInterval(this.timer);
    }

    resetTimer() {
        this.pauseTimer();
        this.setSessionType(this.sessionType);
        this.updateDisplay();
    }

    skipSession() {
        this.completeSession();
    }

    completeSession() {
        this.pauseTimer();
        this.playSound();
        this.showNotification();
        this.updateSessionStats();
        this.showConfetti();
        
        // Move to next session
        if (this.sessionType === 'focus') {
            this.completedSessions++;
            this.stats.currentStreak++;
            
            if (this.completedSessions % this.settings.longBreakInterval === 0) {
                this.setSessionType('longBreak');
            } else {
                this.setSessionType('shortBreak');
            }
        } else {
            this.setSessionType('focus');
        }
        
        this.updateStats();
        this.saveStats();
    }

    setSessionType(type) {
        this.sessionType = type;
        
        switch (type) {
            case 'focus':
                this.totalTime = this.settings.focusTime * 60;
                document.getElementById('sessionType').textContent = 'Focus Time';
                break;
            case 'shortBreak':
                this.totalTime = this.settings.shortBreak * 60;
                document.getElementById('sessionType').textContent = 'Short Break';
                break;
            case 'longBreak':
                this.totalTime = this.settings.longBreak * 60;
                document.getElementById('sessionType').textContent = 'Long Break';
                break;
        }
        
        this.currentTime = this.totalTime;
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timerDisplay').textContent = display;
        
        // Update progress circle
        const progress = ((this.totalTime - this.currentTime) / this.totalTime) * 879.6;
        document.getElementById('progressCircle').style.strokeDashoffset = 879.6 - progress;
        
        // Update document title
        document.title = `${display} - ${this.sessionType === 'focus' ? 'Focus' : 'Break'}`;
    }

    updateStats() {
        const today = new Date().toDateString();
        
        // Update daily stats
        if (!this.stats.dailyStats[today]) {
            this.stats.dailyStats[today] = { sessions: 0, totalTime: 0 };
        }
        
        document.getElementById('sessionsToday').textContent = this.stats.dailyStats[today].sessions;
        document.getElementById('currentStreak').textContent = this.stats.currentStreak;
        document.getElementById('totalSessions').textContent = this.stats.totalSessions;
        document.getElementById('longestStreak').textContent = this.stats.longestStreak;
        
        // Calculate weekly and monthly totals
        const now = new Date();
        let weeklyTotal = 0;
        let monthlyTotal = 0;
        
        for (const [date, data] of Object.entries(this.stats.dailyStats)) {
            const statDate = new Date(date);
            const daysDiff = Math.floor((now - statDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= 7) {
                weeklyTotal += data.totalTime;
            }
            if (daysDiff <= 30) {
                monthlyTotal += data.totalTime;
            }
        }
        
        document.getElementById('weeklyTotal').textContent = Math.floor(weeklyTotal / 60) + 'h';
        document.getElementById('monthlyTotal').textContent = Math.floor(monthlyTotal / 60) + 'h';
        
        const totalMinutes = this.stats.dailyStats[today]?.totalTime || 0;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        document.getElementById('totalTime').textContent = `${hours}h ${minutes}m`;
    }

    updateSessionStats() {
        const today = new Date().toDateString();
        
        if (!this.stats.dailyStats[today]) {
            this.stats.dailyStats[today] = { sessions: 0, totalTime: 0 };
        }
        
        if (this.sessionType === 'focus') {
            this.stats.dailyStats[today].sessions++;
            this.stats.dailyStats[today].totalTime += this.settings.focusTime;
            this.stats.totalSessions++;
            
            if (this.stats.currentStreak > this.stats.longestStreak) {
                this.stats.longestStreak = this.stats.currentStreak;
            }
        }
    }

    playSound() {
        if (this.settings.soundEnabled) {
            const audio = document.getElementById('completionSound');
            audio.play().catch(e => console.log('Could not play sound'));
        }
    }

    showNotification() {
        if (this.settings.notificationsEnabled && 'Notification' in window) {
            const title = this.sessionType === 'focus' ? 'Focus session completed!' : 'Break time over!';
            const body = this.sessionType === 'focus' ? 'Great job! Time for a break.' : 'Ready to focus again?';
            
            new Notification(title, {
                body: body,
                icon: 'icon48.png'
            });
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    showConfetti() {
        if (this.sessionType === 'focus' && this.completedSessions % 4 === 0) {
            this.createConfetti();
        }
    }

    createConfetti() {
        const container = document.getElementById('confetti-container');
        const colors = ['#4382ec', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 2 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
            
            container.appendChild(confetti);
            
            setTimeout(() => {
                container.removeChild(confetti);
            }, 5000);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        if (tabName === 'stats') {
            setTimeout(() => this.drawChart(), 100);
        }
    }

    drawChart() {
        const canvas = document.getElementById('dailyChart');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Get last 7 days of data
        const days = [];
        const data = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateString = date.toDateString();
            const dayName = date.toLocaleDateString('en', { weekday: 'short' });
            
            days.push(dayName);
            data.push(this.stats.dailyStats[dateString]?.totalTime || 0);
        }
        
        // Chart dimensions
        const padding = 60;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;
        const maxValue = Math.max(...data, 60); // At least 1 hour scale
        const barWidth = chartWidth / days.length;
        
        // Draw bars
        ctx.fillStyle = '#4382ec';
        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * chartHeight;
            const x = padding + index * barWidth + barWidth * 0.2;
            const y = padding + chartHeight - barHeight;
            const width = barWidth * 0.6;
            
            ctx.fillRect(x, y, width, barHeight);
            
            // Draw value labels
            ctx.fillStyle = '#1b3041';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            const hours = Math.floor(value / 60);
            const minutes = value % 60;
            const label = value > 0 ? `${hours}h${minutes > 0 ? minutes + 'm' : ''}` : '0';
            ctx.fillText(label, x + width / 2, y - 5);
            
            // Draw day labels
            ctx.fillText(days[index], x + width / 2, padding + chartHeight + 20);
            
            ctx.fillStyle = '#4382ec';
        });
        
        // Draw axes
        ctx.strokeStyle = '#e2eeff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = '#1b3041';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const value = (maxValue / 4) * i;
            const y = padding + chartHeight - (i / 4) * chartHeight;
            ctx.fillText(Math.floor(value / 60) + 'h', padding - 10, y + 4);
        }
    }
}

// Initialize the timer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});