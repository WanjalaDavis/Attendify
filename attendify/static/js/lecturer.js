// lecturer.js - Enhanced Lecturer Dashboard JavaScript

class MatrixBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.characters = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
        this.drops = [];
        this.fontSize = 14;
        this.columns = 0;
        this.initialize();
    }

    initialize() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Initialize drops
        for (let i = 0; i < this.columns; i++) {
            this.drops[i] = Math.random() * -100;
        }
        
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.columns = Math.floor(this.canvas.width / this.fontSize);
    }

    draw() {
        // Semi-transparent black to create trail effect
        this.ctx.fillStyle = 'rgba(5, 5, 8, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#00ff41';
        this.ctx.font = `${this.fontSize}px monospace`;
        
        for (let i = 0; i < this.drops.length; i++) {
            const text = this.characters.charAt(Math.floor(Math.random() * this.characters.length));
            const x = i * this.fontSize;
            const y = this.drops[i] * this.fontSize;
            
            // Draw character with varying opacity
            const opacity = Math.random() * 0.5 + 0.5;
            this.ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
            this.ctx.fillText(text, x, y);
            
            // Reset drop if it reaches bottom or randomly
            if (y > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }
            
            this.drops[i]++;
        }
    }

    animate() {
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Global state
let dashboardData = {
    totalStudents: 0,
    teachingUnits: 0,
    todaysClasses: 0,
    upcomingClasses: 0,
    attendancePercentage: 0,
    recentActivity: []
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Matrix Background
    const matrix = new MatrixBackground('matrixCanvas');
    
    // Initialize navigation
    initializeNavigation();
    
    // Load real data from backend
    loadDashboardData();
    
    // Initialize charts
    initializeCharts();
    
    // Add interactive effects
    initializeInteractiveEffects();
    
    // Initialize modals
    initializeModals();
    
    // Show loading spinner briefly
    showLoadingSpinner();
    
    // Initialize clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Start real-time updates
    startRealTimeUpdates();
});

// Initialize navigation tabs
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all tabs
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding tab content
            const tabId = this.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
            
            // Load specific data for the tab if needed
            const tabName = this.getAttribute('data-tab');
            if (tabName === 'analytics') {
                loadAnalyticsData();
            } else if (tabName === 'students') {
                loadStudentsData();
            }
        });
    });
}

