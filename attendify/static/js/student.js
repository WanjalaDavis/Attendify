// student.js - Complete Full JavaScript for Student Portal

class StudentPortal {
    constructor() {
        this.currentTab = 'classes';
        this.selectedClassId = null;
        this.qrScanner = null;
        this.isScanning = false;
        this.locationAccess = false;
        this.cameraAccess = false;
        this.countdownTimers = new Map();
        this.qrScannerInitialized = false;
        this.statusUpdateInterval = null;
        this.attendanceChart = null;
        this.chartsInitialized = false;
        
        this.init();
    }

    // ===== INITIALIZATION =====
    init() {
        console.log('Initializing Attendify Student Portal...');
        this.setupEventListeners();
        this.initializeDynamicGreeting();
        this.initializeCountdownTimers();
        this.initializeCharts();
        this.checkLocationPermission();
        this.setupTabNavigation();
        this.startStatusUpdates();
        
        this.initializeQRScanner();
        
        console.log('Attendify Student Portal initialized');
    }

    // ===== EVENT LISTENERS SETUP =====
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Tab Navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        if (navButtons.length > 0) {
            navButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchTab(e.currentTarget.dataset.tab);
                });
            });
        }

        // QR Scanner Controls
        this.setupQREventListeners();

        // Class Selection - Event delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-class-btn')) {
                this.selectClassForScanning(e.target.closest('.ongoing-class-item'));
            }
            if (e.target.classList.contains('scan-from-classes')) {
                this.scanFromClassesTab(e.target.dataset.classId);
            }
            if (e.target.id === 'change-class-btn') {
                this.deselectClass();
            }
            if (e.target.classList.contains('view-unit-details')) {
                this.showUnitDetails(e.target.dataset.unitId);
            }
        });

        // Global handlers
        document.addEventListener('click', (e) => this.handleGlobalClicks(e));
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    setupQREventListeners() {
        const startScannerBtn = document.getElementById('start-scanner');
        const stopScannerBtn = document.getElementById('stop-scanner');
        const uploadQrBtn = document.getElementById('upload-qr');
        const qrFileInput = document.getElementById('qr-file-input');
        const qrTokenForm = document.getElementById('qr-token-form');
        const refreshAttendanceBtn = document.getElementById('refresh-recent-attendance');
        const exportCsvBtn = document.getElementById('export-csv');
        const loadMoreBtn = document.getElementById('load-more-attendance');
        const enableLocationBtn = document.getElementById('enable-location-btn');
        const enableCameraBtn = document.getElementById('enable-camera-btn');

        if (startScannerBtn) startScannerBtn.addEventListener('click', () => this.startQRScanner());
        if (stopScannerBtn) stopScannerBtn.addEventListener('click', () => this.stopQRScanner());
        if (uploadQrBtn) uploadQrBtn.addEventListener('click', () => this.uploadQRImage());
        if (qrFileInput) qrFileInput.addEventListener('change', (e) => this.handleQRFileUpload(e));
        if (qrTokenForm) qrTokenForm.addEventListener('submit', (e) => this.handleManualTokenSubmit(e));
        if (refreshAttendanceBtn) refreshAttendanceBtn.addEventListener('click', () => this.refreshRecentAttendance());
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => this.exportAttendanceCSV());
        if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => this.loadMoreAttendance());
        if (enableLocationBtn) enableLocationBtn.addEventListener('click', () => this.enableLocation());
        if (enableCameraBtn) enableCameraBtn.addEventListener('click', () => this.enableCamera());
    }

    // ===== TAB MANAGEMENT =====
    setupTabNavigation() {
        this.switchTab('classes');
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
            
            switch(tabName) {
                case 'attendance':
                    this.initializeAttendanceTab();
                    break;
                case 'analytics':
                    // Use setTimeout to ensure DOM is ready for charts
                    setTimeout(() => {
                        this.initializeAnalyticsTab();
                    }, 50);
                    break;
                case 'units':
                    this.initializeUnitsTab();
                    break;
            }
        }

        this.currentTab = tabName;
        this.showNotification(`Switched to ${tabName} tab`, 'info');
    }

    initializeAttendanceTab() {
        this.initializeCountdownTimers();
        this.checkLocationPermission();
    }

    initializeAnalyticsTab() {
        this.initializeCharts();
    }

    initializeUnitsTab() {
        // Unit-specific initializations
    }

    // ===== DYNAMIC GREETING =====
    initializeDynamicGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        
        const greetingElement = document.getElementById('dynamic-greeting');
        if (greetingElement) {
            const name = greetingElement.textContent.split(', ')[1] || 'Student';
            greetingElement.textContent = `${greeting}, ${name}`;
        }
    }

    // ===== REAL-TIME STATUS UPDATES =====
    startStatusUpdates() {
        // Update class statuses every minute
        this.statusUpdateInterval = setInterval(() => {
            this.updateAllClassStatuses();
        }, 60000); // Update every minute
        
        // Initial update
        this.updateAllClassStatuses();
    }

    updateAllClassStatuses() {
        console.log('Updating class statuses...');
        const classCards = document.querySelectorAll('.class-card');
        
        classCards.forEach(card => {
            this.updateClassCardStatus(card);
        });

        // Update ongoing classes list in attendance tab
        this.updateOngoingClassesList();
    }

    updateClassCardStatus(card) {
        const classId = card.dataset.classId;
        const startTime = card.dataset.startTime;
        const endTime = card.dataset.endTime;
        const scheduleDate = card.dataset.scheduleDate;
        
        if (!classId || !startTime || !endTime || !scheduleDate) return;

        const now = new Date();
        const startDateTime = new Date(`${scheduleDate}T${startTime}`);
        const endDateTime = new Date(`${scheduleDate}T${endTime}`);
        
        let newStatus = '';
        let newStatusClass = '';
        
        if (now < startDateTime) {
            newStatus = 'upcoming';
            newStatusClass = 'upcoming';
        } else if (now >= startDateTime && now <= endDateTime) {
            newStatus = 'ongoing';
            newStatusClass = 'ongoing';
        } else {
            newStatus = 'ended';
            newStatusClass = 'ended';
        }

        // Update card if status changed
        const currentStatus = card.dataset.status;
        if (currentStatus !== newStatus) {
            this.updateClassCardUI(card, newStatus, newStatusClass);
            card.dataset.status = newStatus;
            
            console.log(`Class ${classId} status changed from ${currentStatus} to ${newStatus}`);
        }

        // Update countdown timers for upcoming classes
        if (newStatus === 'upcoming') {
            this.updateCountdownTimer(card, startDateTime);
        }
        
        // Update time remaining for ongoing classes
        if (newStatus === 'ongoing') {
            this.updateTimeRemaining(card, endDateTime);
        }
    }

    updateClassCardUI(card, status, statusClass) {
        // Remove all status classes
        card.classList.remove('ongoing', 'upcoming', 'ended');
        // Add new status class
        card.classList.add(statusClass);
        
        const icon = card.querySelector('.class-icon i');
        const statusBadge = card.querySelector('.status-badge');
        const actionButton = card.querySelector('.class-actions button:not(.countdown-timer)');
        const countdownTimer = card.querySelector('.countdown-timer');
        
        // Update icon
        if (icon) {
            icon.className = 'fas fa-' + 
                (status === 'ongoing' ? 'play-circle' : 
                 status === 'upcoming' ? 'clock' : 'check-circle');
        }
        
        // Update status badge and button
        if (statusBadge && actionButton) {
            if (status === 'ongoing') {
                const isAttended = card.querySelector('.btn-success') !== null;
                if (isAttended) {
                    const attendanceStatus = card.dataset.attendanceStatus || 'PRESENT';
                    statusBadge.textContent = attendanceStatus;
                    statusBadge.className = 'status-badge success';
                    actionButton.innerHTML = '<i class="fas fa-check"></i> Already Marked';
                    actionButton.className = 'btn-success';
                    actionButton.disabled = true;
                } else {
                    statusBadge.textContent = 'Live';
                    statusBadge.className = 'status-badge live';
                    actionButton.innerHTML = '<i class="fas fa-qrcode"></i> Scan QR';
                    actionButton.className = 'btn-primary scan-from-classes';
                    actionButton.disabled = false;
                }
            } else if (status === 'upcoming') {
                statusBadge.textContent = 'Upcoming';
                statusBadge.className = 'status-badge upcoming';
                if (countdownTimer) countdownTimer.style.display = 'block';
            } else {
                // Ended class
                const isAttended = card.querySelector('.btn-success') !== null;
                if (isAttended) {
                    const attendanceStatus = card.dataset.attendanceStatus || 'PRESENT';
                    statusBadge.textContent = attendanceStatus;
                    statusBadge.className = 'status-badge success';
                    actionButton.innerHTML = '<i class="fas fa-check"></i> Attended';
                    actionButton.className = 'btn-success';
                } else {
                    statusBadge.textContent = 'Absent';
                    statusBadge.className = 'status-badge danger';
                    actionButton.innerHTML = '<i class="fas fa-times"></i> Missed';
                    actionButton.className = 'btn-danger';
                }
                actionButton.disabled = true;
                if (countdownTimer) countdownTimer.style.display = 'none';
            }
        }
    }

    updateOngoingClassesList() {
        const ongoingList = document.getElementById('ongoing-classes-list');
        if (!ongoingList) return;

        const ongoingItems = ongoingList.querySelectorAll('.ongoing-class-item');
        
        ongoingItems.forEach(item => {
            const classId = item.dataset.classId;
            const endTime = item.dataset.endTime;
            const scheduleDate = item.dataset.scheduleDate;
            
            if (!classId || !endTime || !scheduleDate) return;

            const endDateTime = new Date(`${scheduleDate}T${endTime}`);
            const now = new Date();
            
            // Check if class has ended
            if (now > endDateTime) {
                item.style.opacity = '0.6';
                const timeRemaining = item.querySelector('.time-remaining-badge');
                if (timeRemaining) {
                    timeRemaining.innerHTML = '<i class="fas fa-clock"></i><span>Class ended</span>';
                }
                
                const actionBtn = item.querySelector('.class-action button');
                if (actionBtn && !actionBtn.disabled) {
                    actionBtn.disabled = true;
                    actionBtn.textContent = 'Ended';
                    actionBtn.className = 'btn-secondary small';
                }
            } else {
                // Update time remaining
                this.updateOngoingClassTimeRemaining(item, endDateTime);
            }
        });
    }

    updateOngoingClassTimeRemaining(item, endDateTime) {
        const now = new Date();
        const diff = endDateTime - now;
        
        if (diff <= 0) return;
        
        const minutes = Math.floor(diff / (1000 * 60));
        const timeRemaining = item.querySelector('.time-remaining-badge span');
        
        if (timeRemaining) {
            timeRemaining.textContent = `${minutes}m remaining`;
        }
    }

    // ===== COUNTDOWN TIMERS =====
    initializeCountdownTimers() {
        // Upcoming classes
        document.querySelectorAll('.class-card.upcoming').forEach(card => {
            const classId = card.dataset.classId;
            const startTime = card.dataset.startTime;
            const scheduleDate = card.dataset.scheduleDate;
            
            if (classId && startTime && scheduleDate) {
                this.startCountdownTimer(classId, scheduleDate, startTime);
            }
        });

        // Ongoing classes
        document.querySelectorAll('.ongoing-class-item:not(.attendance-marked)').forEach(item => {
            const classId = item.dataset.classId;
            const endTime = item.dataset.endTime;
            const scheduleDate = item.dataset.scheduleDate;
            
            if (classId && endTime && scheduleDate) {
                this.startTimeRemainingTimer(classId, scheduleDate, endTime);
            }
        });
    }

    startCountdownTimer(classId, date, time) {
        const timerElement = document.getElementById(`countdown-${classId}`);
        if (!timerElement) return;

        const targetDateTime = new Date(`${date}T${time}`);
        
        const updateTimer = () => {
            const now = new Date();
            const diff = targetDateTime - now;
            
            if (diff <= 0) {
                timerElement.textContent = 'Starting now';
                this.countdownTimers.delete(classId);
                this.refreshClassStatus(classId);
                return;
            }
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 0) {
                timerElement.textContent = `in ${hours}h ${minutes}m`;
            } else {
                timerElement.textContent = `in ${minutes}m`;
            }
        };
        
        updateTimer();
        const intervalId = setInterval(updateTimer, 60000);
        this.countdownTimers.set(classId, intervalId);
    }

    updateCountdownTimer(card, targetDateTime) {
        const classId = card.dataset.classId;
        const timerElement = card.querySelector('.countdown-timer');
        if (!timerElement) return;

        const now = new Date();
        const diff = targetDateTime - now;
        
        if (diff <= 0) {
            timerElement.textContent = 'Starting now';
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            timerElement.textContent = `in ${hours}h ${minutes}m`;
        } else {
            timerElement.textContent = `in ${minutes}m`;
        }
    }

    updateTimeRemaining(card, endDateTime) {
        const now = new Date();
        const diff = endDateTime - now;
        
        if (diff <= 0) return;
        
        const minutes = Math.floor(diff / (1000 * 60));
        const timeRemaining = card.querySelector('.time-remaining');
        
        if (timeRemaining) {
            const span = timeRemaining.querySelector('span');
            if (span) span.textContent = `${minutes}m remaining`;
        }
    }

    startTimeRemainingTimer(classId, date, endTime) {
        const timerElement = document.getElementById(`time-remaining-${classId}`);
        if (!timerElement) return;

        const targetDateTime = new Date(`${date}T${endTime}`);
        
        const updateTimer = () => {
            const now = new Date();
            const diff = targetDateTime - now;
            
            if (diff <= 0) {
                if (timerElement.querySelector('span')) {
                    timerElement.querySelector('span').textContent = 'Class ended';
                }
                this.countdownTimers.delete(classId);
                this.refreshClassStatus(classId);
                return;
            }
            
            const minutes = Math.floor(diff / (1000 * 60));
            if (timerElement.querySelector('span')) {
                timerElement.querySelector('span').textContent = `${minutes}m remaining`;
            }
        };
        
        updateTimer();
        const intervalId = setInterval(updateTimer, 60000);
        this.countdownTimers.set(classId, intervalId);
    }

    // ===== QR SCANNER FUNCTIONALITY =====
    async initializeQRScanner() {
        console.log('Initializing QR Scanner...');
        
        // Wait longer for library to load (sometimes it takes a moment)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if QR Scanner is available with multiple checks
        if (typeof QrScanner === 'undefined') {
            console.error('QR Scanner library not loaded after waiting');
            console.log('Available globals:', Object.keys(window).filter(k => k.includes('qr') || k.includes('QR') || k.includes('Qr')));
            this.disableQRFeatures();
            return;
        }

        const video = document.getElementById('qr-video');
        if (!video) {
            console.warn('QR video element not found');
            this.disableQRFeatures();
            return;
        }

        try {
            console.log('Creating QR Scanner instance...');
            
            this.qrScanner = new QrScanner(
                video,
                result => this.handleQRScanResult(result),
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    preferredCamera: 'environment',
                    maxScansPerSecond: 2,
                    returnDetailedScanResult: false, // Simpler for now
                }
            );
            
            this.qrScannerInitialized = true;
            console.log('✅ QR Scanner initialized successfully');
            
        } catch (error) {
            console.error('❌ Error setting up QR scanner:', error);
            this.disableQRFeatures();
        }
    }

    disableQRFeatures() {
        this.qrScannerInitialized = false;
        
        // Show user-friendly message
        const startScannerBtn = document.getElementById('start-scanner');
        const uploadQrBtn = document.getElementById('upload-qr');
        
        if (startScannerBtn) {
            startScannerBtn.disabled = true;
            startScannerBtn.innerHTML = '<i class="fas fa-ban"></i> QR Unavailable';
            startScannerBtn.title = 'QR scanning not available in this browser';
        }
        if (uploadQrBtn) {
            uploadQrBtn.disabled = true;
        }
        
        this.showNotification('QR scanning not available. Use manual token entry instead.', 'warning');
    }

    async startQRScanner() {
        console.log('Starting QR Scanner...');
        
        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'warning');
            return;
        }

        if (!this.qrScannerInitialized || !this.qrScanner) {
            this.showNotification('QR scanner is not available', 'error');
            return;
        }

        if (!this.cameraAccess) {
            this.showCameraPermissionModal();
            return;
        }

        try {
            this.showLoading('Starting camera...');
            await this.qrScanner.start();
            this.isScanning = true;
            
            const scannerPlaceholder = document.getElementById('scanner-placeholder');
            const startScannerBtn = document.getElementById('start-scanner');
            const stopScannerBtn = document.getElementById('stop-scanner');
            
            if (scannerPlaceholder) scannerPlaceholder.style.display = 'none';
            if (startScannerBtn) startScannerBtn.style.display = 'none';
            if (stopScannerBtn) stopScannerBtn.style.display = 'inline-flex';
            
            this.hideLoading();
            this.updateScannerStatus('Scanning... Point camera at QR code', 'info');
            this.showNotification('QR scanner started', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('Error starting QR scanner:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Camera access denied. Please allow camera access in your browser settings.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No camera found on this device.', 'error');
            } else {
                this.showNotification('Failed to start camera: ' + error.message, 'error');
            }
        }
    }

    stopQRScanner() {
        console.log('Stopping QR Scanner...');
        
        if (this.qrScanner && this.isScanning) {
            this.qrScanner.stop();
            this.isScanning = false;
        }
        
        const startScannerBtn = document.getElementById('start-scanner');
        const stopScannerBtn = document.getElementById('stop-scanner');
        
        if (startScannerBtn) startScannerBtn.style.display = 'inline-flex';
        if (stopScannerBtn) stopScannerBtn.style.display = 'none';
        
        this.updateScannerStatus('Scanner stopped', 'warning');
        this.showNotification('QR scanner stopped', 'info');
    }

    handleQRScanResult(result) {
        if (!this.isScanning) return;
        
        console.log('QR Code detected:', result);
        this.stopQRScanner();
        this.processQRCodeData(result.data);
    }

    async processQRCodeData(qrData) {
        try {
            this.updateScannerStatus('Processing QR code...', 'info');
            
            let qrToken, qrClassId;
            try {
                const qrDataObj = JSON.parse(qrData);
                qrToken = qrDataObj.token;
                qrClassId = qrDataObj.class_id;
                console.log('Parsed QR data:', qrDataObj);
            } catch (e) {
                // If not JSON, use raw data as token
                qrToken = qrData;
                qrClassId = this.selectedClassId;
                console.log('Using raw QR data as token');
            }

            if (!this.isValidQRData(qrToken)) {
                throw new Error('Invalid QR code format');
            }

            let locationData = null;
            if (this.locationAccess) {
                try {
                    locationData = await this.getCurrentLocation();
                    console.log('Location data obtained:', locationData);
                } catch (locationError) {
                    console.warn('Location access failed:', locationError);
                }
            }

            await this.submitAttendance(qrClassId, qrToken, locationData);
            
        } catch (error) {
            console.error('Error processing QR code:', error);
            this.showNotification('Error: ' + error.message, 'error');
            this.updateScannerStatus('Scan failed: ' + error.message, 'error');
        }
    }

    // ===== MANUAL TOKEN SUBMISSION =====
    handleManualTokenSubmit(e) {
        e.preventDefault();
        
        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'warning');
            return;
        }

        const tokenInput = document.getElementById('qr-token-input');
        if (!tokenInput) return;
        
        const token = tokenInput.value.trim();
        
        if (!token) {
            this.showNotification('Please enter a QR token', 'warning');
            return;
        }

        if (!this.isValidQRData(token)) {
            this.showNotification('Invalid token format. Token should be at least 10 characters.', 'error');
            return;
        }

        this.submitManualToken(token);
    }

    async submitManualToken(token) {
        try {
            this.updateScannerStatus('Submitting token...', 'info');
            
            let locationData = null;
            if (this.locationAccess) {
                try {
                    locationData = await this.getCurrentLocation();
                } catch (locationError) {
                    console.warn('Location access failed:', locationError);
                }
            }

            await this.submitAttendance(this.selectedClassId, token, locationData);
            
        } catch (error) {
            console.error('Error submitting manual token:', error);
            this.showNotification('Error: ' + error.message, 'error');
            this.updateScannerStatus('Token submission failed', 'error');
        }
    }

    // ===== BACKEND INTEGRATION =====
    async submitAttendance(classId, qrToken, locationData = null) {
        try {
            this.showLoading('Submitting attendance...');
            
            // Use FormData for better compatibility
            const formData = new FormData();
            formData.append('class_id', classId);
            formData.append('token', qrToken);
            
            const csrfToken = this.getCSRFToken();
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken);
            }
            
            if (locationData) {
                formData.append('latitude', locationData.latitude);
                formData.append('longitude', locationData.longitude);
                formData.append('accuracy', locationData.accuracy);
            }

            console.log('Submitting attendance with class:', classId, 'token:', qrToken.substring(0, 10) + '...');

            const response = await fetch('/scan-qr-code/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned invalid response. Please check if the endpoint exists.');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.hideLoading();

            if (result.success) {
                this.showAttendanceSuccess(result);
                this.updateAttendanceStats();
                this.refreshRecentAttendance();
                this.refreshClassStatus(classId);
            } else {
                throw new Error(result.message || 'Attendance submission failed');
            }
            
        } catch (error) {
            this.hideLoading();
            console.error('Error submitting attendance:', error);
            
            // Provide more user-friendly error messages
            let errorMessage = 'Failed to submit attendance: ';
            if (error.message.includes('invalid response') || error.message.includes('endpoint')) {
                errorMessage += 'Server configuration issue. Please contact administrator.';
            } else if (error.message.includes('404')) {
                errorMessage += 'Service not available. Please try again later.';
            } else {
                errorMessage += error.message;
            }
            
            this.showNotification(errorMessage, 'error');
            throw error;
        }
    }

    // ===== FILE UPLOAD HANDLING =====
    uploadQRImage() {
        const qrFileInput = document.getElementById('qr-file-input');
        if (qrFileInput) {
            qrFileInput.click();
        }
    }

    async handleQRFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!this.selectedClassId) {
            this.showNotification('Please select a class first', 'warning');
            return;
        }

        // Check if QR scanner is available for image scanning
        if (typeof QrScanner === 'undefined' || !QrScanner.scanImage) {
            this.showNotification('QR image scanning not supported in this browser', 'error');
            return;
        }

        try {
            this.showLoading('Processing QR image...');
            const result = await QrScanner.scanImage(file, {
                returnDetailedScanResult: true
            });
            this.hideLoading();
            this.processQRCodeData(result.data);
            
        } catch (error) {
            this.hideLoading();
            console.error('Error processing QR image:', error);
            this.showNotification('Failed to read QR code from image: ' + error.message, 'error');
        }
        
        event.target.value = '';
    }

    // ===== DATA REFRESH METHODS =====
    async refreshRecentAttendance() {
        try {
            this.showLoading('Refreshing attendance...');
            const response = await fetch('/api/recent-attendance/');
            
            // Check if endpoint exists
            if (response.status === 404) {
                this.hideLoading();
                console.warn('Recent attendance API endpoint not found');
                this.showNotification('Recent attendance feature not available', 'warning');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.updateRecentAttendanceDisplay(data);
            this.hideLoading();
            this.showNotification('Recent attendance refreshed', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('Error refreshing recent attendance:', error);
            if (!error.message.includes('404')) {
                this.showNotification('Failed to refresh attendance', 'error');
            }
        }
    }

    async updateAttendanceStats() {
        try {
            const response = await fetch('/api/attendance-stats/');
            
            if (response.status === 404) {
                console.warn('Attendance stats API endpoint not found');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update all statistics elements
            this.updateElementText('header-present-count', data.present_classes);
            this.updateElementText('header-attendance-percentage', data.attendance_percentage + '%');
            this.updateElementText('welcome-attendance-percentage', data.attendance_percentage + '%');
            this.updateElementText('stats-total-classes', data.total_classes);
            this.updateElementText('stats-present-classes', data.present_classes);
            this.updateElementText('stats-attendance-percentage', data.attendance_percentage + '%');
            this.updateElementText('analytics-percentage', data.attendance_percentage + '%');
            this.updateElementText('analytics-present', data.present_classes);
            this.updateElementText('analytics-late', data.late_count || 0);
            this.updateElementText('analytics-absent', data.absent_count || 0);
            this.updateElementText('analytics-total', data.total_classes);
            
        } catch (error) {
            console.error('Error updating attendance stats:', error);
        }
    }

    refreshClassStatus(classId) {
        // Refresh the specific class card
        const classCard = document.querySelector(`.class-card[data-class-id="${classId}"]`);
        if (classCard) {
            this.updateClassCardStatus(classCard);
        }
        
        // Refresh ongoing classes list
        this.updateOngoingClassesList();
        
        this.showNotification('Class status updated', 'info');
    }

    // ===== UNIT MANAGEMENT =====
    async showUnitDetails(unitId) {
        try {
            this.showLoading('Loading unit details...');
            const response = await fetch(`/api/unit-analytics/${unitId}/`);
            
            if (response.status === 404) {
                this.hideLoading();
                this.showNotification('Unit analytics not available', 'warning');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.hideLoading();
            this.displayUnitDetails(data);
            
        } catch (error) {
            this.hideLoading();
            console.error('Error loading unit details:', error);
            this.showNotification('Failed to load unit details', 'error');
        }
    }

    displayUnitDetails(data) {
        const detailsCard = document.getElementById('unit-details-card');
        const detailsContent = document.getElementById('unit-details-content');
        
        if (!detailsCard || !detailsContent) return;
        
        const unitData = data.unit_data;
        
        detailsContent.innerHTML = `
            <div class="unit-details-header">
                <h4>${unitData.code || 'Unknown'} - ${unitData.name || 'Unknown'}</h4>
                <p class="text-muted">${unitData.lecturer_name || 'Unknown Lecturer'} • ${unitData.semester || 'Unknown Semester'}</p>
            </div>
            
            <div class="unit-stats-grid">
                <div class="unit-stat">
                    <div class="stat-value">${unitData.attendance_percentage || 0}%</div>
                    <div class="stat-label">Overall Attendance</div>
                </div>
                <div class="unit-stat">
                    <div class="stat-value">${unitData.enrolled_students || 0}</div>
                    <div class="stat-label">Enrolled Students</div>
                </div>
                <div class="unit-stat">
                    <div class="stat-value">${unitData.present_count || 0}</div>
                    <div class="stat-label">Present Records</div>
                </div>
            </div>
            
            <div class="attendance-breakdown">
                <h5>Attendance Breakdown</h5>
                <div class="breakdown-grid">
                    <div class="breakdown-item">
                        <span class="label">Present</span>
                        <span class="value">${unitData.present_count || 0}</span>
                    </div>
                    <div class="breakdown-item">
                        <span class="label">Late</span>
                        <span class="value">${unitData.late_count || 0}</span>
                    </div>
                    <div class="breakdown-item">
                        <span class="label">Absent</span>
                        <span class="value">${unitData.absent_count || 0}</span>
                    </div>
                </div>
            </div>
            
            ${unitData.class_schedule && unitData.class_schedule.length > 0 ? `
            <div class="class-schedule">
                <h5>Class Schedule</h5>
                <div class="schedule-list">
                    ${unitData.class_schedule.map(cs => `
                        <div class="schedule-item">
                            <span class="day">${new Date(cs.date).toLocaleDateString()}</span>
                            <span class="time">${cs.start_time} - ${cs.end_time}</span>
                            <span class="venue">${cs.venue}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;
        
        detailsCard.style.display = 'block';
        detailsCard.scrollIntoView({ behavior: 'smooth' });
    }

    hideUnitDetails() {
        const detailsCard = document.getElementById('unit-details-card');
        if (detailsCard) {
            detailsCard.style.display = 'none';
        }
    }

    // ===== EXPORT FUNCTIONALITY =====
    async exportAttendanceCSV() {
        try {
            this.showLoading('Generating CSV export...');
            const response = await fetch('/api/export-attendance-csv/');
            
            if (response.status === 404) {
                this.hideLoading();
                this.showNotification('CSV export not available', 'warning');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.hideLoading();
            this.showNotification('CSV export downloaded', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('Error exporting CSV:', error);
            this.showNotification('Failed to export CSV: ' + error.message, 'error');
        }
    }

    async loadMoreAttendance() {
        try {
            const currentCount = document.querySelectorAll('#attendance-table-body tr').length;
            const response = await fetch(`/api/attendance-history/?offset=${currentCount}`);
            
            if (response.status === 404) {
                console.warn('Attendance history API endpoint not found');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.attendances && data.attendances.length > 0) {
                this.appendAttendanceHistory(data.attendances);
                if (!data.has_more) {
                    const loadMoreBtn = document.getElementById('load-more-attendance');
                    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                }
            } else {
                const loadMoreBtn = document.getElementById('load-more-attendance');
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error loading more attendance:', error);
            this.showNotification('Failed to load more attendance records', 'error');
        }
    }

    appendAttendanceHistory(attendances) {
        const tbody = document.getElementById('attendance-table-body');
        if (!tbody) return;
        
        attendances.forEach(att => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(att.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>
                    <strong>${att.unit_code || 'Unknown'}</strong>
                    <br>
                    <small>${att.unit_name || ''}</small>
                </td>
                <td>${att.lecturer || 'Unknown'}</td>
                <td>
                    <span class="status-indicator ${(att.status || '').toLowerCase()}">
                        ${att.status || 'UNKNOWN'}
                    </span>
                </td>
                <td>${att.time || '-'}</td>
                <td>${att.venue || ''}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // ===== LOCATION SERVICES =====
    async checkLocationPermission() {
        try {
            if (!navigator.geolocation) {
                this.updateLocationStatus('Geolocation not supported', 'warning');
                return;
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 5000,
                    maximumAge: 300000
                });
            });

            this.locationAccess = true;
            this.updateLocationStatus('Location access enabled', 'success');
            
        } catch (error) {
            this.locationAccess = false;
            this.updateLocationStatus('Location access required', 'warning');
        }
    }

    async enableLocation() {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            this.locationAccess = true;
            this.updateLocationStatus('Location access enabled', 'success');
            this.hideModal('locationPermissionModal');
            this.showNotification('Location services enabled', 'success');
            
        } catch (error) {
            console.error('Error enabling location:', error);
            this.showNotification('Failed to enable location services: ' + error.message, 'error');
        }
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                error => {
                    reject(new Error('Unable to get current location: ' + error.message));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // ===== CAMERA PERMISSIONS =====
    async enableCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment' // Prefer rear camera for QR scanning
                } 
            });
            stream.getTracks().forEach(track => track.stop());
            
            this.cameraAccess = true;
            this.hideModal('cameraPermissionModal');
            this.showNotification('Camera access enabled', 'success');
            
            if (this.selectedClassId) {
                this.startQRScanner();
            }
            
        } catch (error) {
            console.error('Error enabling camera:', error);
            this.showNotification('Failed to enable camera: ' + error.message, 'error');
        }
    }

    showCameraPermissionModal() {
        const modalElement = document.getElementById('cameraPermissionModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }

    // ===== CHARTS AND ANALYTICS =====
    initializeCharts() {
        if (!this.chartsInitialized) {
            this.initializeAttendanceTrendChart();
            this.initializeProgressCircles();
            this.chartsInitialized = true;
        }
    }

    initializeAttendanceTrendChart() {
        const ctx = document.getElementById('attendance-trend-chart');
        if (!ctx) return;

        try {
            // Destroy existing chart if it exists
            if (this.attendanceChart) {
                this.attendanceChart.destroy();
                this.attendanceChart = null;
            }

            const weeklyData = {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Attendance Rate',
                    data: [85, 92, 78, 95, 88, 0, 0],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            };

            this.attendanceChart = new Chart(ctx, {
                type: 'line',
                data: weeklyData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
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
                                callback: function(value) { return value + '%'; } 
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error initializing chart:', error);
        }
    }

    initializeProgressCircles() {
        document.querySelectorAll('.circle-progress').forEach(circle => {
            const percentage = circle.dataset.percentage;
            if (percentage) {
                circle.style.background = `conic-gradient(#4f46e5 0% ${percentage}%, #f3f4f6 0% 100%)`;
            }
        });
    }

    // ===== CLASS SELECTION =====
    selectClassForScanning(classElement) {
        if (!classElement) return;
        
        this.deselectClass();
        this.selectedClassId = classElement.dataset.classId;
        classElement.classList.add('selected');
        
        this.updateSelectedClassInfo(
            classElement.dataset.unitCode,
            classElement.dataset.unitName,
            classElement.dataset.startTime,
            classElement.dataset.endTime,
            classElement.dataset.venue,
            classElement.dataset.lecturer
        );
        
        const tokenInput = document.getElementById('qr-token-input');
        const submitTokenBtn = document.getElementById('submit-token-btn');
        const tokenInputStatus = document.getElementById('token-input-status');
        
        if (tokenInput) {
            tokenInput.disabled = false;
            tokenInput.focus();
        }
        if (submitTokenBtn) submitTokenBtn.disabled = false;
        if (tokenInputStatus) {
            tokenInputStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Ready for token input</span>';
            tokenInputStatus.style.color = '#10b981';
        }
        
        this.showNotification(`Selected ${classElement.dataset.unitCode} for attendance`, 'info');
    }

    deselectClass() {
        document.querySelectorAll('.ongoing-class-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        this.selectedClassId = null;
        
        const selectedClassInfo = document.getElementById('selected-class-info');
        const tokenInput = document.getElementById('qr-token-input');
        const submitTokenBtn = document.getElementById('submit-token-btn');
        const tokenInputStatus = document.getElementById('token-input-status');
        
        if (selectedClassInfo) selectedClassInfo.style.display = 'none';
        if (tokenInput) {
            tokenInput.disabled = true;
            tokenInput.value = '';
        }
        if (submitTokenBtn) submitTokenBtn.disabled = true;
        if (tokenInputStatus) {
            tokenInputStatus.innerHTML = '<i class="fas fa-info-circle"></i><span>Select a class first</span>';
            tokenInputStatus.style.color = '#6b7280';
        }
        
        this.stopQRScanner();
    }

    updateSelectedClassInfo(code, name, startTime, endTime, venue, lecturer) {
        const infoPanel = document.getElementById('selected-class-info');
        if (!infoPanel) return;
        
        const className = document.getElementById('selected-class-name');
        const classTime = document.getElementById('selected-class-time');
        const classVenue = document.getElementById('selected-class-venue');
        const classLecturer = document.getElementById('selected-class-lecturer');
        
        if (className) className.textContent = `${code} - ${name}`;
        if (classTime) classTime.textContent = `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`;
        if (classVenue) classVenue.textContent = venue;
        if (classLecturer) classLecturer.textContent = lecturer;
        
        this.updateSelectedClassTimeRemaining(endTime);
        infoPanel.style.display = 'block';
    }

    updateSelectedClassTimeRemaining(endTime) {
        const timeRemaining = document.getElementById('remaining-time-text');
        if (!timeRemaining) return;
        
        const end = new Date(`2000-01-01T${endTime}`);
        const now = new Date();
        const diff = end - now;
        
        if (diff <= 0) {
            timeRemaining.textContent = 'Class ended';
            timeRemaining.style.color = '#ef4444';
        } else {
            const minutes = Math.floor(diff / (1000 * 60));
            timeRemaining.textContent = `${minutes} minutes remaining`;
            timeRemaining.style.color = minutes < 10 ? '#f59e0b' : '#10b981';
        }
    }

    scanFromClassesTab(classId) {
        this.switchTab('attendance');
        
        setTimeout(() => {
            const classElement = document.querySelector(`.ongoing-class-item[data-class-id="${classId}"]`);
            if (classElement) {
                this.selectClassForScanning(classElement);
                // Auto-start scanner when coming from classes tab
                setTimeout(() => {
                    this.startQRScanner();
                }, 500);
            }
        }, 300);
    }

    // ===== NOTIFICATION SYSTEM =====
    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notifications-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} animate__animated animate__fadeInRight`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            </div>
            <div class="notification-content">
                <p>${message}</p>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('animate__fadeOutRight');
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    getNotificationIcon(type) {
        switch(type) {
            case 'success': return 'check-circle';
            case 'warning': return 'exclamation-triangle';
            case 'error': return 'exclamation-circle';
            default: return 'info-circle';
        }
    }

    updateScannerStatus(message, type = 'info') {
        const statusElement = document.getElementById('scanner-status');
        if (!statusElement) return;
        
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        if (text) text.textContent = message;
        
        if (icon) {
            icon.className = 'fas fa-circle';
            switch(type) {
                case 'success': icon.style.color = '#10b981'; break;
                case 'warning': icon.style.color = '#f59e0b'; break;
                case 'error': icon.style.color = '#ef4444'; break;
                default: icon.style.color = '#06b6d4';
            }
        }
    }

    updateLocationStatus(message, type = 'info') {
        const statusElement = document.getElementById('location-status-text');
        if (!statusElement) return;
        
        statusElement.textContent = message;
        switch(type) {
            case 'success': statusElement.style.color = '#10b981'; break;
            case 'warning': statusElement.style.color = '#f59e0b'; break;
            case 'error': statusElement.style.color = '#ef4444'; break;
            default: statusElement.style.color = '#6b7280';
        }
    }

    // ===== LOADING OVERLAY =====
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const messageElement = overlay.querySelector('p');
            if (messageElement) messageElement.textContent = message;
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.style.opacity = '1';
            }, 10);
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    // ===== UTILITY METHODS =====
    showAttendanceSuccess(result) {
        const resultsContainer = document.getElementById('scan-results');
        const resultCard = document.getElementById('result-card');
        
        if (!resultCard) return;
        
        resultCard.innerHTML = `
            <div class="success-result">
                <div class="result-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="result-content">
                    <h5>Attendance Marked Successfully!</h5>
                    <p><strong>Class:</strong> ${result.class_name || 'Unknown'}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
                    <p><strong>Status:</strong> <span class="status-badge success">${result.status || 'PRESENT'}</span></p>
                    <p><strong>Location Validation:</strong> <span class="status-badge ${result.location_valid ? 'success' : 'warning'}">${result.location_valid ? 'Valid' : 'Not Validated'}</span></p>
                    ${result.message ? `<p class="result-message">${result.message}</p>` : ''}
                </div>
            </div>
        `;
        
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }
        
        this.updateScannerStatus('Attendance marked successfully!', 'success');
        
        const tokenInput = document.getElementById('qr-token-input');
        if (tokenInput) tokenInput.value = '';
    }

    updateRecentAttendanceDisplay(data) {
        const container = document.getElementById('recent-attendance-content');
        if (!container) return;
        
        if (data.attendances && data.attendances.length > 0) {
            container.innerHTML = `
                <div class="attendance-history">
                    ${data.attendances.map(att => `
                        <div class="attendance-item ${(att.status || '').toLowerCase()}">
                            <div class="attendance-icon">
                                <i class="fas fa-${att.status === 'PRESENT' ? 'check-circle' : att.status === 'LATE' ? 'clock' : 'times-circle'}"></i>
                            </div>
                            <div class="attendance-info">
                                <strong>${att.unit_code || 'Unknown'}</strong>
                                <span>${new Date(att.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <small>${att.unit_name || ''}</small>
                            </div>
                            <div class="attendance-status">
                                <span class="status-badge ${(att.status || '').toLowerCase()}">${att.status || 'UNKNOWN'}</span>
                                <small>${att.time || ''}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-ban"></i>
                    <p>No attendance records</p>
                    <small>Scan a QR code to mark your first attendance</small>
                </div>
            `;
        }
    }

    isValidQRData(qrData) {
        return qrData && qrData.length >= 10;
    }

    formatTime(timeString) {
        if (!timeString) return 'Unknown';
        try {
            const time = new Date(`2000-01-01T${timeString}`);
            return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return 'Invalid time';
        }
    }

    getCSRFToken() {
        const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
        return csrfInput ? csrfInput.value : null;
    }

    updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = text;
    }

    hideModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            } else {
                // Fallback: hide manually
                modalElement.style.display = 'none';
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
            }
        }
    }

    // ===== EVENT HANDLERS =====
    handleGlobalClicks(e) {
        // Close dropdowns when clicking outside
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    }

    handleResize() {
        // Handle responsive adjustments
        if (window.innerWidth < 768) {
            // Mobile-specific adjustments
            const scannerFrame = document.querySelector('.scanner-frame');
            if (scannerFrame) {
                scannerFrame.style.maxWidth = '100%';
            }
        }
    }

    // ===== CLEANUP =====
    cleanup() {
        console.log('Cleaning up Student Portal...');
        
        // Clear status update interval
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        
        // Clear countdown timers
        this.countdownTimers.forEach((intervalId, classId) => {
            clearInterval(intervalId);
        });
        this.countdownTimers.clear();
        
        // Stop QR scanner
        if (this.qrScanner && this.isScanning) {
            this.qrScanner.stop();
            this.qrScanner.destroy();
        }
        
        // Destroy charts
        if (this.attendanceChart) {
            this.attendanceChart.destroy();
            this.attendanceChart = null;
        }
        
        this.hideLoading();
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Initializing Student Portal');
    
    try {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';

        window.studentPortal = new StudentPortal();
        
        // Global functions for template use
        window.showTab = function(tabName) {
            if (window.studentPortal) window.studentPortal.switchTab(tabName);
        };
        
        window.hideUnitDetails = function() {
            if (window.studentPortal) window.studentPortal.hideUnitDetails();
        };

        console.log('Student Portal initialization complete');
        
    } catch (error) {
        console.error('Error initializing student portal:', error);
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
});

// ===== GLOBAL ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});

// Safety timeout for loading overlay
setTimeout(() => {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
        console.warn('Loading overlay still visible after timeout - forcing hide');
        loadingOverlay.style.display = 'none';
    }
}, 10000);