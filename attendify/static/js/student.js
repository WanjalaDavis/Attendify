// student.js - Cyberpunk Student Portal with Real Backend Integration

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initTabSystem();
    initQRScanner();
    initTypewriter();
    initUnitDetails();
    initAnimations();
    initProgressCircles();
    loadRealTimeData();
});


function createMatrixRain(container) {
    const columns = Math.floor(window.innerWidth / 20);
    
    for (let i = 0; i < columns; i++) {
        const column = document.createElement('div');
        column.className = 'matrix-column';
        column.style.left = `${(i / columns) * 100}%`;
        
        // Create falling characters
        createFallingChar(column, i * 100);
        
        container.appendChild(column);
    }
}

function createFallingChar(column, delay) {
    const char = document.createElement('span');
    char.textContent = getRandomMatrixChar();
    char.style.cssText = `
        position: absolute;
        color: rgba(0, 255, 136, 0.3);
        font-family: 'Courier New', monospace;
        font-size: 14px;
        animation: fallDown 3s linear ${delay}ms infinite;
        opacity: 0;
    `;
    
    column.appendChild(char);
    
    // Recursively create more characters
    setTimeout(() => {
        if (column.children.length < 20) {
            createFallingChar(column, delay);
        }
    }, 100);
}

function getRandomMatrixChar() {
    const chars = '01アイウエオカキクケコサシスセソ';
    return chars[Math.floor(Math.random() * chars.length)];
}


// Tab System
function initTabSystem() {
    const tabs = document.querySelectorAll('.cyber-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to current tab and content
            this.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Load real data when switching tabs
            if (targetTab === 'attendance') {
                setTimeout(initQRScanner, 300);
            } else if (targetTab === 'units') {
                loadUnitEnrollments();
            } else if (targetTab === 'analytics') {
                loadAttendanceAnalytics();
            }
        });
    });
}