// Load real dashboard data from backend
async function loadDashboardData() {
    try {
        showLoadingSpinner();
        
        // Fetch dashboard data from API
        const response = await fetch('/api/lecturer/dashboard-data/', {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load dashboard data');
        }
        
        const data = await response.json();
        dashboardData = data;
        
        // Update UI with real data
        updateDashboardUI(data);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data. Using cached data.', 'error');
        
        // Fallback to template data
        updateDashboardUIWithTemplateData();
    } finally {
        hideLoadingSpinner();
    }
}

// Update UI with real backend data
function updateDashboardUI(data) {
    // Update stats cards
    updateStatCard('unitsCount', data.teaching_units || '0');
    updateStatCard('totalStudents', data.total_students || '0');
    updateStatCard('todaysClasses', data.todays_classes_count || '0');
    updateStatCard('attendancePercentage', `${data.attendance_percentage || '0'}%`);
    
    // Update tables with real data
    updateTodaysClassesTable(data.todays_classes || []);
    updateUpcomingClassesTable(data.upcoming_classes || []);
    
    // Update charts with real data
    updateCharts(data);
    
    // Update empty states visibility
    updateEmptyStates(data);
}

function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Fallback to template data if API fails
function updateDashboardUIWithTemplateData() {
    // These values come from Django template context
    const unitsCount = document.querySelector('.stat-card:nth-child(1) .stat-value').textContent;
    const totalStudents = document.querySelector('.stat-card:nth-child(2) .stat-value').textContent;
    
    // Update dynamic elements
    updateStatCard('todaysClasses', document.querySelectorAll('.data-table tbody tr').length);
    
    // Show/hide empty states based on actual content
    updateEmptyStates({
        todays_classes_count: document.querySelectorAll('.data-table tbody tr').length,
        upcoming_classes_count: 0
    });
}

// Update empty states based on data
function updateEmptyStates(data) {
    const noClassesToday = document.querySelector('.empty-state');
    const todaysClassesTable = document.querySelector('.data-table');
    
    if (noClassesToday && todaysClassesTable) {
        const hasClasses = data.todays_classes_count > 0;
        noClassesToday.style.display = hasClasses ? 'none' : 'flex';
        todaysClassesTable.style.display = hasClasses ? 'table' : 'none';
    }
}

// Initialize all charts
function initializeCharts() {
    initializeAttendanceTrendChart();
    initializeAttendancePieChart();
    initializeUnitAttendanceChart();
    initializePerformanceChart();
    initializeUnitDistributionChart();
}

// Update all charts with real data
function updateCharts(data) {
    updateAttendanceTrendChart(data.attendance_trends || []);
    updateAttendancePieChart(data.attendance_distribution || { present: 75, late: 15, absent: 10 });
    updateUnitAttendanceChart(data.unit_attendance || []);
}

// Initialize Attendance Trend Chart
function initializeAttendanceTrendChart() {
    const ctx = document.getElementById('attendanceTrendChart');
    if (!ctx) return;
    
    const config = {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
            datasets: [{
                label: 'Attendance Rate',
                data: [75, 82, 78, 85, 88, 90],
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
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
    };
    
    new Chart(ctx, config);
}

// Initialize Attendance Pie Chart
function initializeAttendancePieChart() {
    const ctx = document.getElementById('attendancePieChart');
    if (!ctx) return;
    
    const config = {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent', 'Late'],
            datasets: [{
                data: [75, 15, 10],
                backgroundColor: [
                    '#10b981',
                    '#ef4444',
                    '#f59e0b'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    };
    
    new Chart(ctx, config);
}

// Initialize Unit Attendance Chart
function initializeUnitAttendanceChart() {
    const ctx = document.getElementById('unitAttendanceChart');
    if (!ctx) return;
    
    const config = {
        type: 'bar',
        data: {
            labels: ['CSC 101', 'MAT 202', 'PHY 103', 'ENG 104'],
            datasets: [{
                label: 'Attendance Rate',
                data: [92, 76, 88, 81],
                backgroundColor: '#4f46e5'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
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
    };
    
    new Chart(ctx, config);
}

// Initialize Performance Chart
function initializePerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    const config = {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'CSC 101',
                data: [78, 82, 85, 88, 90, 92],
                borderColor: '#4f46e5',
                tension: 0.3
            }, {
                label: 'MAT 202',
                data: [72, 75, 76, 78, 80, 82],
                borderColor: '#10b981',
                tension: 0.3
            }, {
                label: 'PHY 103',
                data: [80, 82, 84, 85, 87, 88],
                borderColor: '#f59e0b',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
    };
    
    new Chart(ctx, config);
}

// Initialize Unit Distribution Chart
function initializeUnitDistributionChart() {
    const ctx = document.getElementById('unitDistributionChart');
    if (!ctx) return;
    
    const config = {
        type: 'pie',
        data: {
            labels: ['CSC 101', 'MAT 202', 'PHY 103', 'ENG 104'],
            datasets: [{
                data: [30, 25, 25, 20],
                backgroundColor: [
                    '#4f46e5',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    };
    
    new Chart(ctx, config);
}

// Update charts with real data
function updateAttendanceTrendChart(trendData) {
    // Implementation for updating trend chart with real data
}

function updateAttendancePieChart(distributionData) {
    // Implementation for updating pie chart with real data
}

function updateUnitAttendanceChart(unitData) {
    // Implementation for updating unit attendance chart with real data
}

// Update tables with real data
function updateTodaysClassesTable(classes) {
    const tbody = document.querySelector('#todaysClassesList tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    classes.forEach(classData => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${classData.unit_code}</strong><br>
                <small class="text-muted">${classData.unit_name}</small>
            </td>
            <td>${classData.time}</td>
            <td>${classData.venue}</td>
            <td>
                <span class="badge bg-${getStatusClass(classData.status)}">${classData.status}</span>
            </td>
            <td>
                ${classData.status === 'ONGOING' ? 
                    `<button class="btn btn-primary btn-sm generate-qr-btn" data-class-id="${classData.id}">
                        <i class="fas fa-qrcode"></i>
                    </button>` : 
                    `<button class="btn btn-outline-secondary btn-sm" disabled>
                        <i class="fas fa-clock"></i>
                    </button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateUpcomingClassesTable(classes) {
    // Similar implementation for upcoming classes table
}

function getStatusClass(status) {
    switch(status) {
        case 'ONGOING': return 'success';
        case 'UPCOMING': return 'warning';
        case 'ENDED': return 'secondary';
        default: return 'secondary';
    }
}

// Initialize Interactive Effects
function initializeInteractiveEffects() {
    // Add hover effects to dashboard cards
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Add click effects to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            createRippleEffect(this, e);
        });
    });
    
    // Initialize QR code generation buttons
    const qrButtons = document.querySelectorAll('.generate-qr-btn');
    qrButtons.forEach(button => {
        button.addEventListener('click', function() {
            const classId = this.getAttribute('data-class-id');
            generateQRCode(classId);
        });
    });
    
    // Initialize form submissions
    const scheduleForm = document.getElementById('schedule-class-form');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', function(e) {
            // Let Django handle the form submission normally
            // We just show loading state
            showFormLoading(this);
        });
    }
    
    // Initialize report generation form
    const reportForm = document.getElementById('report-generation-form');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            showFormLoading(this);
        });
    }
}

// Create ripple effect for buttons
function createRippleEffect(button, event) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Modal functionality
function initializeModals() {
    // QR Code Modal
    const qrModal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
    
    // Delete Class Modal
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteClassModal'));
    
    // Initialize delete class buttons
    const deleteButtons = document.querySelectorAll('.delete-class-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const classId = this.getAttribute('data-class-id');
            showDeleteConfirmation(classId);
        });
    });
    
    // Confirm delete button
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            const classId = this.getAttribute('data-class-id');
            deleteClass(classId);
        });
    }
    
    // Download QR button
    const downloadQrBtn = document.getElementById('download-modal-qr');
    if (downloadQrBtn) {
        downloadQrBtn.addEventListener('click', downloadQRCode);
    }
}

function showDeleteConfirmation(classId) {
    const confirmBtn = document.getElementById('confirm-delete-btn');
    if (confirmBtn) {
        confirmBtn.setAttribute('data-class-id', classId);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('deleteClassModal'));
    modal.show();
}

// REAL QR Code Generation with Backend Integration
async function generateQRCode(classId) {
    showLoadingSpinner();
    
    try {
        const response = await fetch(`/api/generate-qr/${classId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showQRCodeModal(data);
        } else {
            showNotification(data.message || 'Failed to generate QR code', 'error');
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        showNotification('Error generating QR code. Please try again.', 'error');
    } finally {
        hideLoadingSpinner();
    }
}

// Show QR Code Modal
function showQRCodeModal(qrData) {
    const modal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
    const qrImage = document.getElementById('modal-qr-code');
    const qrClassInfo = document.getElementById('qr-class-info');
    const qrExpiryInfo = document.getElementById('qr-expiry-info');
    
    if (qrImage) {
        // Clear previous QR code
        qrImage.innerHTML = '';
        
        // Generate new QR code
        new QRCode(qrImage, {
            text: qrData.qr_data || `CLASS_${qrData.class_id}`,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
    
    if (qrClassInfo) {
        qrClassInfo.textContent = qrData.class_name || 'Class Session';
    }
    
    if (qrExpiryInfo) {
        qrExpiryInfo.textContent = `Expires in ${qrData.expires_in || '5 minutes'}`;
    }
    
    modal.show();
}

// Delete class function
async function deleteClass(classId) {
    try {
        const response = await fetch(`/api/delete-class/${classId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            showNotification('Class deleted successfully', 'success');
            // Remove the class from the UI
            document.querySelector(`[data-class-id="${classId}"]`).remove();
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteClassModal'));
            modal.hide();
            
            // Reload dashboard data
            loadDashboardData();
        } else {
            throw new Error('Failed to delete class');
        }
    } catch (error) {
        console.error('Error deleting class:', error);
        showNotification('Error deleting class. Please try again.', 'error');
    }
}

function downloadQRCode() {
    // Implement QR code download functionality
    showNotification('QR code download feature coming soon!', 'info');
}

// Show Loading Spinner
function showLoadingSpinner() {
    // Create spinner if it doesn't exist
    let spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.className = 'loading-overlay';
        spinner.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Processing your request...</p>
        `;
        document.body.appendChild(spinner);
    }
    spinner.style.display = 'flex';
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

// Show form loading state
function showFormLoading(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
    submitBtn.disabled = true;
    
    // Re-enable after a timeout (form submission will reload the page)
    setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }, 5000);
}

// Real-time clock in header
function updateClock() {
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
    
    let clockElement = document.querySelector('.header-clock');
    if (!clockElement) {
        clockElement = document.createElement('div');
        clockElement.className = 'header-clock';
        document.querySelector('.header-right').prepend(clockElement);
    }
    
    clockElement.innerHTML = `
        <div class="clock-time">${timeString}</div>
        <div class="clock-date">${dateString}</div>
    `;
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'info' ? 'info-circle' : 'check-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Real-time updates
function startRealTimeUpdates() {
    // Update class status every 30 seconds
    setInterval(updateClassStatus, 30000);
    
    // Update dashboard data every 2 minutes
    setInterval(loadDashboardData, 120000);
}

// Update class status in real-time
async function updateClassStatus() {
    try {
        const response = await fetch('/api/lecturer/class-status/', {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateOngoingClasses(data.ongoing_classes || []);
        }
    } catch (error) {
        console.error('Error updating class status:', error);
    }
}

function updateOngoingClasses(ongoingClasses) {
    const classRows = document.querySelectorAll('.data-table tr');
    classRows.forEach(row => {
        const classId = row.getAttribute('data-class-id');
        const isOngoing = ongoingClasses.includes(parseInt(classId));
        
        const statusElement = row.querySelector('.badge');
        const qrButton = row.querySelector('.generate-qr-btn');
        
        if (statusElement && qrButton) {
            if (isOngoing) {
                statusElement.textContent = 'ONGOING';
                statusElement.className = 'badge bg-success';
                qrButton.disabled = false;
                qrButton.className = 'btn btn-primary btn-sm generate-qr-btn';
            } else {
                statusElement.textContent = 'ENDED';
                statusElement.className = 'badge bg-secondary';
                qrButton.disabled = true;
                qrButton.className = 'btn btn-outline-secondary btn-sm';
            }
        }
    });
}

// Utility function to get CSRF token
function getCSRFToken() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
    return csrfToken ? csrfToken.value : '';
}

// Load additional data for specific tabs
async function loadAnalyticsData() {
    try {
        const response = await fetch('/api/lecturer/analytics/', {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateAnalyticsCharts(data);
        }
    } catch (error) {
        console.error('Error loading analytics data:', error);
    }
}

async function loadStudentsData() {
    try {
        const response = await fetch('/api/lecturer/students/', {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateStudentsTable(data);
        }
    } catch (error) {
        console.error('Error loading students data:', error);
    }
}

function updateAnalyticsCharts(data) {
    // Update analytics charts with detailed data
}

function updateStudentsTable(students) {
    const tbody = document.querySelector('#studentsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.email}</td>
            <td>${student.units_count}</td>
            <td>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-success" style="width: ${student.attendance_rate}%"></div>
                </div>
                <small>${student.attendance_rate}%</small>
            </td>
            <td>
                <span class="badge bg-${student.status === 'Active' ? 'success' : 'warning'}">${student.status}</span>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Add CSS for dynamic elements
const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
    .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(79, 70, 229, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 23, 42, 0.8);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        flex-direction: column;
        color: white;
    }
    
    .loading-spinner {
        width: 50px;
        height: 50px;
        border: 3px solid transparent;
        border-top: 3px solid #4f46e5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--card-bg-solid);
        border: 1px solid var(--card-border);
        padding: 15px 20px;
        border-radius: var(--radius-md);
        color: var(--text-primary);
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 300px;
        backdrop-filter: blur(10px);
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid var(--status-success);
    }
    
    .notification.error {
        border-left: 4px solid var(--status-danger);
    }
    
    .notification.info {
        border-left: 4px solid var(--info-color);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .header-clock {
        text-align: right;
        margin-right: 15px;
        color: var(--primary-color);
        font-family: monospace;
    }
    
    .clock-time {
        font-size: 1.1em;
        font-weight: bold;
    }
    
    .clock-date {
        font-size: 0.8em;
        opacity: 0.8;
    }
    
    /* Responsive table */
    @media (max-width: 768px) {
        .data-table {
            font-size: 0.8rem;
        }
        
        .data-table th,
        .data-table td {
            padding: 0.5rem;
        }
        
        .btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.7rem;
        }
    }
    
    /* Print styles */
    @media print {
        .dashboard-sidebar,
        .dashboard-header,
        .dashboard-footer,
        .btn {
            display: none !important;
        }
        
        .dashboard-main {
            padding: 0;
        }
        
        .dashboard-card {
            box-shadow: none;
            border: 1px solid #ddd;
        }
    }
`;
document.head.appendChild(dynamicStyles);

// Export functions for global access if needed
window.MatrixBackground = MatrixBackground;
window.dashboardData = dashboardData;
window.showNotification = showNotification;