// Production Configuration with Django URLs - OPTIMIZED VERSION
class StudentDashboard {
    constructor() {
        this.currentLocation = null;
        this.isScanning = false;
        this.selectedClassId = null;
        this.qrScanner = null;
        this.quickQrScanner = null;
        this.attendanceChart = null;
        this.pieChart = null;
        this.attendedClasses = new Set();
        
        this.csrfToken = this.getCSRFToken();
        this.init();
    }

    getCSRFToken() {
        return window.APP_CONFIG?.csrfToken || 
               document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.getElementById('csrfToken')?.value ||
               '';
    }

    async init() {
        console.log('🚀 Initializing Student Dashboard...');
        
        try {
            this.setupEventListeners();
            this.initializeCharts();
            await this.loadInitialData();
            this.delayedQRScannerInit();
            this.startRealTimeClock();
            this.initializeClassRestrictions();
            
            console.log('✅ Student Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.showNotification('Failed to initialize dashboard', 'error');
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        this.addEventListener('#sidebarToggle', 'click', () => this.toggleSidebar());
        
        // Method tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchMethod(e));
        });

        // Class selector
        this.addEventListener('#classSelector', 'change', (e) => this.handleClassSelection(e));

        // Manual token submission
        this.addEventListener('#submit-token', 'click', () => this.submitManualToken());
        this.addEventListener('#tokenInput', 'keypress', (e) => {
            if (e.key === 'Enter') this.submitManualToken();
        });

        // Quick scan modal
        this.addEventListener('#quickScanBtn', 'click', () => this.openQuickScanModal());
        this.addEventListener('#closeQuickScan', 'click', () => this.closeQuickScanModal());

        // Chart controls
        this.addEventListener('#chartPeriod', 'change', (e) => this.updateCharts(e.target.value));
        this.addEventListener('#refreshClasses', 'click', () => this.refreshClasses());
        this.addEventListener('#enableLocation', 'click', () => this.enableLocationBasedAttendance());
        this.addEventListener('#closeNotification', 'click', () => this.hideNotification());
        this.addEventListener('#viewAllUnits', 'click', () => this.viewAllUnits());

        // Global event listeners
        this.setupGlobalEventListeners();
    }

