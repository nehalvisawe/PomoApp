// Background script for Chrome extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Pomodoro Timer Extension installed');
    
    // Request notification permission
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Pomodoro Timer',
        message: 'Extension installed successfully!'
    });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === 'start-pause' || command === 'reset') {
        // Send message to active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { command: command });
            }
        });
    }
});

// Handle notifications
chrome.notifications.onClicked.addListener((notificationId) => {
    // Open new tab when notification is clicked
    chrome.tabs.create({ url: 'chrome://newtab/' });
});

// Sync timer state across tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.pomodoroState) {
        // Broadcast state changes to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { 
                    type: 'stateUpdate', 
                    state: changes.pomodoroState.newValue 
                }).catch(() => {
                    // Ignore errors for tabs that don't have content script
                });
            });
        });
    }
});

// Keep service worker alive
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'keepAlive') {
        sendResponse({ status: 'alive' });
    }
});

// Periodic cleanup of old stats (keep last 90 days)
setInterval(async () => {
    try {
        const result = await chrome.storage.sync.get(['pomodoroStats']);
        if (result.pomodoroStats && result.pomodoroStats.dailyStats) {
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            
            const cleanedStats = { ...result.pomodoroStats };
            
            for (const [date, data] of Object.entries(cleanedStats.dailyStats)) {
                if (new Date(date) < cutoffDate) {
                    delete cleanedStats.dailyStats[date];
                }
            }
            
            await chrome.storage.sync.set({ pomodoroStats: cleanedStats });
        }
    } catch (error) {
        console.log('Could not clean up old stats');
    }
}, 24 * 60 * 60 * 1000); // Run once per day