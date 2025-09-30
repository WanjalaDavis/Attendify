// student.js - Professional Student Portal JavaScript

// ===== GLOBAL VARIABLES =====
let currentTab = 'classes';
let qrScanner = null;
let selectedClassId = null;
let countdownTimers = {};
let videoStream = null;

// ===== DOCUMENT READY =====
document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
    setupEventListeners();
    startCountdownTimers();
    loadOngoingClasses();
});

// ===== PORTAL INITIALIZATION =====
function initializePortal() {
    console.log('🚀 Initializing Attendify Student Portal...');
    
    // Set current tab from URL hash if present
    const hash = window.location.hash.substring(1);
    if (hash && ['classes', 'attendance', 'units', 'analytics'].includes(hash)) {
        showTab(hash);
    }
    
    // Update user welcome time
    updateWelcomeTime();
    
    // Initialize analytics charts
    initializeAnalytics();
    
    // Check for ongoing classes
    checkOngoingClasses();
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            showTab(tabName);
        });
    });
    
    // QR Scanner controls
    document.getElementById('start-scanner')?.addEventListener('click', startQRScanner);
    document.getElementById('upload-qr')?.addEventListener('click', triggerQRUpload);
    document.getElementById('qr-file-input')?.addEventListener('change', handleQRUpload);
    document.getElementById('qr-token-form')?.addEventListener('submit', handleManualTokenSubmit);
    
    // Unit attendance views
    document.querySelectorAll('.view-attendance').forEach(button => {
        button.addEventListener('click', function() {
            const unitId = this.getAttribute('data-unit-id');
            showUnitDetails(unitId);
        });
    });
    
    // Class selection for QR scanning
    document.addEventListener('click', function(e) {
        if (e.target.closest('.ongoing-class-item')) {
            const classItem = e.target.closest('.ongoing-class-item');
            selectClassForQR(classItem);
        }
    });
    
    // Real-time updates
    setInterval(updateRealTimeData, 30000); // Update every 30 seconds
    setInterval(updateCountdownTimers, 1000); // Update countdown every second
    
    // Window events
    window.addEventListener('beforeunload', cleanupScanner);
    window.addEventListener('hashchange', handleHashChange);
}

// ===== TAB MANAGEMENT =====
function showTab(tabName) {
    // Update URL hash
    window.location.hash = tabName;
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
        
        // Add active class to corresponding tab button
        const targetTabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetTabButton) {
            targetTabButton.classList.add('active');
        }
        
        // Tab-specific initializations
        switch(tabName) {
            case 'attendance':
                initializeAttendanceTab();
                break;
            case 'analytics':
                initializeAnalyticsTab();
                break;
            case 'units':
                initializeUnitsTab();
                break;
        }
        
        currentTab = tabName;
        
        // Log tab change for analytics
        logTabChange(tabName);
    }
}

function handleHashChange() {
    const hash = window.location.hash.substring(1);
    if (hash && hash !== currentTab) {
        showTab(hash);
    }
}

// ===== TIME AND COUNTDOWN FUNCTIONS =====
function updateWelcomeTime() {
    const welcomeElement = document.querySelector('.welcome-content h2');
    if (welcomeElement) {
        const hour = new Date().getHours();
        let greeting = 'Welcome back';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';
        
        const userName = welcomeElement.textContent.split(', ')[1] || '';
        welcomeElement.textContent = `${greeting}, ${userName}`;
    }
}

function startCountdownTimers() {
    document.querySelectorAll('.class-card[data-start-time]').forEach(card => {
        const classId = card.getAttribute('data-class-id');
        const startTime = card.getAttribute('data-start-time');
        const endTime = card.getAttribute('data-end-time');
        
        if (classId && startTime) {
            updateClassCountdown(classId, startTime, endTime);
            countdownTimers[classId] = setInterval(() => {
                updateClassCountdown(classId, startTime, endTime);
            }, 1000);
        }
    });
}

function updateCountdownTimers() {
    Object.keys(countdownTimers).forEach(classId => {
        const card = document.querySelector(`[data-class-id="${classId}"]`);
        if (card) {
            const startTime = card.getAttribute('data-start-time');
            const endTime = card.getAttribute('data-end-time');
            updateClassCountdown(classId, startTime, endTime);
        }
    });
}

