// dashboard.js - Professional Student Dashboard JavaScript

// ===== GLOBAL VARIABLES =====
let activityFeedInterval = null;
let systemStatusCheckInterval = null;

// ===== DOCUMENT READY =====
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    startRealTimeUpdates();
});

// ===== DASHBOARD INITIALIZATION =====
function initializeDashboard() {
    console.log('🚀 Initializing Attendify Dashboard...');
    
    // Update welcome message based on time of day
    updateWelcomeMessage();
    
    // Initialize module animations
    initializeModuleAnimations();
    
    // Load initial data
    loadDashboardData();
    
    // Check system status
    checkSystemStatus();
    
    // Initialize any charts or visualizations
    initializeDataVisualizations();
    
    console.log('✅ Dashboard initialized successfully');
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    // Profile modal functionality
    setupProfileModal();
    
    // Module card interactions
    setupModuleInteractions();
    
    // Quick action cards
    setupQuickActions();
    
    // System status updates
    setupSystemMonitoring();
    
    // Window events
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', cleanupDashboard);
}

// ===== PROFILE MODAL FUNCTIONS =====
function setupProfileModal() {
    const profileModal = document.getElementById('profileModal');
    const openProfileModal = document.getElementById('openProfileModal');
    const profileModuleLink = document.getElementById('profileModuleLink');
    const profileActionButton = document.getElementById('profileActionButton');
    const footerProfileLink = document.getElementById('footerProfileLink');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const cancelProfile = document.getElementById('cancelProfile');
    
    // Open modal from various elements
    [openProfileModal, profileModuleLink, profileActionButton, footerProfileLink].forEach(element => {
        if (element) {
            element.addEventListener('click', function(e) {
                e.preventDefault();
                openModal(profileModal);
            });
        }
    });
    
    // Close modal
    [closeProfileModal, cancelProfile].forEach(element => {
        if (element) {
            element.addEventListener('click', function() {
                closeModal(profileModal);
            });
        }
    });
    
    // Close modal when clicking outside content
    profileModal.addEventListener('click', function(e) {
        if (e.target === profileModal) {
            closeModal(profileModal);
        }
    });
    
    // Profile picture preview
    const profilePictureInput = document.getElementById('id_profile_picture');
    const profilePreview = document.getElementById('profilePreview');
    
    if (profilePictureInput && profilePreview) {
        profilePictureInput.addEventListener('change', function() {
            handleProfilePictureUpload(this, profilePreview);
        });
    }
    
    // Password strength indicator
    const passwordInput1 = document.getElementById('id_new_password1');
    const passwordStrength = document.getElementById('passwordStrength');
    const passwordText = document.getElementById('passwordText');
    
    if (passwordInput1 && passwordStrength && passwordText) {
        passwordInput1.addEventListener('input', function() {
            updatePasswordStrength(this.value, passwordStrength, passwordText);
        });
    }
    
    // Form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileFormSubmit);
    }
}

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscapeKey);
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            closeModal(activeModal);
        }
    }
}

function handleProfilePictureUpload(input, preview) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            showNotification('Please select a valid image file (JPEG, PNG, GIF)', 'error');
            input.value = '';
            return;
        }
        
        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (file.size > maxSize) {
            showNotification('File size must be less than 5MB', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.src = e.target.result;
            showNotification('Profile picture updated successfully', 'success');
        };
        
        reader.onerror = function() {
            showNotification('Error reading file', 'error');
        };
        
        reader.readAsDataURL(file);
    }
}

function updatePasswordStrength(password, strengthBar, strengthText) {
    let strength = 0;
    let text = 'Weak';
    let color = '#ef4444';
    
    // Length check
    if (password.length >= 8) strength += 25;
    
    // Uppercase check
    if (/[A-Z]/.test(password)) strength += 25;
    
    // Number check
    if (/[0-9]/.test(password)) strength += 25;
    
    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    // Determine strength level
    if (strength >= 75) {
        text = 'Strong';
        color = '#10b981';
    } else if (strength >= 50) {
        text = 'Medium';
        color = '#f59e0b';
    }
    
    // Update UI
    strengthBar.style.width = strength + '%';
    strengthBar.style.backgroundColor = color;
    strengthText.textContent = text;
    strengthText.style.color = color;
}

function handleProfileFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Basic validation
    const newPassword1 = document.getElementById('id_new_password1').value;
    const newPassword2 = document.getElementById('id_new_password2').value;
    
    if (newPassword1 && newPassword1 !== newPassword2) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitButton.disabled = true;
    
    // Simulate API call (replace with actual API call)
    simulateProfileUpdate(formData)
        .then(response => {
            showNotification('Profile updated successfully', 'success');
            closeModal(document.getElementById('profileModal'));
            
            // Update user info in header if needed
            updateUserInfo(response.data);
        })
        .catch(error => {
            console.error('Profile update error:', error);
            showNotification('Failed to update profile: ' + error.message, 'error');
        })
        .finally(() => {
            // Restore button state
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        });
}