    addEventListener(selector, event, handler) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    setupGlobalEventListeners() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeAllModals();
            }
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAllScanners();
            }
        });
    }

    toggleSidebar() {
        document.querySelector('.sidebar')?.classList.toggle('active');
    }

    initializeClassRestrictions() {
        // Pre-populate attended classes set for faster lookups
        document.querySelectorAll('.schedule-item').forEach(item => {
            const classId = item.dataset.classId;
            const statusElement = item.querySelector('.attendance-status');
            if (statusElement) {
                const status = statusElement.textContent.trim().toUpperCase();
                if (status === 'PRESENT' || status === 'ATTENDED') {
                    this.attendedClasses.add(classId);
                }
            }
        });
        
        this.disableAttendedClasses();
    }

    handleClassSelection(e) {
        this.selectedClassId = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        
        if (!this.selectedClassId) return;

        if (this.isClassAlreadyAttended(this.selectedClassId)) {
            this.showNotification('You have already marked attendance for this class', 'warning');
            this.stopAllScanners();
            e.target.value = '';
            this.selectedClassId = null;
            return;
        }
        
        console.log('Class selected:', this.selectedClassId, selectedOption.text);
        
        // Auto-switch to QR scan method when class is selected
        const scanTab = document.querySelector('.method-tab[data-method="scan"]');
        if (scanTab && !scanTab.classList.contains('active')) {
            scanTab.click();
        }
    }

    initializeCharts() {
        this.initializeAttendanceChart();
        this.initializePieChart();
    }

    initializeAttendanceChart() {
        const ctx = document.getElementById('attendanceChart');
        if (!ctx) return;

        const chartData = this.getChartData();
        
        this.attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Attendance Rate',
                    data: chartData.data,
                    borderColor: '#6C63FF',
                    backgroundColor: 'rgba(108, 99, 255, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6C63FF',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => `Attendance: ${context.parsed.y}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { callback: (value) => value + '%' }
                    }
                }
            }
        });
    }

    getChartData() {
        try {
            const unitsDataElement = document.getElementById('unitsData');
            if (unitsDataElement) {
                const unitsData = JSON.parse(unitsDataElement.textContent);
                if (unitsData.length > 0) {
                    return {
                        labels: unitsData.map(unit => unit.code),
                        data: unitsData.map(unit => unit.attendance_percentage || 75)
                    };
                }
            }
        } catch (e) {
            console.log('Using default chart data');
        }
        
        return {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            data: [75, 82, 78, 85]
        };
    }

    initializePieChart() {
        const ctx = document.getElementById('attendancePieChart');
        if (!ctx) return;

        const { presentCount, absentCount, lateCount } = this.getPieChartData();
        
        this.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Late', 'Absent'],
                datasets: [{
                    data: [presentCount, lateCount, absentCount],
                    backgroundColor: ['#4CAF50', '#FF9800', '#F44336'],
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });

        this.updatePieChartLegend();
    }

    getPieChartData() {
        return {
            presentCount: parseInt('{{ present_count }}') || 12,
            absentCount: parseInt('{{ absent_count }}') || 3,
            lateCount: parseInt('{{ late_count }}') || 2
        };
    }

    updatePieChartLegend() {
        const legendContainer = document.getElementById('pieLegend');
        if (!legendContainer || !this.pieChart) return;

        const data = this.pieChart.data;
        const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
        
        legendContainer.innerHTML = data.labels.map((label, index) => {
            const value = data.datasets[0].data[index];
            const color = data.datasets[0].backgroundColor[index];
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            
            return `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${color}"></span>
                    <span class="legend-label">${label}</span>
                    <span class="legend-value">${value} (${percentage}%)</span>
                </div>
            `;
        }).join('');
    }

    async loadInitialData() {
        try {
            await Promise.allSettled([
                this.loadAttendanceStats(),
                this.loadRecentAttendance()
            ]);
        } catch (error) {
            console.log('Using embedded data from template');
        }
    }

    async loadAttendanceStats() {
        try {
            const url = window.APP_CONFIG?.urls?.attendanceStats;
            if (!url) throw new Error('No URL configured');
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardStats(data);
            }
        } catch (error) {
            console.log('Using embedded data for stats');
        }
    }

    async loadRecentAttendance() {
        try {
            const url = window.APP_CONFIG?.urls?.recentAttendance;
            if (!url) throw new Error('No URL configured');
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                this.updateRecentActivity(data);
            }
        } catch (error) {
            console.log('Using embedded data for recent activity');
        }
    }

    updateDashboardStats(data) {
        console.log('Updated dashboard stats:', data);
    }

    updateRecentActivity(data) {
        console.log('Updated recent activity:', data);
    }

    switchMethod(e) {
        const tab = e.currentTarget;
        const method = tab.dataset.method;
        
        if (!method) return;

        document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.method-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${method}-method`)?.classList.add('active');

        if (method === 'scan' && !this.qrScanner) {
            this.delayedQRScannerInit();
        }
    }

    delayedQRScannerInit() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.initializeQRScanner(), 500);
            });
        } else {
            setTimeout(() => this.initializeQRScanner(), 500);
        }
    }

    initializeQRScanner() {
        const qrReader = document.getElementById('my-qr-reader');
        if (!qrReader || typeof Html5QrcodeScanner === 'undefined') return;

        try {
            qrReader.innerHTML = '';
            this.qrScanner = new Html5QrcodeScanner("my-qr-reader", { 
                fps: 10, 
                qrbox: 250,
                aspectRatio: 1.0
            }, false);
            
            this.qrScanner.render(
                (decodedText) => this.handleScannedQRCode(decodedText),
                (error) => {
                    if (error && !error.includes('NotFoundException')) {
                        console.log('QR Scan error:', error);
                    }
                }
            );
        } catch (error) {
            console.error('QR Scanner initialization failed:', error);
        }
    }

    openQuickScanModal() {
        document.getElementById('quickScanModal')?.classList.add('active');
        this.initializeQuickScanScanner();
    }

    closeQuickScanModal() {
        document.getElementById('quickScanModal')?.classList.remove('active');
        this.stopQuickScanner();
    }

    initializeQuickScanScanner() {
        const qrReader = document.getElementById('quick-qr-reader');
        if (!qrReader) return;

        try {
            qrReader.innerHTML = '';
            this.quickQrScanner = new Html5QrcodeScanner("quick-qr-reader", { 
                fps: 10, 
                qrbox: 250 
            }, false);
            
            this.quickQrScanner.render(
                (decodedText) => {
                    this.handleScannedQRCode(decodedText);
                    this.closeQuickScanModal();
                },
                (error) => {
                    if (error && !error.includes('NotFoundException')) {
                        console.log('Quick scan error:', error);
                    }
                }
            );
        } catch (error) {
            console.error('Quick scan initialization failed:', error);
        }
    }

    async handleScannedQRCode(decodedText) {
        console.log('📷 QR Code scanned:', decodedText);
        
        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'error');
            return;
        }

        if (this.isClassAlreadyAttended(this.selectedClassId)) {
            this.showNotification('You have already marked attendance for this class today', 'warning');
            this.stopAllScanners();
            return;
        }

        this.showNotification('Processing QR code...', 'info');

        try {
            let qrData;
            try {
                qrData = JSON.parse(decodedText);
            } catch (e) {
                qrData = { token: decodedText };
            }

            await this.processQRScan({
                token: qrData.token || decodedText,
                class_id: this.selectedClassId
            });

        } catch (error) {
            console.error('Error handling QR code:', error);
            this.showNotification('Error processing QR code', 'error');
        }
    }

    isClassAlreadyAttended(classId) {
        return this.attendedClasses.has(classId);
    }

    stopAllScanners() {
        this.stopMainScanner();
        this.stopQuickScanner();
        this.disableAttendedClasses();
    }

    stopMainScanner() {
        if (this.qrScanner) {
            this.qrScanner.clear().catch(console.error);
            this.qrScanner = null;
        }
    }

    stopQuickScanner() {
        if (this.quickQrScanner) {
            this.quickQrScanner.clear().catch(console.error);
            this.quickQrScanner = null;
        }
    }

    disableAttendedClasses() {
        const classSelector = document.getElementById('classSelector');
        if (!classSelector) return;
        
        Array.from(classSelector.options).forEach(option => {
            if (option.value && this.isClassAlreadyAttended(option.value)) {
                option.disabled = true;
                option.textContent += ' (Already Attended)';
            }
        });
        
        if (this.selectedClassId && this.isClassAlreadyAttended(this.selectedClassId)) {
            classSelector.value = '';
            this.selectedClassId = null;
        }
    }

    async processQRScan(qrData) {
        if (!qrData.token) {
            this.showNotification('Invalid QR code format', 'error');
            return;
        }

        try {
            const requestData = {
                token: qrData.token,
                class_id: qrData.class_id,
                ...(this.currentLocation || {})
            };

            const scanUrl = window.APP_CONFIG?.urls?.scanQR || '/api/scan-qr/';
            const response = await fetch(scanUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.csrfToken
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                this.handleSuccessfulAttendance(qrData.class_id, result.message);
            } else {
                this.showNotification('❌ ' + (result.message || 'Failed to mark attendance'), 'error');
            }

        } catch (error) {
            console.error('QR scan API error:', error);
            this.showNotification('❌ Network error. Please try again.', 'error');
        }
    }

    handleSuccessfulAttendance(classId, message) {
        this.showNotification('✅ ' + (message || 'Attendance marked successfully!'), 'success');
        this.updateClassAttendance(classId, 'PRESENT');
        this.attendedClasses.add(classId);
        
        this.stopAllScanners();
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }

    async submitManualToken() {
        const tokenInput = document.getElementById('tokenInput');
        const token = tokenInput?.value.trim();

        if (!token) {
            this.showNotification('Please enter a QR token', 'error');
            return;
        }

        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'error');
            return;
        }

        if (this.isClassAlreadyAttended(this.selectedClassId)) {
            this.showNotification('You have already marked attendance for this class today', 'warning');
            tokenInput.value = '';
            return;
        }

        await this.processQRScan({ token, class_id: this.selectedClassId });
        tokenInput.value = '';
    }

    async enableLocationBasedAttendance() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }

        this.showNotification('Requesting location access...', 'info');

        try {
            this.currentLocation = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    }),
                    reject,
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                );
            });

            this.showNotification('📍 Location access enabled', 'success');
        } catch (error) {
            this.handleLocationError(error);
        }
    }

    handleLocationError(error) {
        const messages = {
            [error.TIMEOUT]: 'Location request timeout',
            [error.PERMISSION_DENIED]: 'Location access denied by user',
            [error.POSITION_UNAVAILABLE]: 'Location information unavailable'
        };
        
        this.showNotification('📍 ' + (messages[error.code] || 'Location access denied'), 'warning');
    }

    refreshClasses() {
        this.showNotification('Refreshing class data...', 'info');
        window.location.reload();
    }

    viewAllUnits() {
        this.showNotification('Loading all units...', 'info');
    }

    startRealTimeClock() {
        const updateTime = () => {
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.textContent = new Date().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true 
                });
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    updateClassAttendance(classId, status) {
        const classItem = document.querySelector(`[data-class-id="${classId}"]`);
        const statusElement = classItem?.querySelector('.attendance-status');
        
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `attendance-status status-${status.toLowerCase()}`;
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
        this.stopQuickScanner();
    }

    updateCharts(period) {
        if (!this.attendanceChart) return;

        const { labels, data } = this.getChartDataForPeriod(period);
        this.attendanceChart.data.labels = labels;
        this.attendanceChart.data.datasets[0].data = data;
        this.attendanceChart.update();
    }

    getChartDataForPeriod(period) {
        const data = {
            week: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [85, 92, 78, 95, 88] },
            month: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], data: [82, 88, 85, 92] },
            semester: { labels: ['Jan', 'Feb', 'Mar', 'Apr'], data: [80, 85, 82, 88] }
        };
        
        return data[period] || data.month;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }
        
        const icon = notification.querySelector('i');
        const title = notification.querySelector('.notification-title');
        const messageEl = notification.querySelector('.notification-message');
        
        if (!icon || !title || !messageEl) return;
        
        notification.className = `notification ${type}`;
        title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        messageEl.textContent = message;
        
        const icons = { 
            success: 'fa-check-circle', 
            error: 'fa-exclamation-circle', 
            info: 'fa-info-circle', 
            warning: 'fa-exclamation-triangle' 
        };
        icon.className = `fas ${icons[type] || icons.info}`;
        
        notification.classList.add('show');
        
        setTimeout(() => this.hideNotification(), 5000);
    }

    hideNotification() {
        document.getElementById('notification')?.classList.remove('show');
    }

    cleanup() {
        this.stopAllScanners();
        if (this.attendanceChart) this.attendanceChart.destroy();
        if (this.pieChart) this.pieChart.destroy();
    }
}