function updateClassCountdown(classId, startTime, endTime) {
    const now = new Date();
    const start = new Date(`${now.toDateString()} ${startTime}`);
    const end = new Date(`${now.toDateString()} ${endTime}`);
    
    const countdownElement = document.getElementById(`countdown-${classId}`);
    if (!countdownElement) return;
    
    if (now < start) {
        // Class hasn't started yet
        const diff = start - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        countdownElement.innerHTML = `Starts in ${hours}h ${minutes}m`;
        countdownElement.className = 'countdown-timer upcoming';
    } else if (now >= start && now <= end) {
        // Class is ongoing
        const diff = end - now;
        const minutes = Math.floor(diff / (1000 * 60));
        
        countdownElement.innerHTML = `${minutes}m remaining`;
        countdownElement.className = 'countdown-timer ongoing';
        
        // Update class status to ongoing
        const classCard = document.querySelector(`[data-class-id="${classId}"]`);
        if (classCard && !classCard.classList.contains('ongoing')) {
            classCard.classList.remove('upcoming');
            classCard.classList.add('ongoing');
            
            // Update status badge and button
            const statusBadge = classCard.querySelector('.status-badge');
            const actionButton = classCard.querySelector('.btn-primary');
            
            if (statusBadge) {
                statusBadge.textContent = 'LIVE';
                statusBadge.className = 'status-badge live';
            }
            
            if (actionButton) {
                actionButton.textContent = 'Scan QR';
                actionButton.onclick = () => showTab('attendance');
            }
            
            // Reload ongoing classes for QR scanner
            loadOngoingClasses();
        }
    } else {
        // Class has ended
        countdownElement.innerHTML = 'Class ended';
        countdownElement.className = 'countdown-timer ended';
        clearInterval(countdownTimers[classId]);
        delete countdownTimers[classId];
    }
}

// ===== ATTENDANCE TAB FUNCTIONS =====
function initializeAttendanceTab() {
    console.log('📱 Initializing attendance tab...');
    loadOngoingClasses();
    updateScannerStatus('Select a class to begin scanning');
}