function simulateProfileUpdate(formData) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate successful update
            const response = {
                success: true,
                message: 'Profile updated successfully',
                data: {
                    first_name: formData.get('first_name') || 'User',
                    last_name: formData.get('last_name') || '',
                    // Add other updated fields as needed
                }
            };
            resolve(response);
        }, 2000);
    });
}

function updateUserInfo(userData) {
    // Update user name in header if first name changed
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement && userData.first_name) {
        const currentName = userNameElement.textContent.split(' ')[0];
        if (currentName !== userData.first_name) {
            userNameElement.textContent = `${userData.first_name} ${userData.last_name || ''}`.trim();
        }
    }
}

// ===== MODULE INTERACTIONS =====
function setupModuleInteractions() {
    const moduleCards = document.querySelectorAll('.module-card');
    
    moduleCards.forEach(card => {
        // Add hover effects
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
        
        // Add click analytics
        card.addEventListener('click', function() {
            const moduleName = this.querySelector('h4').textContent;
            logModuleInteraction(moduleName);
        });
    });
}

function initializeModuleAnimations() {
    // Animate module cards on load
    const moduleCards = document.querySelectorAll('.module-card');
    
    moduleCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// ===== QUICK ACTIONS =====
function setupQuickActions() {
    const actionCards = document.querySelectorAll('.action-card');
    
    actionCards.forEach(card => {
        card.addEventListener('click', function(e) {
            const actionName = this.querySelector('h5').textContent;
            logQuickAction(actionName);
            
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// ===== REAL-TIME UPDATES =====
function startRealTimeUpdates() {
    // Update activity feed every 30 seconds
    activityFeedInterval = setInterval(updateActivityFeed, 30000);
    
    // Check system status every minute
    systemStatusCheckInterval = setInterval(checkSystemStatus, 60000);
    
    // Update time-based elements every minute
    setInterval(updateTimeBasedElements, 60000);
}

function updateActivityFeed() {
    const activityFeed = document.querySelector('.activity-feed');
    if (!activityFeed) return;
    
    // Simulate new activity (replace with actual data fetch)
    const newActivity = generateRandomActivity();
    const activityItem = createActivityItem(newActivity);
    
    // Add new activity to top
    activityFeed.insertBefore(activityItem, activityFeed.firstChild);
    
    // Limit to 10 items
    const items = activityFeed.querySelectorAll('.activity-item');
    if (items.length > 10) {
        activityFeed.removeChild(items[items.length - 1]);
    }
    
    // Add animation
    activityItem.style.opacity = '0';
    activityItem.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        activityItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        activityItem.style.opacity = '1';
        activityItem.style.transform = 'translateY(0)';
    }, 10);
}

function generateRandomActivity() {
    const activities = [
        { icon: 'fas fa-sync', message: 'System sync completed successfully' },
        { icon: 'fas fa-database', message: 'Database backup initiated' },
        { icon: 'fas fa-shield-alt', message: 'Security scan completed - No threats found' },
        { icon: 'fas fa-chart-line', message: 'Performance metrics updated' },
        { icon: 'fas fa-network-wired', message: 'Network connectivity optimized' }
    ];
    
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    return {
        ...randomActivity,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    };
}

function createActivityItem(activity) {
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    
    activityItem.innerHTML = `
        <div class="activity-icon">
            <i class="${activity.icon}"></i>
        </div>
        <div class="activity-content">
            <p>${activity.message}</p>
            <span class="activity-time">${activity.timestamp}</span>
        </div>
    `;
    
    return activityItem;
}

function checkSystemStatus() {
    // Simulate system status check (replace with actual API call)
    const status = Math.random() > 0.1 ? 'operational' : 'degraded'; // 90% chance of operational
    
    updateSystemStatusIndicator(status);
}

function updateSystemStatusIndicator(status) {
    const statusIndicator = document.querySelector('.status-indicator');
    const onlineIndicator = document.querySelector('.online-indicator');
    
    if (status === 'operational') {
        if (statusIndicator) {
            statusIndicator.innerHTML = '<i class="fas fa-server"></i><span>All Systems Operational</span>';
            statusIndicator.style.color = 'var(--success)';
        }
        if (onlineIndicator) {
            onlineIndicator.innerHTML = '<i class="fas fa-circle"></i> LIVE';
            onlineIndicator.style.color = 'var(--success)';
        }
    } else {
        if (statusIndicator) {
            statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>System Degraded</span>';
            statusIndicator.style.color = 'var(--warning)';
        }
        if (onlineIndicator) {
            onlineIndicator.innerHTML = '<i class="fas fa-circle"></i> DEGRADED';
            onlineIndicator.style.color = 'var(--warning)';
        }
        
        showNotification('System performance may be affected', 'warning', 5000);
    }
}

function updateTimeBasedElements() {
    updateWelcomeMessage();
    updateLastLoginTime();
}

function updateWelcomeMessage() {
    const welcomeHeading = document.querySelector('.welcome-content h2');
    if (!welcomeHeading) return;
    
    const hour = new Date().getHours();
    let greeting = 'Welcome back';
    
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';
    
    const userName = welcomeHeading.textContent.split(', ')[1] || '';
    welcomeHeading.textContent = `${greeting}, ${userName}`;
}

function updateLastLoginTime() {
    const lastLoginElement = document.querySelector('.welcome-meta .meta-item:first-child');
    if (lastLoginElement) {
        lastLoginElement.innerHTML = `<i class="fas fa-clock"></i>Last login: ${new Date().toLocaleString()}`;
    }
}

// ===== DATA LOADING =====
function loadDashboardData() {
    // Simulate loading dashboard data
    showLoadingState();
    
    Promise.all([
        simulateUserDataLoad(),
        simulateCourseDataLoad(),
        simulateAttendanceDataLoad()
    ])
    .then(([userData, courseData, attendanceData]) => {
        updateDashboardWithData(userData, courseData, attendanceData);
        hideLoadingState();
    })
    .catch(error => {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load some dashboard data', 'error');
        hideLoadingState();
    });
}

function simulateUserDataLoad() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                streak: 15,
                attendanceRate: 92
            });
        }, 1000);
    });
}