// Show specific tab from other sections
function showTab(tabName) {
    const tab = document.querySelector(`.cyber-tab[data-tab="${tabName}"]`);
    if (tab) {
        tab.click();
        
        // Scroll to top of tab content
        setTimeout(() => {
            document.querySelector('.portal-content').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }
}

// Typewriter Effect
function initTypewriter() {
    const typewriter = document.querySelector('.typewriter');
    if (!typewriter) return;
    
    const cursor = typewriter.querySelector('.cursor');
    let isVisible = true;
    
    // Blink cursor
    setInterval(() => {
        isVisible = !isVisible;
        cursor.style.opacity = isVisible ? '1' : '0';
    }, 500);
}

// Load Real-time Data
function loadRealTimeData() {
    // Update navigation stats with real data
    updateNavigationStats();
    
    // Load today's classes
    loadTodaysClasses();
    
    // Load upcoming classes
    loadUpcomingClasses();
    
    // Load recent attendance
    loadRecentAttendance();
}

// Update Navigation Stats with Real Data
function updateNavigationStats() {
    // These values are already passed from Django context
    // We'll just ensure they're displayed correctly
    const presentClasses = document.querySelector('.nav-stats .stat:nth-child(1) .stat-value');
    const enrolledUnits = document.querySelector('.nav-stats .stat:nth-child(2) .stat-value');
    const attendanceRate = document.querySelector('.nav-stats .stat:nth-child(3) .stat-value');
    
    if (presentClasses) {
        presentClasses.textContent = window.presentClasses || '0';
    }
    if (enrolledUnits) {
        enrolledUnits.textContent = window.enrolledUnits || '0';
    }
    if (attendanceRate) {
        attendanceRate.textContent = `${window.attendancePercentage || '0'}%`;
    }
}

// Load Today's Classes with Real Data
function loadTodaysClasses() {
    const todaysClassesContainer = document.querySelector('.classes-list');
    if (!todaysClassesContainer) return;
    
    // Data is already loaded from Django template
    // We just need to enhance with dynamic functionality
    const ongoingClasses = document.querySelectorAll('.class-item.ongoing');
    ongoingClasses.forEach(classItem => {
        const scanButton = classItem.querySelector('.cyber-button');
        if (scanButton) {
            scanButton.addEventListener('click', function(e) {
                e.preventDefault();
                showTab('attendance');
                // Auto-start scanner when switching to attendance tab
                setTimeout(() => {
                    const startScannerBtn = document.getElementById('start-scanner');
                    if (startScannerBtn) {
                        startScannerBtn.click();
                    }
                }, 500);
            });
        }
    });
}

// Load Upcoming Classes with Real Data
function loadUpcomingClasses() {
    const upcomingClassesContainer = document.querySelector('.compact-list');
    if (!upcomingClassesContainer) return;
    
    // Data is already loaded from Django template
    // Add hover effects and interactions
    const upcomingItems = document.querySelectorAll('.compact-item');
    upcomingItems.forEach(item => {
        item.addEventListener('click', function() {
            const classInfo = this.querySelector('strong').textContent;
            showNotification(`Viewing details for ${classInfo}`, 'info');
        });
    });
}

// Load Recent Attendance with Real Data
function loadRecentAttendance() {
    const attendanceHistory = document.querySelector('.attendance-history');
    if (!attendanceHistory) return;
    
    // Data is already loaded from Django template
    // Add status color coding
    const attendanceItems = document.querySelectorAll('.attendance-item');
    attendanceItems.forEach(item => {
        const status = item.classList.contains('present') ? 'PRESENT' : 
                      item.classList.contains('late') ? 'LATE' : 'ABSENT';
        
        // Add click to view details
        item.addEventListener('click', function() {
            const unitCode = this.querySelector('strong').textContent;
            const statusText = this.querySelector('.status-badge').textContent;
            showNotification(`${unitCode}: ${statusText}`, 'info');
        });
    });
}

// QR Scanner Functionality with Real Backend Integration
function initQRScanner() {
    const startScannerBtn = document.getElementById('start-scanner');
    const uploadQrBtn = document.getElementById('upload-qr');
    const qrFileInput = document.getElementById('qr-file-input');
    const scannerStatus = document.getElementById('scanner-status');
    
    let scanner = null;
    let isScanning = false;
    
    // Start camera scanner
    if (startScannerBtn) {
        startScannerBtn.addEventListener('click', async function() {
            if (isScanning) {
                stopScanner();
                return;
            }
            
            try {
                // Request camera permission
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                
                // Show video element
                const scannerVideo = document.getElementById('qr-video');
                scannerVideo.style.display = 'block';
                scannerVideo.srcObject = stream;
                scannerVideo.play();
                
                // Initialize QR scanner
                scanner = new QrScanner(
                    scannerVideo,
                    result => handleQRResult(result),
                    {
                        highlightScanRegion: true,
                        highlightCodeOutline: true,
                        maxScansPerSecond: 5
                    }
                );
                
                await scanner.start();
                isScanning = true;
                
                // Update UI
                startScannerBtn.innerHTML = '<i class="fas fa-stop"></i> STOP SCANNING';
                startScannerBtn.classList.add('secondary');
                updateScannerStatus('Scanner active - Point camera at QR code', 'success');
                
            } catch (error) {
                console.error('QR Scanner error:', error);
                updateScannerStatus('Camera access denied or unavailable', 'error');
                
                // Fallback to file upload
                setTimeout(() => {
                    if (uploadQrBtn) uploadQrBtn.click();
                }, 2000);
            }
        });
    }
    
    // Upload QR image
    if (uploadQrBtn && qrFileInput) {
        uploadQrBtn.addEventListener('click', function() {
            qrFileInput.click();
        });
        
        qrFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.match('image.*')) {
                updateScannerStatus('Please select an image file', 'error');
                return;
            }
            
            // Read and process image
            const reader = new FileReader();
            reader.onload = function(e) {
                processQRImage(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Process QR image for scanning
    function processQRImage(imageData) {
        updateScannerStatus('Processing QR image...', 'processing');
        
        // Create temporary image element
        const img = new Image();
        img.onload = function() {
            // Use QrScanner to decode from image
            QrScanner.scanImage(img, { returnDetailedScanResult: true })
                .then(result => {
                    if (result && result.data) {
                        handleQRResult(result);
                    } else {
                        updateScannerStatus('No QR code found in image', 'error');
                    }
                })
                .catch(error => {
                    console.error('QR scan error:', error);
                    updateScannerStatus('Failed to decode QR from image', 'error');
                });
        };
        img.src = imageData;
    }
    
    // Handle QR result with real backend API call
    function handleQRResult(result) {
        if (!result || !result.data) return;
        
        updateScannerStatus('QR Code detected - Processing...', 'processing');
        
        try {
            // Parse QR data (assuming it's a JSON string from your backend)
            const qrData = JSON.parse(result.data);
            
            // Validate QR data structure
            if (!qrData.token || !qrData.class_id) {
                throw new Error('Invalid QR code format');
            }
            
            // Get current location for validation
            getCurrentLocation()
                .then(location => {
                    // Send scan data to backend
                    submitAttendanceScan(qrData.token, location.latitude, location.longitude);
                })
                .catch(locationError => {
                    // Submit without location if permission denied
                    submitAttendanceScan(qrData.token, null, null);
                });
                
        } catch (e) {
            // If not JSON, treat as simple token
            getCurrentLocation()
                .then(location => {
                    submitAttendanceScan(result.data, location.latitude, location.longitude);
                })
                .catch(locationError => {
                    submitAttendanceScan(result.data, null, null);
                });
        }
    }
    
    // Submit attendance scan to backend
    function submitAttendanceScan(token, latitude, longitude) {
        const csrfToken = getCSRFToken();
        
        fetch('/api/scan-qr/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                token: token,
                latitude: latitude,
                longitude: longitude
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateScannerStatus(data.message, 'success');
                
                // Visual feedback
                const scannerFrame = document.querySelector('.scanner-frame');
                if (scannerFrame) {
                    scannerFrame.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.7)';
                    setTimeout(() => {
                        scannerFrame.style.boxShadow = '';
                    }, 2000);
                }
                
                // Refresh attendance data
                setTimeout(() => {
                    loadRecentAttendance();
                    loadAttendanceAnalytics();
                }, 1000);
                
            } else {
                updateScannerStatus(data.message, 'error');
            }
            
            // Stop scanner after processing
            setTimeout(() => {
                stopScanner();
            }, 3000);
        })
        .catch(error => {
            console.error('Scan submission error:', error);
            updateScannerStatus('Network error - Please try again', 'error');
        });
    }
    
    // Stop scanner
    function stopScanner() {
        if (scanner) {
            scanner.stop();
            scanner = null;
        }
        
        const scannerVideo = document.getElementById('qr-video');
        if (scannerVideo && scannerVideo.srcObject) {
            scannerVideo.srcObject.getTracks().forEach(track => track.stop());
            scannerVideo.srcObject = null;
            scannerVideo.style.display = 'none';
        }
        
        isScanning = false;
        
        // Reset UI
        if (startScannerBtn) {
            startScannerBtn.innerHTML = '<i class="fas fa-camera"></i> START CAMERA SCAN';
            startScannerBtn.classList.remove('secondary');
        }
        
        updateScannerStatus('Scanner ready for initialization', 'ready');
    }
    
    // Update scanner status
    function updateScannerStatus(message, type) {
        if (!scannerStatus) return;
        
        const indicator = scannerStatus.querySelector('.status-indicator');
        const icon = indicator.querySelector('i');
        const text = indicator.querySelector('span');
        
        text.textContent = message;
        
        // Update icon based on status type
        icon.className = 'fas fa-circle';
        switch(type) {
            case 'success':
                icon.style.color = 'var(--neon-green)';
                break;
            case 'error':
                icon.style.color = '#ff4444';
                break;
            case 'processing':
                icon.style.color = 'var(--neon-blue)';
                icon.classList.add('fa-spin');
                break;
            default:
                icon.style.color = 'var(--neon-green)';
        }
    }
}

// Unit Details System with Real Data
function initUnitDetails() {
    const viewButtons = document.querySelectorAll('.view-attendance');
    const detailsCard = document.getElementById('unit-details-card');
    const detailsContent = document.getElementById('unit-details-content');
    
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const unitId = this.getAttribute('data-unit-id');
            loadUnitDetails(unitId);
        });
    });
}