function loadOngoingClasses() {
    const ongoingList = document.getElementById('ongoing-classes-list');
    if (!ongoingList) return;
    
    // Get all ongoing classes from the page
    const ongoingClasses = document.querySelectorAll('.class-card.ongoing');
    
    if (ongoingClasses.length === 0) {
        ongoingList.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-clock"></i>
                <p>No ongoing classes available</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    ongoingClasses.forEach(classCard => {
        const classId = classCard.getAttribute('data-class-id');
        const unitName = classCard.querySelector('h4')?.textContent || 'Unknown Unit';
        const unitCode = classCard.querySelector('.class-meta')?.textContent.split('|')[0]?.trim() || '';
        const time = classCard.querySelector('.time')?.textContent || '';
        const venue = classCard.querySelector('.class-meta')?.textContent.split('|')[1]?.trim() || '';
        
        html += `
            <div class="ongoing-class-item ${selectedClassId === classId ? 'selected' : ''}" 
                 data-class-id="${classId}">
                <div class="class-info">
                    <strong>${unitCode}</strong>
                    <span>${unitName}</span>
                    <small>${time} | ${venue}</small>
                </div>
                <div class="class-action">
                    <button class="btn-primary small">Select</button>
                </div>
            </div>
        `;
    });
    
    ongoingList.innerHTML = html;
}

function selectClassForQR(classItem) {
    const classId = classItem.getAttribute('data-class-id');
    
    // Update selected state
    document.querySelectorAll('.ongoing-class-item').forEach(item => {
        item.classList.remove('selected');
    });
    classItem.classList.add('selected');
    
    selectedClassId = classId;
    
    // Update selected class info
    updateSelectedClassInfo(classId);
    
    // Enable manual token input
    const tokenInput = document.getElementById('qr-token-input');
    const submitButton = document.getElementById('submit-token-btn');
    const tokenStatus = document.getElementById('token-input-status');
    
    if (tokenInput && submitButton && tokenStatus) {
        tokenInput.disabled = false;
        submitButton.disabled = false;
        tokenStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Ready for token input</span>';
        tokenStatus.style.color = 'var(--success)';
    }
    
    updateScannerStatus('Class selected. Ready to scan QR code.');
}

function updateSelectedClassInfo(classId) {
    const classCard = document.querySelector(`[data-class-id="${classId}"]`);
    const infoContainer = document.getElementById('selected-class-info');
    
    if (!classCard || !infoContainer) return;
    
    const unitName = classCard.querySelector('h4')?.textContent || 'Unknown Unit';
    const unitCode = classCard.querySelector('.class-meta')?.textContent.split('|')[0]?.trim() || '';
    const time = classCard.querySelector('.time')?.textContent || '';
    const venue = classCard.querySelector('.class-meta')?.textContent.split('|')[1]?.trim() || '';
    
    document.getElementById('selected-class-name').textContent = `${unitCode} - ${unitName}`;
    document.getElementById('selected-class-time').textContent = time;
    document.getElementById('selected-class-venue').textContent = venue;
    
    infoContainer.style.display = 'block';
    
    // Update time remaining
    updateTimeRemaining(classId);
}

function updateTimeRemaining(classId) {
    const classCard = document.querySelector(`[data-class-id="${classId}"]`);
    if (!classCard) return;
    
    const endTime = classCard.getAttribute('data-end-time');
    const now = new Date();
    const end = new Date(`${now.toDateString()} ${endTime}`);
    
    const diff = end - now;
    const minutes = Math.max(0, Math.floor(diff / (1000 * 60)));
    
    const remainingElement = document.getElementById('remaining-time-text');
    if (remainingElement) {
        remainingElement.textContent = `${minutes} minutes remaining`;
        
        if (minutes < 5) {
            remainingElement.style.color = 'var(--error)';
        } else if (minutes < 15) {
            remainingElement.style.color = 'var(--warning)';
        } else {
            remainingElement.style.color = 'var(--success)';
        }
    }
}

// ===== QR SCANNER FUNCTIONS =====
async function startQRScanner() {
    if (!selectedClassId) {
        showNotification('Please select a class first', 'error');
        return;
    }
    
    const scannerFrame = document.querySelector('.scanner-frame');
    const startButton = document.getElementById('start-scanner');
    
    try {
        // Request camera permission
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        const video = document.getElementById('qr-video');
        const canvas = document.getElementById('qr-canvas');
        
        if (video && canvas) {
            video.srcObject = videoStream;
            video.style.display = 'block';
            
            await video.play();
            
            // Initialize QR Scanner
            qrScanner = new QrScanner(
                video,
                result => handleQRScanResult(result),
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    maxScansPerSecond: 2
                }
            );
            
            await qrScanner.start();
            
            // Update UI
            scannerFrame.classList.add('scanning');
            startButton.innerHTML = '<i class="fas fa-stop"></i> STOP SCANNING';
            startButton.onclick = stopQRScanner;
            
            updateScannerStatus('Scanning for QR codes...');
            showNotification('QR scanner started successfully', 'success');
            
        } else {
            throw new Error('QR scanner elements not found');
        }
        
    } catch (error) {
        console.error('Error starting QR scanner:', error);
        showNotification('Failed to start camera: ' + error.message, 'error');
        stopQRScanner();
    }
}

function stopQRScanner() {
    if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
        qrScanner = null;
    }
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const scannerFrame = document.querySelector('.scanner-frame');
    const startButton = document.getElementById('start-scanner');
    
    if (video) video.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (scannerFrame) scannerFrame.classList.remove('scanning');
    
    if (startButton) {
        startButton.innerHTML = '<i class="fas fa-camera"></i> START CAMERA SCAN';
        startButton.onclick = startQRScanner;
    }
    
    updateScannerStatus('Scanner stopped');
}

function handleQRScanResult(result) {
    console.log('QR Code detected:', result);
    
    // Stop scanner after successful detection
    stopQRScanner();
    
    // Process the QR code data
    processQRData(result.data);
}

function triggerQRUpload() {
    document.getElementById('qr-file-input').click();
}

function handleQRUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!selectedClassId) {
        showNotification('Please select a class first', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Use QR scanner to decode the image
        QrScanner.scanImage(e.target.result)
            .then(result => {
                processQRData(result);
            })
            .catch(error => {
                console.error('QR scan error:', error);
                showNotification('Failed to read QR code from image', 'error');
            });
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    event.target.value = '';
}

function handleManualTokenSubmit(event) {
    event.preventDefault();
    
    if (!selectedClassId) {
        showNotification('Please select a class first', 'error');
        return;
    }
    
    const tokenInput = document.getElementById('qr-token-input');
    const token = tokenInput.value.trim();
    
    if (!token) {
        showNotification('Please enter a token', 'error');
        return;
    }
    
    processQRData(token);
}

function processQRData(qrData) {
    if (!selectedClassId) {
        showNotification('No class selected', 'error');
        return;
    }
    
    updateScannerStatus('Processing QR code...');
    
    // Simulate API call to submit attendance
    simulateAttendanceSubmission(qrData, selectedClassId)
        .then(response => {
            showNotification('Attendance recorded successfully!', 'success');
            updateScannerStatus('Attendance recorded');
            
            // Reset form
            const tokenInput = document.getElementById('qr-token-input');
            if (tokenInput) tokenInput.value = '';
            
            // Update recent attendance
            updateRecentAttendance();
            
            // Refresh analytics
            if (currentTab === 'analytics') {
                initializeAnalyticsTab();
            }
        })
        .catch(error => {
            console.error('Attendance submission error:', error);
            showNotification('Failed to record attendance: ' + error.message, 'error');
            updateScannerStatus('Submission failed');
        });
}

function simulateAttendanceSubmission(qrData, classId) {
    return new Promise((resolve, reject) => {
        // Simulate API call delay
        setTimeout(() => {
            // Simulate validation
            if (qrData.length < 5) {
                reject(new Error('Invalid QR code format'));
                return;
            }
            
            // Simulate successful submission
            const response = {
                success: true,
                message: 'Attendance recorded',
                data: {
                    classId: classId,
                    timestamp: new Date().toISOString(),
                    status: 'PRESENT'
                }
            };
            
            resolve(response);
        }, 1500);
    });
}

function updateScannerStatus(message, type = 'info') {
    const statusElement = document.getElementById('scanner-status');
    if (!statusElement) return;
    
    let icon = 'fas fa-info-circle';
    let color = 'var(--primary)';
    
    switch(type) {
        case 'success':
            icon = 'fas fa-check-circle';
            color = 'var(--success)';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            color = 'var(--error)';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            color = 'var(--warning)';
            break;
    }
    
    statusElement.innerHTML = `
        <div class="status-indicator">
            <i class="${icon}" style="color: ${color}"></i>
            <span>${message}</span>
        </div>
    `;
}

// ===== UNITS TAB FUNCTIONS =====
function initializeUnitsTab() {
    console.log('📚 Initializing units tab...');
    // Any unit-specific initializations can go here
}

function showUnitDetails(unitId) {
    // Simulate API call to get unit details
    simulateUnitDetailsFetch(unitId)
        .then(unitData => {
            displayUnitDetails(unitData);
        })
        .catch(error => {
            console.error('Error fetching unit details:', error);
            showNotification('Failed to load unit details', 'error');
        });
}

function simulateUnitDetailsFetch(unitId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const unitData = {
                id: unitId,
                name: 'Advanced Web Development',
                code: 'CS401',
                credits: 4,
                lecturer: 'Dr. Smith',
                semester: 'Spring 2024',
                attendance: {
                    present: 12,
                    total: 15,
                    percentage: 80,
                    trend: [85, 90, 75, 80, 85, 80]
                },
                schedule: [
                    { day: 'Monday', time: '10:00 - 12:00', venue: 'Room 101' },
                    { day: 'Wednesday', time: '14:00 - 16:00', venue: 'Lab A' }
                ]
            };
            resolve(unitData);
        }, 500);
    });
}