// Profile Management Class (FIXED - No duplicate declaration)
class StudentProfileManager {
    constructor() {
        this.csrfToken = window.APP_CONFIG?.csrfToken || 
                        document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                        document.getElementById('csrfToken')?.value;
        this.initEventListeners();
    }

    initEventListeners() {
        // Settings menu
        this.addEventListener('#settingsLink', 'click', (e) => {
            e.preventDefault();
            this.openSettingsMenu();
        });

        // Profile editing
        this.addEventListener('#editProfileOption', 'click', () => this.openProfileModal());
        this.addEventListener('#changePasswordOption', 'click', () => this.openPasswordModal());

        // Close modals
        this.addEventListener('#closeProfileModal', 'click', () => this.closeProfileModal());
        this.addEventListener('#closePasswordModal', 'click', () => this.closePasswordModal());
        this.addEventListener('#closeSettingsMenu', 'click', () => this.closeSettingsMenu());

        // Cancel buttons
        this.addEventListener('#cancelProfile', 'click', () => this.closeProfileModal());
        this.addEventListener('#cancelPassword', 'click', () => this.closePasswordModal());

        // Password visibility toggle
        this.initPasswordToggles();
        this.initFileUpload();
        this.initFormSubmissions();
    }

    addEventListener(selector, event, handler) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    openSettingsMenu() {
        document.getElementById('settingsMenuModal')?.classList.add('active');
    }