// Load Unit Details with Real Data
function loadUnitDetails(unitId) {
    const detailsCard = document.getElementById('unit-details-card');
    const detailsContent = document.getElementById('unit-details-content');
    
    if (!detailsCard || !detailsContent) return;
    
    // Show loading state
    detailsContent.innerHTML = `
        <div class="empty-state small">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading unit details...</p>
        </div>
    `;
    
    detailsCard.style.display = 'block';
    
    // Scroll to details card
    detailsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Fetch unit details from backend
    fetch(`/student/portal/?unit_id=${unitId}`, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.text())
    .then(html => {
        // Parse the HTML response to extract unit data
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract unit attendance data from the page
        const unitData = extractUnitDataFromPage(doc, unitId);
        renderUnitDetails(unitData);
    })
    .catch(error => {
        console.error('Error loading unit details:', error);
        detailsContent.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load unit details</p>
            </div>
        `;
    });
}

// Extract unit data from page response
function extractUnitDataFromPage(doc, unitId) {
    // This function extracts the unit data that Django already rendered
    // In a real implementation, you might want to create a dedicated API endpoint
    
    const unitElement = doc.querySelector(`[data-unit-id="${unitId}"]`);
    if (!unitElement) {
        throw new Error('Unit not found');
    }
    
    // Extract basic unit info
    const unitCode = unitElement.querySelector('.unit-header h4')?.textContent || 'Unknown';
    const unitName = unitElement.querySelector('.unit-body h5')?.textContent || 'Unknown';
    const lecturer = unitElement.querySelector('.meta-item:nth-child(1) span')?.textContent || 'Unknown';
    const semester = unitElement.querySelector('.meta-item:nth-child(2) span')?.textContent || 'Unknown';
    
    // Extract attendance data
    const progressFill = unitElement.querySelector('.progress-fill');
    const attendancePercentage = progressFill ? 
        parseInt(progressFill.style.width) : 0;
    
    return {
        unitCode: unitCode,
        unitName: unitName,
        lecturer: lecturer.replace('Dr. ', ''),
        semester: semester,
        attendancePercentage: attendancePercentage
    };
}

// Render Unit Details
function renderUnitDetails(data) {
    const detailsContent = document.getElementById('unit-details-content');
    if (!detailsContent) return;
    
    detailsContent.innerHTML = `
        <div class="unit-details-header">
            <h4>${data.unitCode} - ${data.unitName}</h4>
            <p>Lecturer: Dr. ${data.lecturer} | Semester: ${data.semester}</p>
        </div>
        
        <div class="attendance-breakdown">
            <div class="breakdown-item">
                <span class="label">Attendance Rate</span>
                <span class="value">${data.attendancePercentage}%</span>
            </div>
        </div>
        
        <div class="unit-actions">
            <button class="cyber-button small" onclick="viewFullUnitReport('${data.unitCode}')">
                <i class="fas fa-chart-bar"></i> VIEW FULL REPORT
            </button>
        </div>
        
        <div class="performance-tips">
            <h5><i class="fas fa-lightbulb"></i> PERFORMANCE TIPS</h5>
            <div class="tip-item">
                <i class="fas fa-check-circle"></i>
                <span>Maintain attendance above 75% for optimal performance</span>
            </div>
            <div class="tip-item">
                <i class="fas fa-clock"></i>
                <span>Attend classes regularly to avoid falling behind</span>
            </div>
        </div>
    `;
}

// View Full Unit Report
function viewFullUnitReport(unitCode) {
    showNotification(`Generating full report for ${unitCode}...`, 'info');
    // In a real implementation, this would generate/download a PDF report
}

// Hide unit details
function hideUnitDetails() {
    const detailsCard = document.getElementById('unit-details-card');
    if (detailsCard) {
        detailsCard.style.display = 'none';
    }
}

// Load Unit Enrollments
function loadUnitEnrollments() {
    // Data is already loaded from Django template
    // Add interactive functionality
    const unitCards = document.querySelectorAll('.unit-card');
    unitCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
        
        // Add click to view details
        const viewButton = this.querySelector('.view-attendance');
        if (viewButton) {
            viewButton.addEventListener('click', function(e) {
                e.stopPropagation();
                const unitId = this.getAttribute('data-unit-id');
                loadUnitDetails(unitId);
            });
        }
    });
}

// Load Attendance Analytics
function loadAttendanceAnalytics() {
    // Update progress circles with real data
    updateProgressCircles();
    
    // Enhance analytics with interactive features
    const trendBars = document.querySelectorAll('.chart-bar-trend');
    trendBars.forEach(bar => {
        bar.addEventListener('mouseenter', function() {
            const height = this.style.height;
            const day = this.querySelector('.bar-label').textContent;
            showTooltip(this, `${day}: ${height} attendance`);
        });
        
        bar.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });
}

// Update Progress Circles with Real Data
function updateProgressCircles() {
    const progressCircles = document.querySelectorAll('.circle-progress');
    
    progressCircles.forEach(circle => {
        const percentage = circle.getAttribute('data-percentage');
        if (percentage) {
            circle.style.setProperty('--percentage', percentage);
            
            // Animate the progress
            const circleAfter = circle.querySelector('::after') || circle;
            circleAfter.style.animation = 'circleFill 2s ease forwards';
        }
    });
}

// Initialize animations
function initAnimations() {
    // Add intersection observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.cyber-card, .stat, .class-item').forEach(el => {
        observer.observe(el);
    });
    
    // Add CSS for animation
    const style = document.createElement('style');
    style.textContent = `
        .cyber-card, .stat, .class-item {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .cyber-card.animate-in, .stat.animate-in, .class-item.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .cyber-card:nth-child(odd) { transition-delay: 0.1s; }
        .cyber-card:nth-child(even) { transition-delay: 0.2s; }
        .stat:nth-child(1) { transition-delay: 0.1s; }
        .stat:nth-child(2) { transition-delay: 0.2s; }
        .stat:nth-child(3) { transition-delay: 0.3s; }
        
        @keyframes circleFill {
            to {
                transform: rotate(calc(1deg * (var(--percentage) * 3.6)));
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize progress circles
function initProgressCircles() {
    updateProgressCircles();
}

// Utility function to get CSRF token (for Django)
function getCSRFToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Get current location (for attendance validation)
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
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
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `cyber-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <div class="notification-progress"></div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Tooltip system
function showTooltip(element, text) {
    let tooltip = document.querySelector('.cyber-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'cyber-tooltip';
        document.body.appendChild(tooltip);
    }
    
    const rect = element.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 40}px`;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    const tooltip = document.querySelector('.cyber-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// Add notification and tooltip styles
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .cyber-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--card-bg);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 6px;
        padding: 1rem;
        min-width: 300px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 10000;
        overflow: hidden;
    }
    
    .cyber-notification.show {
        transform: translateX(0);
    }
    
    .cyber-notification.success {
        border-color: var(--neon-green);
    }
    
    .cyber-notification.error {
        border-color: #ff4444;
    }
    
    .cyber-notification.warning {
        border-color: #ffbd2e;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.5rem;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
    
    .notification-content span {
        flex: 1;
    }
    
    .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: var(--neon-green);
        animation: notificationProgress 5s linear forwards;
    }
    
    @keyframes notificationProgress {
        from { width: 100%; }
        to { width: 0%; }
    }
    
    .cyber-tooltip {
        position: fixed;
        background: var(--card-bg);
        border: 1px solid var(--neon-green);
        border-radius: 4px;
        padding: 0.5rem 1rem;
        color: var(--text-primary);
        font-size: 0.8rem;
        z-index: 10001;
        transform: translateX(-50%);
        display: none;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    
    .cyber-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: var(--neon-green);
    }
    
    .performance-tips {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .performance-tips h5 {
        color: var(--neon-green);
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .tip-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .tip-item i {
        color: var(--neon-green);
        font-size: 0.7rem;
    }
`;
document.head.appendChild(additionalStyles);

// Auto-refresh data every 30 seconds
setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadRealTimeData();
    }
}, 30000);

// Export functions for global access
window.showTab = showTab;
window.hideUnitDetails = hideUnitDetails;
window.showNotification = showNotification;
window.viewFullUnitReport = viewFullUnitReport;