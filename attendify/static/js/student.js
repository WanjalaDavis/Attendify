// student.js - Production Ready Student Portal JavaScript
class StudentPortal {
    constructor() {
        this.currentTab = 'classes';
        this.selectedClass = null;
        this.qrScanner = null;
        this.currentLocation = null;
        this.locationWatchId = null;
        this.isScanning = false;
        this.attendanceChart = null;
        this.csrfToken = this.getCSRFToken();
        this.attendanceOffset = 20;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initDynamicGreeting();
        this.initCountdownTimers();
        this.initLocationServices();
        this.initAnalyticsChart();
        this.startAutoRefresh();
        
        console.log('Student Portal initialized successfully');
    }

    // ==================== CORE UTILITIES ====================
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }

    async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken
            },
            credentials: 'same-origin'
        };

        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    showLoading(show = true) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notifications-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);

        return notification;
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // ==================== EVENT BINDING ====================
    bindEvents() {
        // Navigation tabs
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.closest('.nav-btn').dataset.tab));
        });

        // QR Scanner controls
        document.getElementById('start-scanner').addEventListener('click', () => this.startQRScanner());
        document.getElementById('stop-scanner').addEventListener('click', () => this.stopQRScanner());
        document.getElementById('upload-qr').addEventListener('click', () => this.triggerQRUpload());
        document.getElementById('qr-file-input').addEventListener('change', (e) => this.handleQRUpload(e));
        document.getElementById('qr-token-form').addEventListener('submit', (e) => this.submitQRToken(e));
        document.getElementById('change-class-btn').addEventListener('click', () => this.deselectClass());

        // Class selection
        document.querySelectorAll('.select-class-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectClass(e.target.closest('.ongoing-class-item')));
        });

        // Scan from classes tab
        document.querySelectorAll('.scan-from-classes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const classId = e.target.dataset.classId;
                this.selectClassFromClassesTab(classId);
                this.switchTab('attendance');
            });
        });

        // Unit details
        document.querySelectorAll('.view-unit-details').forEach(btn => {
            btn.addEventListener('click', (e) => this.showUnitDetails(e.target.dataset.unitId));
        });

        // Refresh controls
        document.getElementById('refresh-recent-attendance').addEventListener('click', () => this.refreshRecentAttendance());
        document.getElementById('load-more-attendance').addEventListener('click', () => this.loadMoreAttendance());
        document.getElementById('export-csv').addEventListener('click', () => this.exportAttendanceCSV());

        // Permission modals
        document.getElementById('enable-location-btn').addEventListener('click', () => this.requestLocationPermission());
        document.getElementById('enable-camera-btn').addEventListener('click', () => this.requestCameraPermission());

        // Global error handling
        window.addEventListener('error', (e) => this.handleGlobalError(e));
        window.addEventListener('unhandledrejection', (e) => this.handlePromiseRejection(e));
    }

    // ==================== TAB MANAGEMENT ====================
    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // Tab-specific initializations
        switch(tabName) {
            case 'attendance':
                this.updateOngoingClassesTimers();
                break;
            case 'analytics':
                this.refreshAnalyticsData();
                break;
            case 'units':
                this.refreshUnitsData();
                break;
        }
    }

    // ==================== QR SCANNING SYSTEM ====================
    async startQRScanner() {
        if (!this.selectedClass) {
            this.showNotification('Please select a class first', 'warning');
            return;
        }

        try {
            // Request camera permission
            const stream = await this.requestCameraAccess();
            if (!stream) return;

            // Initialize QR Scanner
            const video = document.getElementById('qr-video');
            video.srcObject = stream;
            
            this.qrScanner = new QrScanner(
                video,
                result => this.handleQRScan(result),
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    returnDetailedScanResult: true
                }
            );

            await this.qrScanner.start();
            this.isScanning = true;

            // Update UI
            document.getElementById('scanner-placeholder').style.display = 'none';
            document.getElementById('start-scanner').style.display = 'none';
            document.getElementById('stop-scanner').style.display = 'inline-block';
            this.updateScannerStatus('Scanning for QR codes...', 'info');

        } catch (error) {
            console.error('Failed to start QR scanner:', error);
            this.showNotification('Failed to start camera. Please check permissions.', 'error');
        }
    }

    stopQRScanner() {
        if (this.qrScanner) {
            this.qrScanner.stop();
            this.qrScanner.destroy();
            this.qrScanner = null;
        }

        this.isScanning = false;

        // Update UI
        document.getElementById('start-scanner').style.display = 'inline-block';
        document.getElementById('stop-scanner').style.display = 'none';
        this.updateScannerStatus('Scanner stopped', 'warning');

        // Stop camera streams
        const video = document.getElementById('qr-video');
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
    }

    async handleQRScan(result) {
        if (!this.isScanning || !result?.data) return;

        try {
            this.updateScannerStatus('QR code detected, processing...', 'success');
            
            // Parse QR data
            const qrData = JSON.parse(result.data);
            const { token, class_id } = qrData;

            // Validate class match
            if (class_id !== this.selectedClass.id) {
                this.showNotification('QR code is for a different class', 'error');
                return;
            }

            // Submit scan to backend
            await this.submitQRScan(token, class_id);

            // Stop scanner after successful scan
            this.stopQRScanner();

        } catch (error) {
            console.error('QR scan processing error:', error);
            this.updateScannerStatus('Invalid QR code format', 'error');
        }
    }

    async submitQRScan(token, classId) {
        this.showLoading(true);

        try {
            // Get current location
            const location = await this.getCurrentLocation();
            
            const response = await this.apiCall('/api/scan-qr/', {
                method: 'POST',
                body: JSON.stringify({
                    token: token,
                    class_id: classId,
                    latitude: location?.latitude,
                    longitude: location?.longitude,
                    accuracy: location?.accuracy
                })
            });

            if (response.success) {
                this.showScanResult(response);
                this.refreshAttendanceData();
                this.logScanSuccess(classId, response.location_valid);
            } else {
                this.showNotification(response.message || 'Scan failed', 'error');
                this.logScanFailure(classId, response.message);
            }

        } catch (error) {
            console.error('QR scan submission error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showScanResult(data) {
        const resultsContainer = document.getElementById('scan-results');
        const resultCard = document.getElementById('result-card');
        
        resultCard.innerHTML = `
            <div class="result-success">
                <div class="result-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="result-content">
                    <h5>Attendance Marked Successfully!</h5>
                    <p><strong>Class:</strong> ${data.class_name}</p>
                    <p><strong>Time:</strong> ${new Date(data.scan_time).toLocaleTimeString()}</p>
                    <p><strong>Location Valid:</strong> ${data.location_valid ? 'Yes' : 'No'}</p>
                    <p><strong>Status:</strong> PRESENT</p>
                </div>
            </div>
        `;
        
        resultsContainer.style.display = 'block';
        this.showNotification('Attendance marked successfully!', 'success');
    }

    // ==================== MANUAL QR TOKEN ====================
    async submitQRToken(event) {
        event.preventDefault();
        
        if (!this.selectedClass) {
            this.showNotification('Please select a class first', 'warning');
            return;
        }

        const tokenInput = document.getElementById('qr-token-input');
        const token = tokenInput.value.trim();

        if (!token) {
            this.showNotification('Please enter a QR token', 'warning');
            return;
        }

        await this.submitQRScan(token, this.selectedClass.id);
        
        // Clear input
        tokenInput.value = '';
    }

    // ==================== CLASS SELECTION ====================
    selectClass(classElement) {
        // Deselect previous class
        this.deselectClass();

        // Set selected class
        this.selectedClass = {
            id: classElement.dataset.classId,
            code: classElement.dataset.unitCode,
            name: classElement.dataset.unitName,
            startTime: classElement.dataset.startTime,
            endTime: classElement.dataset.endTime,
            venue: classElement.dataset.venue,
            lecturer: classElement.dataset.lecturer,
            scheduleDate: classElement.dataset.scheduleDate
        };

        // Update UI
        classElement.classList.add('selected');
        this.updateSelectedClassInfo();
        this.enableQRInputs();

        // Start time remaining counter
        this.startTimeRemainingCounter();

        console.log('Class selected:', this.selectedClass);
    }

    selectClassFromClassesTab(classId) {
        const classElement = document.querySelector(`.ongoing-class-item[data-class-id="${classId}"]`);
        if (classElement) {
            this.selectClass(classElement);
        }
    }

    deselectClass() {
        if (this.selectedClass) {
            document.querySelectorAll('.ongoing-class-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            this.selectedClass = null;
            this.disableQRInputs();
            this.stopQRScanner();
            this.stopTimeRemainingCounter();
            
            document.getElementById('selected-class-info').style.display = 'none';
        }
    }

    updateSelectedClassInfo() {
        const container = document.getElementById('selected-class-info');
        const className = document.getElementById('selected-class-name');
        const classTime = document.getElementById('selected-class-time');
        const classVenue = document.getElementById('selected-class-venue');
        const classLecturer = document.getElementById('selected-class-lecturer');

        className.textContent = `${this.selectedClass.code} - ${this.selectedClass.name}`;
        classTime.textContent = `${this.formatTime(this.selectedClass.startTime)} - ${this.formatTime(this.selectedClass.endTime)}`;
        classVenue.textContent = this.selectedClass.venue;
        classLecturer.textContent = this.selectedClass.lecturer;

        container.style.display = 'block';
    }

    enableQRInputs() {
        document.getElementById('qr-token-input').disabled = false;
        document.getElementById('submit-token-btn').disabled = false;
        document.getElementById('start-scanner').disabled = false;
        
        document.getElementById('token-input-status').innerHTML = 
            '<i class="fas fa-check-circle text-success"></i><span>Ready for token input</span>';
    }

    disableQRInputs() {
        document.getElementById('qr-token-input').disabled = true;
        document.getElementById('submit-token-btn').disabled = true;
        document.getElementById('start-scanner').disabled = true;
        
        document.getElementById('token-input-status').innerHTML = 
            '<i class="fas fa-info-circle"></i><span>Select a class first</span>';
    }

    // ==================== LOCATION SERVICES ====================
    async initLocationServices() {
        try {
            if (!navigator.geolocation) {
                this.updateLocationStatus('Geolocation not supported', 'error');
                return;
            }

            const position = await this.getCurrentPosition();
            this.updateLocationData(position);
            this.startLocationWatching();
            
        } catch (error) {
            console.warn('Initial location request failed:', error);
            this.updateLocationStatus('Location access required', 'warning');
        }
    }

    async requestLocationPermission() {
        try {
            const position = await this.getCurrentPosition();
            this.updateLocationData(position);
            this.startLocationWatching();
            
            bootstrap.Modal.getInstance(document.getElementById('locationPermissionModal')).hide();
            
        } catch (error) {
            this.showNotification('Location access denied. Attendance marking may not work properly.', 'error');
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
    }

    startLocationWatching() {
        if (this.locationWatchId) {
            navigator.geolocation.clearWatch(this.locationWatchId);
        }

        this.locationWatchId = navigator.geolocation.watchPosition(
            (position) => this.updateLocationData(position),
            (error) => this.handleLocationError(error),
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    }

    updateLocationData(position) {
        this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };

        this.updateLocationStatus(
            `Location acquired (Accuracy: ${Math.round(position.coords.accuracy)}m)`, 
            'success'
        );
    }

    handleLocationError(error) {
        let message = 'Location unavailable';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timeout';
                break;
        }

        this.updateLocationStatus(message, 'error');
        this.currentLocation = null;
    }

    async getCurrentLocation() {
        if (this.currentLocation) {
            return this.currentLocation;
        }

        try {
            const position = await this.getCurrentPosition();
            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
        } catch (error) {
            console.warn('Could not get current location:', error);
            return null;
        }
    }

    updateLocationStatus(message, type) {
        const statusElement = document.getElementById('location-status-text');
        const icon = statusElement.previousElementSibling;
        
        statusElement.textContent = message;
        statusElement.className = type;
        icon.className = `fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} ${type}`;
    }

    updateScannerStatus(message, type) {
        const statusElement = document.querySelector('#scanner-status .status-indicator');
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        text.textContent = message;
        statusElement.className = `status-indicator ${type}`;
        icon.className = `fas fa-${this.getNotificationIcon(type)}`;
    }

    // ==================== CAMERA PERMISSIONS ====================
    async requestCameraAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            const video = document.getElementById('qr-video');
            video.srcObject = stream;
            
            return stream;
        } catch (error) {
            console.error('Camera access denied:', error);
            
            const modal = new bootstrap.Modal(document.getElementById('cameraPermissionModal'));
            modal.show();
            
            throw error;
        }
    }

    async requestCameraPermission() {
        try {
            await this.requestCameraAccess();
            bootstrap.Modal.getInstance(document.getElementById('cameraPermissionModal')).hide();
            this.startQRScanner();
        } catch (error) {
            this.showNotification('Camera access is required for QR scanning', 'error');
        }
    }

    // ==================== FILE UPLOAD QR ====================
    triggerQRUpload() {
        document.getElementById('qr-file-input').click();
    }

    async handleQRUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.updateScannerStatus('Processing uploaded image...', 'info');
            
            const result = await QrScanner.scanImage(file);
            await this.handleQRScan({ data: result });
            
        } catch (error) {
            this.updateScannerStatus('No QR code found in image', 'error');
        }
    }

    // ==================== TIME MANAGEMENT ====================
    initDynamicGreeting() {
        const greetingElement = document.getElementById('dynamic-greeting');
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        
        greetingElement.textContent = `${greeting}, ${document.querySelector('.user-name').textContent.split(' ')[0]}`;
    }

    initCountdownTimers() {
        document.querySelectorAll('.class-card').forEach(card => {
            const classId = card.dataset.classId;
            const startTime = card.dataset.startTime;
            const scheduleDate = card.dataset.scheduleDate;
            
            this.startCountdownTimer(classId, scheduleDate, startTime);
        });
    }

    startCountdownTimer(classId, scheduleDate, startTime) {
        const timerElement = document.getElementById(`countdown-${classId}`);
        if (!timerElement) return;

        const updateTimer = () => {
            const now = new Date();
            const classDateTime = new Date(`${scheduleDate}T${startTime}`);
            const timeDiff = classDateTime - now;

            if (timeDiff <= 0) {
                timerElement.textContent = 'Started';
                return;
            }

            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            
            timerElement.textContent = `${hours}h ${minutes}m`;
        };

        updateTimer();
        setInterval(updateTimer, 60000);
    }

    startTimeRemainingCounter() {
        if (!this.selectedClass) return;

        this.stopTimeRemainingCounter();

        this.timeRemainingInterval = setInterval(() => {
            const now = new Date();
            const endTime = new Date(`${this.selectedClass.scheduleDate}T${this.selectedClass.endTime}`);
            const timeDiff = endTime - now;

            if (timeDiff <= 0) {
                document.getElementById('remaining-time-text').textContent = 'Class ended';
                this.deselectClass();
                return;
            }

            const minutes = Math.floor(timeDiff / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            document.getElementById('remaining-time-text').textContent = 
                `${minutes}m ${seconds}s remaining`;
        }, 1000);
    }

    stopTimeRemainingCounter() {
        if (this.timeRemainingInterval) {
            clearInterval(this.timeRemainingInterval);
            this.timeRemainingInterval = null;
        }
    }

    updateOngoingClassesTimers() {
        document.querySelectorAll('.ongoing-class-item').forEach(item => {
            const classId = item.dataset.classId;
            const endTime = item.dataset.endTime;
            const scheduleDate = item.dataset.scheduleDate;
            
            this.updateClassTimeRemaining(classId, scheduleDate, endTime);
        });
    }

    updateClassTimeRemaining(classId, scheduleDate, endTime) {
        const timerElement = document.getElementById(`time-remaining-${classId}`);
        if (!timerElement) return;

        const updateTimer = () => {
            const now = new Date();
            const classEndTime = new Date(`${scheduleDate}T${endTime}`);
            const timeDiff = classEndTime - now;

            if (timeDiff <= 0) {
                timerElement.innerHTML = '<i class="fas fa-clock"></i><span>Class ended</span>';
                return;
            }

            const minutes = Math.floor(timeDiff / (1000 * 60));
            timerElement.innerHTML = `<i class="fas fa-clock"></i><span>${minutes}m left</span>`;
        };

        updateTimer();
        setInterval(updateTimer, 30000);
    }

    formatTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        return `${hours}:${minutes}`;
    }

    // ==================== DATA MANAGEMENT ====================
    async refreshAttendanceData() {
        try {
            await Promise.all([
                this.refreshRecentAttendance(),
                this.refreshHeaderStats(),
                this.refreshAnalyticsData()
            ]);
        } catch (error) {
            console.error('Error refreshing attendance data:', error);
        }
    }

    async refreshRecentAttendance() {
        try {
            // Fetch updated recent attendance from API
            const response = await this.apiCall('/api/student/attendance/?limit=5');
            this.updateRecentAttendanceUI(response);
            
        } catch (error) {
            console.error('Error refreshing recent attendance:', error);
        }
    }

    updateRecentAttendanceUI(attendanceData) {
        const container = document.getElementById('recent-attendance-content');
        
        if (!attendanceData || attendanceData.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-ban"></i>
                    <p>No attendance records</p>
                    <small>Scan a QR code to mark your first attendance</small>
                </div>
            `;
            return;
        }

        const html = attendanceData.map(attendance => `
            <div class="attendance-item ${attendance.status.toLowerCase()}">
                <div class="attendance-icon">
                    <i class="fas fa-${attendance.status === 'PRESENT' ? 'check-circle' : attendance.status === 'LATE' ? 'clock' : 'times-circle'}"></i>
                </div>
                <div class="attendance-info">
                    <strong>${attendance.unit_code}</strong>
                    <span>${new Date(attendance.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <small>${attendance.unit_name}</small>
                </div>
                <div class="attendance-status">
                    <span class="status-badge ${attendance.status.toLowerCase()}">${attendance.status}</span>
                    <small>${attendance.scan_time ? new Date(attendance.scan_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</small>
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="attendance-history">${html}</div>`;
    }

    async refreshHeaderStats() {
        try {
            const stats = await this.apiCall('/api/system-stats/');
            if (stats) {
                // Update header statistics
                document.getElementById('header-present-count').textContent = stats.present_classes || 0;
                document.getElementById('header-attendance-percentage').textContent = `${stats.attendance_percentage || 0}%`;
                document.getElementById('welcome-attendance-percentage').textContent = `${stats.attendance_percentage || 0}%`;
                document.getElementById('todays-classes-count').textContent = stats.today_classes || 0;
            }
        } catch (error) {
            console.error('Error refreshing header stats:', error);
        }
    }

    async loadMoreAttendance() {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/api/student/attendance/?offset=${this.attendanceOffset}&limit=20`);
            this.appendAttendanceTableRows(response);
            
            this.attendanceOffset += 20;
            
            // Hide load more button if no more data
            if (!response || response.length < 20) {
                document.getElementById('load-more-attendance').style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error loading more attendance:', error);
            this.showNotification('Failed to load more attendance records', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    appendAttendanceTableRows(attendanceData) {
        const tbody = document.getElementById('attendance-table-body');
        
        const html = attendanceData.map(attendance => `
            <tr>
                <td>${new Date(attendance.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>
                    <strong>${attendance.unit_code}</strong>
                    <br>
                    <small>${attendance.unit_name}</small>
                </td>
                <td>${attendance.lecturer}</td>
                <td>
                    <span class="status-indicator ${attendance.status.toLowerCase()}">
                        ${attendance.status}
                    </span>
                </td>
                <td>${attendance.scan_time ? new Date(attendance.scan_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>${attendance.venue}</td>
            </tr>
        `).join('');

        tbody.innerHTML += html;
    }

    async exportAttendanceCSV() {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall('/api/student/attendance/?format=csv&limit=1000');
            
            // Create and download CSV file
            const blob = new Blob([response.csv_data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Attendance data exported successfully', 'success');
            
        } catch (error) {
            console.error('Error exporting CSV:', error);
            this.showNotification('Failed to export attendance data', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ==================== ANALYTICS CHART ====================
    initAnalyticsChart() {
        const ctx = document.getElementById('attendance-trend-chart').getContext('2d');
        
        this.attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Attendance Rate (%)',
                    data: [],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
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

        this.refreshAnalyticsData();
    }

    async refreshAnalyticsData() {
        try {
            const analyticsData = await this.apiCall('/api/student/analytics/');
            this.updateChartData(analyticsData);
        } catch (error) {
            console.error('Error refreshing analytics data:', error);
        }
    }

    updateChartData(analyticsData) {
        if (this.attendanceChart && analyticsData) {
            this.attendanceChart.data.labels = analyticsData.weeks || [];
            this.attendanceChart.data.datasets[0].data = analyticsData.attendance_rates || [];
            this.attendanceChart.update();
        }
    }

    // ==================== UNIT MANAGEMENT ====================
    async showUnitDetails(unitId) {
        this.showLoading(true);
        
        try {
            const unitData = await this.apiCall(`/api/units/${unitId}/attendance/`);
            this.displayUnitDetails(unitData);
            
        } catch (error) {
            console.error('Error loading unit details:', error);
            this.showNotification('Failed to load unit details', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayUnitDetails(unitData) {
        const content = document.getElementById('unit-details-content');
        const card = document.getElementById('unit-details-card');
        
        content.innerHTML = `
            <div class="unit-analytics-header">
                <h4>${unitData.code} - ${unitData.name}</h4>
                <div class="attendance-overview">
                    <div class="attendance-stat">
                        <span class="value">${unitData.attendance_percentage}%</span>
                        <span class="label">Overall Attendance</span>
                    </div>
                    <div class="attendance-breakdown">
                        <div class="breakdown-item">
                            <span class="dot present"></span>
                            <span>Present: ${unitData.present_count}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="dot late"></span>
                            <span>Late: ${unitData.late_count}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="dot absent"></span>
                            <span>Absent: ${unitData.absent_count}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="attendance-timeline">
                <h5>Class History</h5>
                <div class="timeline">
                    ${unitData.classes.map(classItem => `
                        <div class="timeline-item ${classItem.status.toLowerCase()}">
                            <div class="timeline-date">${new Date(classItem.date).toLocaleDateString()}</div>
                            <div class="timeline-content">
                                <div class="timeline-title">${classItem.unit_code} - ${classItem.time}</div>
                                <div class="timeline-status ${classItem.status.toLowerCase()}">
                                    ${classItem.status}
                                    ${classItem.scan_time ? ` at ${new Date(classItem.scan_time).toLocaleTimeString()}` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        card.style.display = 'block';
        this.switchTab('units');
    }

    hideUnitDetails() {
        document.getElementById('unit-details-card').style.display = 'none';
    }

    async refreshUnitsData() {
        try {
            const unitsData = await this.apiCall('/api/student/units/');
            this.updateUnitsUI(unitsData);
        } catch (error) {
            console.error('Error refreshing units data:', error);
        }
    }

    updateUnitsUI(unitsData) {
        // Update units grid with fresh data
        console.log('Units data refreshed:', unitsData);
    }

    // ==================== AUTO REFRESH ====================
    startAutoRefresh() {
        // Refresh system stats every 2 minutes
        setInterval(() => {
            this.refreshHeaderStats();
        }, 120000);

        // Refresh ongoing classes every 30 seconds
        setInterval(() => {
            if (this.currentTab === 'attendance') {
                this.updateOngoingClassesTimers();
            }
        }, 30000);
    }

    // ==================== LOGGING & ANALYTICS ====================
    logScanSuccess(classId, locationValid) {
        // Log successful scan for analytics
        console.log('QR Scan Success:', { classId, locationValid, timestamp: new Date().toISOString() });
    }

    logScanFailure(classId, error) {
        // Log failed scan for analytics
        console.error('QR Scan Failure:', { classId, error, timestamp: new Date().toISOString() });
    }

    handleGlobalError(event) {
        console.error('Global error:', event.error);
        this.showNotification('An unexpected error occurred', 'error');
    }

    handlePromiseRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        this.showNotification('A system error occurred', 'error');
    }

    // ==================== CLEANUP ====================
    destroy() {
        this.stopQRScanner();
        this.stopTimeRemainingCounter();
        
        if (this.locationWatchId) {
            navigator.geolocation.clearWatch(this.locationWatchId);
        }
        
        if (this.attendanceChart) {
            this.attendanceChart.destroy();
        }
    }
}

// Initialize the portal when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.studentPortal = new StudentPortal();
});

// Global function for tab switching (called from HTML)
function showTab(tabName) {
    if (window.studentPortal) {
        window.studentPortal.switchTab(tabName);
    }
}

// Global function for hiding unit details (called from HTML)
function hideUnitDetails() {
    if (window.studentPortal) {
        window.studentPortal.hideUnitDetails();
    }
}

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (window.studentPortal) {
        window.studentPortal.destroy();
    }
});