    closeSettingsMenu() {
        document.getElementById('settingsMenuModal')?.classList.remove('active');
    }

    openProfileModal() {
        this.closeSettingsMenu();
        document.getElementById('profileModal')?.classList.add('active');
    }

    closeProfileModal() {
        document.getElementById('profileModal')?.classList.remove('active');
    }

    openPasswordModal() {
        this.closeSettingsMenu();
        document.getElementById('passwordModal')?.classList.add('active');
    }

    closePasswordModal() {
        document.getElementById('passwordModal')?.classList.remove('active');
    }

    initPasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const inputGroup = e.target.closest('.input-group');
                if (!inputGroup) return;
                
                const input = inputGroup.querySelector('input');
                const icon = inputGroup.querySelector('.password-toggle i');
                
                if (!input || !icon) return;
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    }

    initFileUpload() {
        const fileInput = document.querySelector('input[name="profile_picture"]');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        this.showNotification('File size must be less than 5MB', 'error');
                        e.target.value = '';
                        return;
                    }

                    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
                    if (!validTypes.includes(file.type)) {
                        this.showNotification('Please select a valid image file (JPG, PNG, GIF)', 'error');
                        e.target.value = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const preview = document.querySelector('.current-avatar');
                        if (preview) {
                            preview.innerHTML = `<img src="${e.target.result}" alt="Profile Preview" class="profile-avatar">`;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    initFormSubmissions() {
        const profileForm = document.getElementById('profileForm');
        const passwordForm = document.getElementById('passwordForm');

        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm(profileForm, 'saveProfile', 'Saving...');
            });
        }

        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm(passwordForm, 'savePassword', 'Changing...');
            });
        }
    }

    async submitForm(form, submitBtnId, loadingText) {
        const submitBtn = document.getElementById(submitBtnId);
        if (!submitBtn) return;

        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        submitBtn.disabled = true;

        try {
            const formData = form.id === 'profileForm' ? new FormData(form) : new FormData(form);
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.csrfToken
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(data.message || 'Operation completed successfully!', 'success');
                if (form.id === 'profileForm') {
                    this.closeProfileModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    this.closePasswordModal();
                    form.reset();
                }
            } else {
                this.showNotification(data.message || 'Operation failed', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }
        
        const icon = notification.querySelector('i');
        const title = notification.querySelector('.notification-title');
        const messageEl = notification.querySelector('.notification-message');
        
        if (!icon || !title || !messageEl) return;
        
        notification.className = `notification ${type}`;
        title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        messageEl.textContent = message;
        
        const icons = { 
            success: 'fa-check-circle', 
            error: 'fa-exclamation-circle', 
            info: 'fa-info-circle', 
            warning: 'fa-exclamation-triangle' 
        };
        icon.className = `fas ${icons[type] || icons.info}`;
        
        notification.classList.add('show');
        
        setTimeout(() => this.hideNotification(), 5000);
    }

    hideNotification() {
        document.getElementById('notification')?.classList.remove('show');
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Student Dashboard
    window.studentDashboard = new StudentDashboard();
    
    // Initialize Profile Manager (with unique class name)
    window.studentProfileManager = new StudentProfileManager();
    
    console.log('🎓 Student Portal initialized successfully!');
});

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.studentDashboard) {
        window.studentDashboard.cleanup();
    }
});

// Handle page visibility changes for better resource management
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.studentDashboard) {
        window.studentDashboard.stopAllScanners();
    }
});