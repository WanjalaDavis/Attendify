// Production Configuration with Django URLs - COMPLETE FIXED VERSION
class StudentDashboard {
    constructor() {
        this.currentLocation = null;
        this.isScanning = false;
        this.selectedClassId = null;
        this.qrScanner = null;
        this.quickQrScanner = null;
        this.attendanceChart = null;
        this.pieChart = null;
        
        // Get CSRF token from global config or fallback
        this.csrfToken = window.APP_CONFIG?.csrfToken || 
                        document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                        document.getElementById('csrfToken')?.value;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing Student Dashboard...');
        console.log('APP_CONFIG:', window.APP_CONFIG); // Debug
        
        this.setupEventListeners();
        this.initializeCharts();
        this.loadInitialData();
        this.delayedQRScannerInit();
        this.startRealTimeClock();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('active');
            });
        }

        // Method tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchMethod(e));
        });

        // Class selector
        const classSelector = document.getElementById('classSelector');
        if (classSelector) {
            classSelector.addEventListener('change', (e) => {
                this.selectedClassId = e.target.value;
                const selectedOption = e.target.options[e.target.selectedIndex];
                console.log('Class selected:', this.selectedClassId, selectedOption.text);
            });
        }

        // Manual token submission
        const submitTokenBtn = document.getElementById('submit-token');
        if (submitTokenBtn) {
            submitTokenBtn.addEventListener('click', () => this.submitManualToken());
            
            // Also allow Enter key in token input
            const tokenInput = document.getElementById('tokenInput');
            if (tokenInput) {
                tokenInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.submitManualToken();
                    }
                });
            }
        }

        // Quick scan modal
        const quickScanBtn = document.getElementById('quickScanBtn');
        if (quickScanBtn) {
            quickScanBtn.addEventListener('click', () => this.openQuickScanModal());
        }

        const closeQuickScan = document.getElementById('closeQuickScan');
        if (closeQuickScan) {
            closeQuickScan.addEventListener('click', () => this.closeQuickScanModal());
        }

        // Chart period selector
        const chartPeriod = document.getElementById('chartPeriod');
        if (chartPeriod) {
            chartPeriod.addEventListener('change', (e) => {
                this.updateCharts(e.target.value);
            });
        }

        // Refresh classes
        const refreshBtn = document.getElementById('refreshClasses');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshClasses());
        }

        // Enable location
        const enableLocationBtn = document.getElementById('enableLocation');
        if (enableLocationBtn) {
            enableLocationBtn.addEventListener('click', () => this.enableLocationBasedAttendance());
        }

        // Notification close
        const closeNotification = document.getElementById('closeNotification');
        if (closeNotification) {
            closeNotification.addEventListener('click', () => this.hideNotification());
        }

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    // Stop any active QR scanners
                    if (this.quickQrScanner) {
                        this.quickQrScanner.clear().catch(error => {
                            console.log('Error clearing quick scanner:', error);
                        });
                        this.quickQrScanner = null;
                    }
                }
            });
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal-overlay');
                modals.forEach(modal => {
                    modal.classList.remove('active');
                });
                // Stop any active QR scanners
                if (this.quickQrScanner) {
                    this.quickQrScanner.clear().catch(error => {
                        console.log('Error clearing quick scanner:', error);
                    });
                    this.quickQrScanner = null;
                }
            }
        });

        console.log('✅ Event listeners setup complete');
    }

    initializeCharts() {
        this.initializeAttendanceChart();
        this.initializePieChart();
    }

    initializeAttendanceChart() {
        const ctx = document.getElementById('attendanceChart');
        if (!ctx) {
            console.log('Attendance chart canvas not found');
            return;
        }

        // Try to get data from embedded JSON or use defaults
        let chartData = [75, 82, 78, 85];
        try {
            const unitsDataElement = document.getElementById('unitsData');
            if (unitsDataElement) {
                const unitsData = JSON.parse(unitsDataElement.textContent);
                if (unitsData.length > 0) {
                    // Use actual attendance percentages from units
                    chartData = unitsData.map(unit => unit.attendance_percentage || 75);
                }
            }
        } catch (e) {
            console.log('Using default chart data');
        }

        this.attendanceChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Attendance Rate',
                    data: chartData,
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
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        callbacks: {
                            label: function(context) {
                                return `Attendance: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    initializePieChart() {
        const ctx = document.getElementById('attendancePieChart');
        if (!ctx) {
            console.log('Pie chart canvas not found');
            return;
        }

        // Get actual data from the page or use defaults
        const presentCount = parseInt('{{ present_count }}') || 12;
        const absentCount = parseInt('{{ absent_count }}') || 3;
        const lateCount = parseInt('{{ late_count }}') || 2;
        
        this.pieChart = new Chart(ctx.getContext('2d'), {
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
                plugins: {
                    legend: { display: false }
                }
            }
        });

        this.updatePieChartLegend();
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
            // Try to load real data from APIs
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
            // Use the URL from global config
            const url = window.APP_CONFIG?.urls?.attendanceStats || '/api/student/attendance-stats/';
            console.log('Loading attendance stats from:', url);
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardStats(data);
                console.log('✅ Attendance stats loaded successfully');
            } else {
                console.log('📊 Using embedded data for stats (API not available)');
            }
        } catch (error) {
            console.log('📊 Using embedded data for stats (Network error)');
        }
    }

    async loadRecentAttendance() {
        try {
            // Use the URL from global config
            const url = window.APP_CONFIG?.urls?.recentAttendance || '/api/student/recent-attendance/';
            console.log('Loading recent attendance from:', url);
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                this.updateRecentActivity(data);
                console.log('✅ Recent attendance loaded successfully');
            } else {
                console.log('📝 Using embedded data for recent activity (API not available)');
            }
        } catch (error) {
            console.log('📝 Using embedded data for recent activity (Network error)');
        }
    }

    updateDashboardStats(data) {
        // Update any dynamic stats if needed
        console.log('Updated dashboard stats:', data);
    }

    updateRecentActivity(data) {
        // Update recent activity if needed
        console.log('Updated recent activity:', data);
    }

    updateCharts(period) {
        // Use sample data for now - implement real API calls later
        let labels, data;
        
        switch(period) {
            case 'week':
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
                data = [85, 92, 78, 95, 88];
                break;
            case 'month':
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                data = [82, 88, 85, 92];
                break;
            case 'semester':
            default:
                labels = ['Jan', 'Feb', 'Mar', 'Apr'];
                data = [80, 85, 82, 88];
                break;
        }

        if (this.attendanceChart) {
            this.attendanceChart.data.labels = labels;
            this.attendanceChart.data.datasets[0].data = data;
            this.attendanceChart.update();
        }
    }

    switchMethod(e) {
        const tab = e.currentTarget;
        const method = tab.dataset.method;
        
        if (!method) return;

        // Update active tab
        document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.method-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const methodContent = document.getElementById(`${method}-method`);
        if (methodContent) {
            methodContent.classList.add('active');
        }

        // If switching to scan method, ensure QR scanner is initialized
        if (method === 'scan' && !this.qrScanner) {
            this.delayedQRScannerInit();
        }
    }

    delayedQRScannerInit() {
        // Wait for DOM to be fully ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.initializeQRScanner(), 1000);
            });
        } else {
            setTimeout(() => this.initializeQRScanner(), 1000);
        }
    }

    initializeQRScanner() {
        const qrReader = document.getElementById('my-qr-reader');
        if (!qrReader) {
            console.log('QR reader element not found');
            return;
        }

        if (typeof Html5QrcodeScanner === 'undefined') {
            console.error('QR Scanner library not loaded');
            this.showNotification('QR scanner library failed to load', 'error');
            return;
        }

        try {
            // Clear any existing content
            qrReader.innerHTML = '';

            this.qrScanner = new Html5QrcodeScanner(
                "my-qr-reader",
                { 
                    fps: 10, 
                    qrbox: 250,
                    aspectRatio: 1.0
                },
                false
            );
            
            this.qrScanner.render(
                (decodedText) => this.handleScannedQRCode(decodedText),
                (error) => {
                    // Don't show errors for normal operation
                    if (error && !error.includes('NotFoundException')) {
                        console.log('QR Scan error:', error);
                    }
                }
            );
            
            console.log('✅ QR Scanner initialized successfully');
        } catch (error) {
            console.error('❌ QR Scanner initialization failed:', error);
            this.showNotification('Failed to initialize QR scanner', 'error');
        }
    }

    openQuickScanModal() {
        const modal = document.getElementById('quickScanModal');
        if (modal) {
            modal.classList.add('active');
            this.initializeQuickScanScanner();
        }
    }

    closeQuickScanModal() {
        const modal = document.getElementById('quickScanModal');
        if (modal) {
            modal.classList.remove('active');
        }
        if (this.quickQrScanner) {
            this.quickQrScanner.clear().catch(error => {
                console.log('Error clearing quick scanner:', error);
            });
            this.quickQrScanner = null;
        }
    }

    initializeQuickScanScanner() {
        const qrReader = document.getElementById('quick-qr-reader');
        if (!qrReader) return;

        try {
            // Clear any existing content
            qrReader.innerHTML = '';

            this.quickQrScanner = new Html5QrcodeScanner(
                "quick-qr-reader",
                { 
                    fps: 10, 
                    qrbox: 250 
                },
                false
            );
            
            this.quickQrScanner.render(
                (decodedText) => {
                    this.handleScannedQRCode(decodedText);
                    this.closeQuickScanModal();
                },
                (error) => {
                    // Don't show errors for normal operation
                    if (error && !error.includes('NotFoundException')) {
                        console.log('Quick scan error:', error);
                    }
                }
            );
        } catch (error) {
            console.error('Quick scan initialization failed:', error);
            this.showNotification('Failed to initialize quick scanner', 'error');
        }
    }

    async handleScannedQRCode(decodedText) {
        console.log('📷 QR Code scanned:', decodedText);
        
        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'error');
            return;
        }

        this.showNotification('Processing QR code...', 'info');

        try {
            let qrData;
            try {
                qrData = JSON.parse(decodedText);
            } catch (e) {
                // If it's not JSON, treat it as a simple token
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

    async processQRScan(qrData) {
        if (!qrData.token) {
            this.showNotification('Invalid QR code format', 'error');
            return;
        }

        try {
            // Get current location if available
            let locationData = {};
            if (this.currentLocation) {
                locationData = {
                    latitude: this.currentLocation.latitude,
                    longitude: this.currentLocation.longitude,
                    accuracy: this.currentLocation.accuracy
                };
            }

            const requestData = {
                token: qrData.token,
                class_id: qrData.class_id,
                ...locationData
            };

            // Use the URL from global config
            const scanUrl = window.APP_CONFIG?.urls?.scanQR || '/api/scan-qr/';
            console.log('Sending QR scan to:', scanUrl, requestData);

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
                this.showNotification('✅ ' + (result.message || 'Attendance marked successfully!'), 'success');
                this.updateClassAttendance(qrData.class_id, 'PRESENT');
                
                // Refresh page after 2 seconds to update data
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                
            } else {
                this.showNotification('❌ ' + (result.message || 'Failed to mark attendance'), 'error');
            }

        } catch (error) {
            console.error('QR scan API error:', error);
            this.showNotification('❌ Network error. Please try again.', 'error');
        }
    }

    async submitManualToken() {
        const tokenInput = document.getElementById('tokenInput');
        if (!tokenInput) return;

        const token = tokenInput.value.trim();
        if (!token) {
            this.showNotification('Please enter a QR token', 'error');
            return;
        }

        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'error');
            return;
        }

        await this.processQRScan({
            token: token,
            class_id: this.selectedClassId
        });

        tokenInput.value = ''; // Clear input
    }

    async enableLocationBasedAttendance() {
        try {
            if (!navigator.geolocation) {
                this.showNotification('Geolocation is not supported by your browser', 'error');
                return;
            }

            this.showNotification('Requesting location access...', 'info');

            this.currentLocation = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        });
                    },
                    (error) => {
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000
                    }
                );
            });

            this.showNotification('📍 Location access enabled', 'success');
            
        } catch (error) {
            console.error('Location error:', error);
            let message = 'Location access denied';
            if (error.code === error.TIMEOUT) {
                message = 'Location request timeout';
            } else if (error.code === error.PERMISSION_DENIED) {
                message = 'Location access denied by user';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = 'Location information unavailable';
            }
            this.showNotification('📍 ' + message, 'warning');
        }
    }

    refreshClasses() {
        this.showNotification('Refreshing class data...', 'info');
        window.location.reload(); // Simple refresh for now
    }

    startRealTimeClock() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true 
            });
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.textContent = timeString;
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    updateClassAttendance(classId, status) {
        const classItem = document.querySelector(`[data-class-id="${classId}"]`);
        if (classItem) {
            const statusElement = classItem.querySelector('.attendance-status');
            if (statusElement) {
                statusElement.textContent = status;
                statusElement.className = `attendance-status status-${status.toLowerCase()}`;
            }
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
        
        // Update notification content
        notification.className = `notification ${type}`;
        title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        messageEl.textContent = message;
        
        // Update icon
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        icon.className = `fas ${icons[type] || icons.info}`;
        
        // Show notification
        notification.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.classList.remove('show');
        }
    }

    // Clean up method to stop scanners when needed
    cleanup() {
        if (this.qrScanner) {
            this.qrScanner.clear().catch(error => {
                console.log('Error clearing QR scanner:', error);
            });
        }
        if (this.quickQrScanner) {
            this.quickQrScanner.clear().catch(error => {
                console.log('Error clearing quick scanner:', error);
            });
        }
    }
}

// Profile Management Class
class ProfileManager {
    constructor() {
        this.csrfToken = window.APP_CONFIG?.csrfToken || 
                        document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                        document.getElementById('csrfToken')?.value;
        this.initEventListeners();
    }

    initEventListeners() {
        // Settings menu
        const settingsLink = document.getElementById('settingsLink');
        if (settingsLink) {
            settingsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openSettingsMenu();
            });
        }

        // Profile editing
        const editProfileOption = document.getElementById('editProfileOption');
        if (editProfileOption) {
            editProfileOption.addEventListener('click', () => {
                this.openProfileModal();
            });
        }

        // Password change
        const changePasswordOption = document.getElementById('changePasswordOption');
        if (changePasswordOption) {
            changePasswordOption.addEventListener('click', () => {
                this.openPasswordModal();
            });
        }

        // Close modals
        const closeProfileModal = document.getElementById('closeProfileModal');
        if (closeProfileModal) {
            closeProfileModal.addEventListener('click', () => this.closeProfileModal());
        }

        const closePasswordModal = document.getElementById('closePasswordModal');
        if (closePasswordModal) {
            closePasswordModal.addEventListener('click', () => this.closePasswordModal());
        }

        const closeSettingsMenu = document.getElementById('closeSettingsMenu');
        if (closeSettingsMenu) {
            closeSettingsMenu.addEventListener('click', () => this.closeSettingsMenu());
        }

        // Cancel buttons
        const cancelProfile = document.getElementById('cancelProfile');
        if (cancelProfile) {
            cancelProfile.addEventListener('click', () => this.closeProfileModal());
        }

        const cancelPassword = document.getElementById('cancelPassword');
        if (cancelPassword) {
            cancelPassword.addEventListener('click', () => this.closePasswordModal());
        }

        // Password visibility toggle
        this.initPasswordToggles();

        // File upload preview
        this.initFileUpload();

        // Form submissions
        this.initFormSubmissions();
    }

    openSettingsMenu() {
        const modal = document.getElementById('settingsMenuModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeSettingsMenu() {
        const modal = document.getElementById('settingsMenuModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    openProfileModal() {
        this.closeSettingsMenu();
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeProfileModal() {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    openPasswordModal() {
        this.closeSettingsMenu();
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closePasswordModal() {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    initPasswordToggles() {
        const toggles = document.querySelectorAll('.password-toggle');
        toggles.forEach(toggle => {
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
                    // Validate file size (5MB limit)
                    if (file.size > 5 * 1024 * 1024) {
                        this.showNotification('File size must be less than 5MB', 'error');
                        e.target.value = '';
                        return;
                    }

                    // Validate file type
                    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
                    if (!validTypes.includes(file.type)) {
                        this.showNotification('Please select a valid image file (JPG, PNG, GIF)', 'error');
                        e.target.value = '';
                        return;
                    }

                    // Preview image
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
                
                const formData = new FormData(profileForm);
                const submitBtn = document.getElementById('saveProfile');
                
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                    submitBtn.disabled = true;
                }

                try {
                    const response = await fetch(profileForm.action, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRFToken': this.csrfToken
                        }
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        this.showNotification(data.message || 'Profile updated successfully!', 'success');
                        this.closeProfileModal();
                        // Reload to show updated data
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        this.showNotification(data.message || 'Error updating profile', 'error');
                        // You can also display form errors here if needed
                        if (data.errors) {
                            console.log('Form errors:', data.errors);
                        }
                    }
                } catch (error) {
                    console.error('Error:', error);
                    this.showNotification('Network error. Please try again.', 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                        submitBtn.disabled = false;
                    }
                }
            });
        }

        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(passwordForm);
                const submitBtn = document.getElementById('savePassword');
                
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
                    submitBtn.disabled = true;
                }

                try {
                    const response = await fetch(passwordForm.action, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'X-CSRFToken': this.csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                        }
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        this.showNotification(data.message || 'Password changed successfully!', 'success');
                        this.closePasswordModal();
                        passwordForm.reset();
                    } else {
                        this.showNotification(data.message || 'Error changing password', 'error');
                        if (data.errors) {
                            console.log('Password form errors:', data.errors);
                        }
                    }
                } catch (error) {
                    console.error('Error:', error);
                    this.showNotification('Network error. Please try again.', 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.innerHTML = '<i class="fas fa-key"></i> Change Password';
                        submitBtn.disabled = false;
                    }
                }
            });
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
        
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.classList.remove('show');
        }
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Student Dashboard
    window.studentDashboard = new StudentDashboard();
    
    // Initialize Profile Manager
    window.profileManager = new ProfileManager();
    
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