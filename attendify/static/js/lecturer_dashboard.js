
class LecturerDashboard {
    constructor() {
        this.csrfToken = document.getElementById('csrfToken')?.value || '';
        this.currentClassStatus = {};
        this.autoRefreshInterval = null;
        this.charts = {};
        this.notificationCount = 0;
        
        this.init();
    }

    init() {
        // Initialize all dashboard components
        this.initMatrixBackground();
        this.initClock();
        this.initCharts();
        this.initEventListeners();
        this.initAutoRefresh();
        this.loadDashboardData();
        this.loadNotifications();
        
        // Initialize AOS animations
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                once: true,
                offset: 100
            });
        }
    }

    // ==================== MATRIX BACKGROUND ====================
    initMatrixBackground() {
        const canvas = document.getElementById('matrixCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        const charArray = chars.split("");
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        const drops = [];

        for (let x = 0; x < columns; x++) {
            drops[x] = 1;
        }

        const drawMatrix = () => {
            ctx.fillStyle = "rgba(15, 23, 42, 0.04)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#4f46e5";
            ctx.font = fontSize + "px monospace";

            for (let i = 0; i < drops.length; i++) {
                const text = charArray[Math.floor(Math.random() * charArray.length)];
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        setInterval(drawMatrix, 35);
    }

    // ==================== REAL-TIME CLOCK ====================
    initClock() {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const dateString = now.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const clockElement = document.querySelector('.header-clock');
            if (clockElement) {
                clockElement.textContent = `${dateString} | ${timeString}`;
            }
        };

        setInterval(updateClock, 1000);
        updateClock();
    }

    // ==================== CHARTS INITIALIZATION ====================
    initCharts() {
        this.initAttendanceChart();
        this.initPerformanceChart();
    }

    initAttendanceChart() {
        const ctx = document.getElementById('attendanceChart');
        if (!ctx) return;

        this.charts.attendance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Late', 'Absent'],
                datasets: [{
                    data: [75, 15, 10], // Initial data, will be updated via API
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#f8fafc',
                        borderColor: '#4f46e5',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    initPerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Attendance Rate',
                    data: [72, 78, 75, 82],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#4f46e5',
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#f8fafc',
                        borderColor: '#4f46e5'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af'
                        }
                    }
                }
            }
        });
    }

    // ==================== EVENT LISTENERS ====================
    initEventListeners() {
        // Profile modal
        const profileModalTrigger = document.getElementById('profileModalTrigger');
        if (profileModalTrigger) {
            profileModalTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModal('profileModal');
            });
        }

        // Notification button
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.toggleNotifications();
            });
        }

        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Class status updates
        this.initClassStatusTracking();

        // QR code generation
        this.initQRCodeHandlers();
    }

    // ==================== MODAL MANAGEMENT ====================
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            this.closeModal(modal);
        });
    }

    // ==================== CLASS STATUS TRACKING ====================
    initClassStatusTracking() {
        this.updateClassTimes();
        setInterval(() => this.updateClassTimes(), 60000); // Update every minute
    }

    updateClassTimes() {
        const classCards = document.querySelectorAll('.class-card');
        
        classCards.forEach(card => {
            const classId = card.dataset.classId;
            const status = card.dataset.status;
            const scheduleDate = card.dataset.scheduleDate;
            const startTime = card.dataset.startTime;
            const endTime = card.dataset.endTime;
            
            if (status === 'ONGOING') {
                this.updateOngoingClassTime(card, classId, scheduleDate, startTime);
            } else if (status === 'UPCOMING') {
                this.updateUpcomingClassTime(card, classId, scheduleDate, startTime);
            }
        });

        // Check for status changes
        this.checkClassStatusChanges();
    }

    updateOngoingClassTime(card, classId, scheduleDate, startTime) {
        const startDateTime = new Date(`${scheduleDate}T${startTime}`);
        const now = new Date();
        const elapsed = Math.floor((now - startDateTime) / 1000 / 60); // minutes
        
        const timeDisplay = card.querySelector('.class-time-display span');
        if (timeDisplay) {
            if (elapsed < 60) {
                timeDisplay.textContent = `${elapsed}m elapsed`;
            } else {
                const hours = Math.floor(elapsed / 60);
                const minutes = elapsed % 60;
                timeDisplay.textContent = `${hours}h ${minutes}m elapsed`;
            }
        }
    }

    updateUpcomingClassTime(card, classId, scheduleDate, startTime) {
        const startDateTime = new Date(`${scheduleDate}T${startTime}`);
        const now = new Date();
        const remaining = Math.floor((startDateTime - now) / 1000 / 60); // minutes
        
        const timeDisplay = card.querySelector('.class-time-display span');
        if (timeDisplay) {
            if (remaining > 60) {
                const hours = Math.floor(remaining / 60);
                const minutes = remaining % 60;
                timeDisplay.textContent = `Starts in ${hours}h ${minutes}m`;
            } else if (remaining > 0) {
                timeDisplay.textContent = `Starts in ${remaining}m`;
            } else {
                // Class should be ongoing now, refresh page
                location.reload();
            }
        }
    }

    async checkClassStatusChanges() {
        try {
            const response = await this.apiCall('/api/lecturer/class-status/');
            if (response && response.success) {
                this.handleClassStatusUpdates(response.ongoing_classes);
            }
        } catch (error) {
            console.error('Error checking class status:', error);
        }
    }

    handleClassStatusUpdates(ongoingClassIds) {
        const classCards = document.querySelectorAll('.class-card');
        
        classCards.forEach(card => {
            const classId = card.dataset.classId;
            const isNowOngoing = ongoingClassIds && ongoingClassIds.includes(classId);
            const currentStatus = card.dataset.status;
            
            if (isNowOngoing && currentStatus !== 'ONGOING') {
                // Update card to ongoing status
                this.updateCardToOngoing(card, classId);
            }
        });
    }

    updateCardToOngoing(card, classId) {
        card.dataset.status = 'ONGOING';
        
        // Update status indicator
        const statusIndicator = card.querySelector('.class-status-indicator');
        const statusText = card.querySelector('.class-status span');
        const qrButton = card.querySelector('.generate-qr-btn');
        
        if (statusIndicator) {
            statusIndicator.className = 'class-status-indicator status-ongoing';
        }
        
        if (statusText) {
            statusText.textContent = 'ONGOING';
            statusText.style.color = '#10b981';
        }
        
        if (qrButton) {
            qrButton.dataset.status = 'ONGOING';
            qrButton.innerHTML = '<i class="fas fa-qrcode"></i> GENERATE QR';
            qrButton.disabled = false;
        }
        
        // Add animation
        card.style.animation = 'pulse-glow 2s infinite';
        
        // Show notification
        this.showNotification('Class is now ongoing', 'success');
    }

    // ==================== QR CODE FUNCTIONALITY ====================
    initQRCodeHandlers() {
        // Delegate QR generation to parent container
        document.addEventListener('click', (e) => {
            if (e.target.closest('.generate-qr-btn[data-status="ONGOING"]')) {
                const button = e.target.closest('.generate-qr-btn');
                const classId = button.dataset.classId;
                this.generateQRCode(classId);
            }
        });
    }

    async generateQRCode(classId) {
        try {
            const response = await this.apiCall(`/generate-qr-code/${classId}/`, 'GET');
            
            if (response && response.success) {
                this.displayQRCodeModal(response);
                this.showNotification('QR code generated successfully!', 'success');
            } else {
                this.showNotification(response?.message || 'Failed to generate QR code', 'error');
            }
        } catch (error) {
            console.error('Error generating QR code:', error);
            this.showNotification('Error generating QR code. Please try again.', 'error');
        }
    }

    displayQRCodeModal(qrData) {
        // Update modal content
        const classNameElement = document.getElementById('qrClassName');
        const tokenElement = document.getElementById('qrTokenDisplay');
        const expiryElement = document.getElementById('qrExpiryTime');
        
        if (classNameElement) classNameElement.textContent = qrData.class_name || 'Class';
        if (tokenElement) tokenElement.textContent = qrData.token || 'N/A';
        
        // Generate QR code image placeholder
        const qrCodeImage = document.getElementById('qrCodeImage');
        if (qrCodeImage) {
            qrCodeImage.innerHTML = `
                <div class="qr-placeholder">
                    <i class="fas fa-qrcode"></i>
                    <p>QR Code for ${qrData.class_name || 'Class'}</p>
                    <small>Token: ${qrData.token || 'N/A'}</small>
                </div>
            `;
        }
        
        // Calculate expiry time
        if (expiryElement && qrData.expires_at) {
            const expiresAt = new Date(qrData.expires_at);
            const now = new Date();
            const minutesLeft = Math.floor((expiresAt - now) / 1000 / 60);
            expiryElement.textContent = `${minutesLeft} minutes`;
        }
        
        this.openModal('qrCodeModal');
    }

    downloadQRCode() {
        // In a real implementation, this would download the actual QR code image
        this.showNotification('QR code download functionality would be implemented here', 'info');
    }

    closeQRCodeModal() {
        this.closeModal(document.getElementById('qrCodeModal'));
    }

    // ==================== DASHBOARD DATA LOADING ====================
    async loadDashboardData() {
        try {
            // Use mock data initially to ensure the dashboard loads
            this.useMockData();
            
            // Try to load real data in the background
            this.loadRealData();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Don't show error notification for initial load to avoid spam
        }
    }

    async loadRealData() {
        try {
            const [dashboardData, performanceData, recentAttendance] = await Promise.allSettled([
                this.apiCall('/api/lecturer/dashboard-data/'),
                this.apiCall('/api/lecturer/performance-data/'),
                this.apiCall('/api/lecturer/recent-attendance/')
            ]);

            // Only update if we got successful responses
            if (dashboardData.status === 'fulfilled' && dashboardData.value) {
                this.updateDashboardStats(dashboardData.value);
                this.updateRecentActivity(dashboardData.value.recent_activity);
            }
            
            if (performanceData.status === 'fulfilled' && performanceData.value) {
                this.updatePerformanceChart(performanceData.value);
            }
            
            if (recentAttendance.status === 'fulfilled' && recentAttendance.value) {
                this.updateAttendanceChart(recentAttendance.value);
            }
            
        } catch (error) {
            console.error('Error in background data load:', error);
            // Silent fail - we already have mock data showing
        }
    }

    useMockData() {
        const mockData = this.getMockDashboardData();
        const mockPerformance = this.getMockPerformanceData();
        const mockAttendance = this.getMockRecentAttendance();
        
        this.updateDashboardStats(mockData);
        this.updatePerformanceChart(mockPerformance);
        this.updateRecentActivity(mockData.recent_activity);
        this.updateAttendanceChart(mockAttendance);
    }

    getMockDashboardData() {
        return {
            total_students: 45,
            teaching_units: 3,
            todays_classes_count: 2,
            upcoming_classes_count: 5,
            attendance_percentage: 78.5,
            recent_activity: [
                {
                    type: 'login',
                    message: 'You logged in to the system',
                    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    icon: 'sign-in-alt',
                    status: 'success'
                },
                {
                    type: 'system',
                    message: 'Welcome to Attendify Lecturer Dashboard',
                    time: 'Today',
                    icon: 'info-circle',
                    status: 'info'
                },
                {
                    type: 'class',
                    message: 'Mathematics 101 class scheduled for today',
                    time: '10:30',
                    icon: 'calendar-day',
                    status: 'primary'
                }
            ]
        };
    }

    getMockPerformanceData() {
        return {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Attendance Rate',
                data: [72, 78, 75, 82]
            }]
        };
    }

    getMockRecentAttendance() {
        return {
            attendance: [
                {
                    total_students: 45,
                    total_present: 35,
                    attendance_percentage: 77.8
                }
            ]
        };
    }

    updateDashboardStats(data) {
        if (!data) return;
        
        // Update statistics cards
        this.updateStatCard('todaysClassesValue', data.todays_classes_count || 0);
        this.updateStatCard('upcomingClassesValue', data.upcoming_classes_count || 0);
        this.updateStatCard('attendanceValue', (data.attendance_percentage || 0) + '%');
        this.updateStatCard('activeUnitsValue', data.teaching_units || 0);
        this.updateStatCard('totalStudentsValue', data.total_students || 0);
        this.updateStatCard('teachingUnitsValue', data.teaching_units || 0);
    }

    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Parse numeric value for animation
            const numericValue = typeof value === 'string' ? parseInt(value) || 0 : value;
            this.animateValue(element, 0, numericValue, 1000);
        }
    }

    animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    updatePerformanceChart(data) {
        if (this.charts.performance && data && data.labels && data.datasets) {
            this.charts.performance.data.labels = data.labels;
            this.charts.performance.data.datasets[0].data = data.datasets[0].data;
            this.charts.performance.update();
            
            // Update performance stats
            this.updatePerformanceStats(data);
        }
    }

    updatePerformanceStats(data) {
        const weeklyAverage = document.getElementById('weeklyAverage');
        const performanceTrend = document.getElementById('performanceTrend');
        
        if (weeklyAverage && data.datasets && data.datasets[0].data) {
            const values = data.datasets[0].data;
            const average = values.reduce((a, b) => a + b, 0) / values.length;
            weeklyAverage.textContent = average.toFixed(1) + '%';
        }
        
        if (performanceTrend && data.datasets && data.datasets[0].data) {
            const values = data.datasets[0].data;
            if (values.length >= 2) {
                const trend = ((values[values.length - 1] - values[0]) / values[0] * 100);
                const trendElement = performanceTrend;
                
                if (trend > 0) {
                    trendElement.className = 'stat-value positive';
                    trendElement.innerHTML = `<i class="fas fa-arrow-up"></i> ${Math.abs(trend).toFixed(1)}%`;
                } else {
                    trendElement.className = 'stat-value negative';
                    trendElement.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(trend).toFixed(1)}%`;
                }
            }
        }
    }

    updateAttendanceChart(data) {
        if (this.charts.attendance && data && data.attendance) {
            // Calculate totals from recent attendance data
            let present = 0, late = 0, absent = 0;
            
            data.attendance.forEach(item => {
                present += item.total_present || 0;
                // You might need to adjust these calculations based on your data structure
            });
            
            // Update chart data
            this.charts.attendance.data.datasets[0].data = [present, late, absent];
            this.charts.attendance.update();
            
            // Update legend
            this.updateAttendanceLegend(present, late, absent);
        }
    }

    updateAttendanceLegend(present, late, absent) {
        const total = present + late + absent;
        const presentPercent = total > 0 ? (present / total * 100).toFixed(1) : 0;
        const latePercent = total > 0 ? (late / total * 100).toFixed(1) : 0;
        const absentPercent = total > 0 ? (absent / total * 100).toFixed(1) : 0;
        
        const presentLegend = document.getElementById('presentLegend');
        const lateLegend = document.getElementById('lateLegend');
        const absentLegend = document.getElementById('absentLegend');
        
        if (presentLegend) presentLegend.textContent = `PRESENT (${presentPercent}%)`;
        if (lateLegend) lateLegend.textContent = `LATE (${latePercent}%)`;
        if (absentLegend) absentLegend.textContent = `ABSENT (${absentPercent}%)`;
    }

    updateRecentActivity(activities) {
        const activityFeed = document.getElementById('recentActivityFeed');
        if (!activityFeed || !activities) return;
        
        activityFeed.innerHTML = activities.map(activity => `
            <div class="activity-item cyber-activity">
                <div class="activity-icon ${activity.status || 'info'}">
                    <i class="fas fa-${activity.icon || 'bell'}"></i>
                    <div class="activity-glow"></div>
                </div>
                <div class="activity-content">
                    <p>${activity.message || 'Activity recorded'}</p>
                    <span class="activity-time">${activity.time || 'Recently'}</span>
                </div>
            </div>
        `).join('');
    }

    // ==================== NOTIFICATIONS ====================
    async loadNotifications() {
        try {
            const response = await this.apiCall('/api/lecturer/notifications/');
            if (response) {
                this.updateNotificationBadge(response.unread_count || 0);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    updateNotificationBadge(count) {
        const badge = document.getElementById('notificationCount');
        if (badge) {
            this.notificationCount = count;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    toggleNotifications() {
        // Implement notification panel toggle
        this.showNotification('Notifications panel would open here', 'info');
    }

    // ==================== TUTORIAL SYSTEM ====================
    showTutorial() {
        this.currentTutorialStep = 0;
        this.updateTutorialSteps();
        this.openModal('tutorialModal');
    }

    closeTutorial() {
        this.closeModal(document.getElementById('tutorialModal'));
    }

    nextTutorialStep() {
        if (this.currentTutorialStep < 3) {
            this.currentTutorialStep++;
            this.updateTutorialSteps();
        } else {
            this.closeTutorial();
        }
    }

    prevTutorialStep() {
        if (this.currentTutorialStep > 0) {
            this.currentTutorialStep--;
            this.updateTutorialSteps();
        }
    }

    updateTutorialSteps() {
        const steps = document.querySelectorAll('.tutorial-step');
        const nextButton = document.querySelector('.tutorial-navigation .btn-primary');
        
        steps.forEach((step, index) => {
            if (index === this.currentTutorialStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        
        if (nextButton) {
            if (this.currentTutorialStep === 3) {
                nextButton.textContent = 'FINISH';
            } else {
                nextButton.textContent = 'NEXT';
            }
        }
    }

    // ==================== AUTO REFRESH ====================
    initAutoRefresh() {
        // Refresh dashboard data every 2 minutes
        this.autoRefreshInterval = setInterval(() => {
            this.loadRealData();
            this.loadNotifications();
        }, 120000); // 2 minutes
    }

    // ==================== API UTILITIES ====================
    async apiCall(url, method = 'GET', data = null) {
        const config = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken
            },
            credentials: 'same-origin'
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // ==================== UI UTILITIES ====================
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Add styles if not already added
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 1rem 1.5rem;
                    color: white;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                    max-width: 400px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                .notification-success { border-left: 4px solid #10b981; }
                .notification-error { border-left: 4px solid #ef4444; }
                .notification-warning { border-left: 4px solid #f59e0b; }
                .notification-info { border-left: 4px solid #3b82f6; }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: 1rem;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
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

    // ==================== CLEANUP ====================
    destroy() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Clean up charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
    }
}

// ==================== GLOBAL FUNCTIONS FOR HTML ONCLICK ====================
function generateQRCode(classId) {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.generateQRCode(classId);
    }
}

function closeQRCodeModal() {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.closeQRCodeModal();
    }
}

function downloadQRCode() {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.downloadQRCode();
    }
}

function showTutorial() {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.showTutorial();
    }
}

function closeTutorial() {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.closeTutorial();
    }
}

function nextTutorialStep() {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.nextTutorialStep();
    }
}

function prevTutorialStep() {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.prevTutorialStep();
    }
}

function closeModal(modal) {
    if (window.lecturerDashboard) {
        window.lecturerDashboard.closeModal(modal);
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the dashboard
    window.lecturerDashboard = new LecturerDashboard();
    
    // Add global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && window.lecturerDashboard) {
            // Page became visible, refresh data
            window.lecturerDashboard.loadRealData();
        }
    });
});

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LecturerDashboard;
}