function simulateCourseDataLoad() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                enrolledUnits: 6,
                activeCourses: 1
            });
        }, 800);
    });
}

function simulateAttendanceDataLoad() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                presentClasses: 45,
                totalClasses: 52
            });
        }, 1200);
    });
}

function updateDashboardWithData(userData, courseData, attendanceData) {
    // Update stats in header
    updateHeaderStats(userData, courseData);
    
    // Update module content with real data
    updateModuleContent(attendanceData);
}

function updateHeaderStats(userData, courseData) {
    // Update streak count
    const streakElement = document.querySelector('.header-stats .stat-item:nth-child(3) .stat-value');
    if (streakElement && userData.streak) {
        streakElement.textContent = userData.streak;
    }
    
    // Update course count
    const courseElement = document.querySelector('.header-stats .stat-item:nth-child(2) .stat-value');
    if (courseElement && courseData.activeCourses) {
        courseElement.textContent = courseData.activeCourses;
    }
}

function updateModuleContent(attendanceData) {
    // Update any module content that depends on loaded data
    // This would be expanded based on specific data needs
}

// ===== SYSTEM MONITORING =====
function setupSystemMonitoring() {
    // Monitor network status
    window.addEventListener('online', () => {
        showNotification('Connection restored', 'success');
        updateSystemStatusIndicator('operational');
    });
    
    window.addEventListener('offline', () => {
        showNotification('Connection lost - some features may not work', 'error');
        updateSystemStatusIndicator('degraded');
    });
    
    // Monitor page visibility
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Page became visible, refresh data
            loadDashboardData();
        }
    });
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.dashboard-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `dashboard-notification ${type}`;
    
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
            .dashboard-notification {
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
            
            .dashboard-notification.success {
                border-left-color: var(--success);
            }
            
            .dashboard-notification.error {
                border-left-color: var(--error);
            }
            
            .dashboard-notification.warning {
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

// ===== LOADING STATES =====
function showLoadingState() {
    const mainContent = document.querySelector('.dashboard-main');
    if (mainContent) {
        mainContent.style.opacity = '0.7';
        mainContent.style.pointerEvents = 'none';
    }
}

function hideLoadingState() {
    const mainContent = document.querySelector('.dashboard-main');
    if (mainContent) {
        mainContent.style.opacity = '1';
        mainContent.style.pointerEvents = 'auto';
    }
}

// ===== DATA VISUALIZATIONS =====
function initializeDataVisualizations() {
    // Initialize any charts or data visualizations
    // This would be expanded based on specific visualization needs
    
    // Example: Animate progress bars
    animateProgressBars();
}

function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-fill');
    
    progressBars.forEach(bar => {
        const originalWidth = bar.style.width;
        bar.style.width = '0%';
        
        setTimeout(() => {
            bar.style.transition = 'width 1s ease-in-out';
            bar.style.width = originalWidth;
        }, 500);
    });
}

// ===== ANALYTICS & LOGGING =====
function logModuleInteraction(moduleName) {
    console.log(`Module accessed: ${moduleName}`);
    // Send to analytics service
    // analytics.track('module_access', { module: moduleName });
}

function logQuickAction(actionName) {
    console.log(`Quick action: ${actionName}`);
    // Send to analytics service
    // analytics.track('quick_action', { action: actionName });
}

// ===== WINDOW EVENT HANDLERS =====
function handleResize() {
    // Handle any responsive behavior
    const headerStats = document.querySelector('.header-stats');
    if (headerStats && window.innerWidth < 768) {
        // Adjust stats layout for mobile
        headerStats.style.flexDirection = 'row';
        headerStats.style.justifyContent = 'space-around';
    }
}

function cleanupDashboard() {
    // Clear intervals
    if (activityFeedInterval) clearInterval(activityFeedInterval);
    if (systemStatusCheckInterval) clearInterval(systemStatusCheckInterval);
    
    // Remove event listeners
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('beforeunload', cleanupDashboard);
}

// ===== ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('An unexpected error occurred', 'error');
});

// Make functions globally available
window.showNotification = showNotification;

console.log('✅ Dashboard JavaScript loaded successfully');