function displayUnitDetails(unitData) {
    const detailsCard = document.getElementById('unit-details-card');
    const detailsContent = document.getElementById('unit-details-content');
    
    if (!detailsCard || !detailsContent) return;
    
    const html = `
        <div class="unit-details-header">
            <h4>${unitData.code} - ${unitData.name}</h4>
            <p>${unitData.credits} Credits • ${unitData.lecturer} • ${unitData.semester}</p>
        </div>
        
        <div class="unit-stats-grid">
            <div class="unit-stat-large">
                <div class="stat-value">${unitData.attendance.percentage}%</div>
                <div class="stat-label">Attendance Rate</div>
            </div>
            <div class="unit-stat-large">
                <div class="stat-value">${unitData.attendance.present}/${unitData.attendance.total}</div>
                <div class="stat-label">Classes Attended</div>
            </div>
        </div>
        
        <div class="attendance-trend">
            <h5>Attendance Trend</h5>
            <div class="trend-chart-mini">
                ${unitData.attendance.trend.map(percent => `
                    <div class="trend-bar" style="height: ${percent}%"></div>
                `).join('')}
            </div>
        </div>
        
        <div class="unit-schedule">
            <h5>Class Schedule</h5>
            ${unitData.schedule.map(session => `
                <div class="schedule-item">
                    <i class="fas fa-calendar-day"></i>
                    <span>${session.day}</span>
                    <span>${session.time}</span>
                    <span>${session.venue}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    detailsContent.innerHTML = html;
    detailsCard.style.display = 'block';
    
    // Scroll to details card
    detailsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideUnitDetails() {
    const detailsCard = document.getElementById('unit-details-card');
    if (detailsCard) {
        detailsCard.style.display = 'none';
    }
}

// ===== ANALYTICS TAB FUNCTIONS =====
function initializeAnalyticsTab() {
    console.log('📊 Initializing analytics tab...');
    updateAnalyticsCharts();
    loadAttendanceHistory();
}

function initializeAnalytics() {
    // Initialize any global analytics components
    updateCircleProgress();
}

function updateAnalyticsCharts() {
    updateCircleProgress();
    updateTrendChart();
    updateAttendanceTable();
}

function updateCircleProgress() {
    const progressElements = document.querySelectorAll('.circle-progress');
    progressElements.forEach(element => {
        const percentage = element.getAttribute('data-percentage') || '0';
        element.style.background = `conic-gradient(var(--primary) 0% ${percentage}%, var(--border) 0% 100%)`;
    });
}

function updateTrendChart() {
    // This would typically fetch real data from an API
    console.log('Updating trend chart data...');
}

function updateAttendanceTable() {
    // Refresh attendance table data if needed
    console.log('Updating attendance table...');
}

function loadAttendanceHistory() {
    // Simulate loading attendance history
    console.log('Loading attendance history...');
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.portal-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `portal-notification ${type}`;
    
    let icon = 'fas fa-info-circle';
    switch(type) {
        case 'success':
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            break;
    }
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${icon}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .portal-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--surface);
                border: 1px solid var(--border);
                border-left: 4px solid var(--primary);
                border-radius: var(--radius-md);
                padding: var(--space-md);
                box-shadow: var(--shadow-lg);
                z-index: 1000;
                max-width: 400px;
                animation: slideInRight 0.3s ease-out;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-sm);
            }
            
            .portal-notification.success {
                border-left-color: var(--success);
            }
            
            .portal-notification.error {
                border-left-color: var(--error);
            }
            
            .portal-notification.warning {
                border-left-color: var(--warning);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: var(--space-sm);
                flex: 1;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 4px;
                border-radius: var(--radius-sm);
                transition: var(--transition);
            }
            
            .notification-close:hover {
                background: var(--background);
                color: var(--text-primary);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
    
    return notification;
}

// ===== REAL-TIME UPDATES =====
function updateRealTimeData() {
    // Update any real-time data like ongoing classes, attendance status, etc.
    checkOngoingClasses();
    updateWelcomeTime();
    
    if (currentTab === 'attendance') {
        loadOngoingClasses();
        if (selectedClassId) {
            updateTimeRemaining(selectedClassId);
        }
    }
}

function checkOngoingClasses() {
    const now = new Date();
    const classCards = document.querySelectorAll('.class-card[data-start-time][data-end-time]');
    
    classCards.forEach(card => {
        const startTime = card.getAttribute('data-start-time');
        const endTime = card.getAttribute('data-end-time');
        const start = new Date(`${now.toDateString()} ${startTime}`);
        const end = new Date(`${now.toDateString()} ${endTime}`);
        
        if (now >= start && now <= end && !card.classList.contains('ongoing')) {
            // Class just started
            card.classList.remove('upcoming');
            card.classList.add('ongoing');
            
            // Show notification for new ongoing class
            const unitName = card.querySelector('h4')?.textContent || 'Class';
            showNotification(`${unitName} has started! You can now mark attendance.`, 'info');
            
            // Reload ongoing classes list if on attendance tab
            if (currentTab === 'attendance') {
                loadOngoingClasses();
            }
        }
    });
}

function updateRecentAttendance() {
    // This would typically refresh the recent attendance list from the server
    console.log('Updating recent attendance...');
}

// ===== UTILITY FUNCTIONS =====
function logTabChange(tabName) {
    // Analytics logging for tab changes
    console.log(`Tab changed to: ${tabName}`);
    
    // Could send to analytics service here
    // analytics.track('tab_view', { tab: tabName });
}

function cleanupScanner() {
    stopQRScanner();
    
    // Clear all intervals
    Object.values(countdownTimers).forEach(timer => clearInterval(timer));
    countdownTimers = {};
}

// ===== ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('An unexpected error occurred', 'error');
});

// Make functions globally available for HTML onclick handlers
window.showTab = showTab;
window.hideUnitDetails = hideUnitDetails;

console.log('✅ Attendify Student Portal JavaScript loaded successfully');