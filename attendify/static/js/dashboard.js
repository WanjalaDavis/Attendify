// Attendify Dashboard JavaScript
class AttendifyDashboard {
    constructor() {
        this.init();
    }

    init() {
        this.initializeAnimations();
        this.initializeEventListeners();
        this.initializeRealTimeUpdates();
        this.initializePerformanceMonitoring();
    }

    // Initialize animations and effects
    initializeAnimations() {
        // Add loading animation to cards
        this.animateCards();
        
        // Initialize hover effects
        this.initializeHoverEffects();
        
        // Initialize progress animations
        this.animateProgressBars();
    }

    // Animate dashboard cards with staggered delay
    animateCards() {
        const cards = document.querySelectorAll('.module-card, .action-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    // Initialize hover effects for interactive elements
    initializeHoverEffects() {
        // Card hover effects
        const cards = document.querySelectorAll('.module-card, .action-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });

        // Button hover effects
        const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
            });
        });
    }

    // Animate progress bars with loading effect
    animateProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill');
        progressBars.forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0';
            
            setTimeout(() => {
                bar.style.transition = 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
                bar.style.width = width;
            }, 500);
        });
    }

    // Initialize all event listeners
    initializeEventListeners() {
        this.initializeProfileModal();
        this.initializePasswordStrength();
        this.initializeImageUpload();
        this.initializeActivityRefresh();
        this.initializeQuickActions();
        this.initializeHeaderInteractions();
    }

    // Profile Modal Management
    initializeProfileModal() {
        const profileModal = document.getElementById('profileModal');
        const openTriggers = [
            document.getElementById('openProfileModal'),
            document.getElementById('profileModuleLink'),
            document.getElementById('profileActionButton'),
            document.getElementById('footerProfileLink')
        ];
        const closeTriggers = [
            document.getElementById('closeProfileModal'),
            document.getElementById('cancelProfile')
        ];

        // Open modal
        openTriggers.forEach(trigger => {
            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openModal(profileModal);
                });
            }
        });

        // Close modal
        closeTriggers.forEach(trigger => {
            if (trigger) {
                trigger.addEventListener('click', () => {
                    this.closeModal(profileModal);
                });
            }
        });

        // Close on backdrop click
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                this.closeModal(profileModal);
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileModal.classList.contains('active')) {
                this.closeModal(profileModal);
            }
        });
    }

    // Modal open/close methods
    openModal(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Add animation class
        const modalContainer = modal.querySelector('.modal-container');
        modalContainer.style.animation = 'modalSlideIn 0.3s ease-out';
    }

    closeModal(modal) {
        const modalContainer = modal.querySelector('.modal-container');
        modalContainer.style.animation = 'modalSlideOut 0.3s ease-in';
        
        setTimeout(() => {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }, 250);
    }

    // Password Strength Indicator
    initializePasswordStrength() {
        const passwordInput = document.getElementById('id_new_password1');
        const strengthBar = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordText');

        if (!passwordInput || !strengthBar || !strengthText) return;

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            const strength = this.calculatePasswordStrength(password);
            this.updatePasswordStrengthUI(strength, strengthBar, strengthText);
        });
    }

    calculatePasswordStrength(password) {
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 10;
        
        // Character variety checks
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;
        
        return Math.min(strength, 100);
    }

    updatePasswordStrengthUI(strength, bar, text) {
        let color, message;
        
        if (strength >= 75) {
            color = '#10b981';
            message = 'Strong';
        } else if (strength >= 50) {
            color = '#f59e0b';
            message = 'Medium';
        } else {
            color = '#ef4444';
            message = 'Weak';
        }
        
        bar.style.width = strength + '%';
        bar.style.backgroundColor = color;
        text.textContent = message;
        text.style.color = color;
    }

    // Image Upload with Preview
    initializeImageUpload() {
        const fileInput = document.getElementById('id_profile_picture');
        const preview = document.getElementById('profilePreview');

        if (!fileInput || !preview) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (this.validateImageFile(file)) {
                    this.previewImage(file, preview);
                } else {
                    this.showNotification('Please select a valid image file (PNG, JPG up to 5MB)', 'error');
                    fileInput.value = '';
                }
            }
        });
    }

    validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        return validTypes.includes(file.type) && file.size <= maxSize;
    }

    previewImage(file, previewElement) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            previewElement.src = e.target.result;
            
            // Add success animation
            previewElement.style.transform = 'scale(1.1)';
            setTimeout(() => {
                previewElement.style.transform = 'scale(1)';
            }, 300);
        };
        
        reader.onerror = () => {
            this.showNotification('Error reading image file', 'error');
        };
        
        reader.readAsDataURL(file);
    }

    // Activity Feed Refresh
    initializeActivityRefresh() {
        const refreshBtn = document.querySelector('.refresh-btn');
        if (!refreshBtn) return;

        refreshBtn.addEventListener('click', () => {
            this.refreshActivityFeed();
        });
    }

    refreshActivityFeed() {
        const refreshBtn = document.querySelector('.refresh-btn');
        const activityFeed = document.querySelector('.activity-feed');
        
        // Add loading state
        refreshBtn.style.animation = 'spin 1s linear infinite';
        refreshBtn.style.pointerEvents = 'none';
        
        // Simulate API call
        setTimeout(() => {
            // Add new activity item
            const newActivity = this.generateRandomActivity();
            const activityItem = this.createActivityItem(newActivity);
            
            activityFeed.insertBefore(activityItem, activityFeed.firstChild);
            
            // Remove loading state
            refreshBtn.style.animation = '';
            refreshBtn.style.pointerEvents = 'auto';
            
            // Show notification
            this.showNotification('Activity feed updated', 'success');
            
            // Limit to 10 items
            if (activityFeed.children.length > 10) {
                activityFeed.removeChild(activityFeed.lastChild);
            }
        }, 1000);
    }

    generateRandomActivity() {
        const activities = [
            { icon: 'user-check', type: 'success', text: 'System health check completed successfully' },
            { icon: 'database', type: 'info', text: 'Data synchronization in progress' },
            { icon: 'shield-alt', type: 'warning', text: 'Security scan initiated' },
            { icon: 'sync', type: 'primary', text: 'Background tasks updated' },
            { icon: 'bell', type: 'info', text: 'New notification received' }
        ];
        
        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        const now = new Date();
        
        return {
            icon: randomActivity.icon,
            type: randomActivity.type,
            text: randomActivity.text,
            time: now.toLocaleTimeString()
        };
    }

    createActivityItem(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        item.innerHTML = `
            <div class="activity-icon ${activity.type}">
                <i class="fas fa-${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <p>${activity.text}</p>
                <span class="activity-time">${activity.time}</span>
            </div>
        `;
        
        // Add entrance animation
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, 50);
        
        return item;
    }

    // Quick Actions Handler
    initializeQuickActions() {
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (!card.getAttribute('href') || card.getAttribute('href') === '#') {
                    e.preventDefault();
                    this.handleQuickAction(card);
                }
            });
        });
    }

    handleQuickAction(card) {
        const actionText = card.querySelector('h5').textContent;
        
        // Add click feedback
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);
        
        this.showNotification(`Opening ${actionText}...`, 'info');
    }

    // Header Interactions
    initializeHeaderInteractions() {
        this.initializeUserMenu();
        this.initializeStatCounters();
    }

    initializeUserMenu() {
        const userAvatar = document.getElementById('openProfileModal');
        if (!userAvatar) return;

        userAvatar.addEventListener('click', (e) => {
            e.preventDefault();
            // Additional user menu logic can be added here
        });
    }

    initializeStatCounters() {
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            if (stat.textContent.match(/^\d+$/)) {
                this.animateCounter(stat);
            }
        });
    }

    animateCounter(element) {
        const target = parseInt(element.textContent);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    }

    // Real-time Updates
    initializeRealTimeUpdates() {
        this.updateLiveTime();
        this.simulateLiveData();
    }

    updateLiveTime() {
        const updateTime = () => {
            const now = new Date();
            const timeElements = document.querySelectorAll('.activity-time:first-child');
            
            if (timeElements.length > 0) {
                timeElements[0].textContent = now.toLocaleTimeString();
            }
        };
        
        setInterval(updateTime, 1000);
    }

    simulateLiveData() {
        // Simulate live data updates every 30 seconds
        setInterval(() => {
            this.updateRandomStats();
        }, 30000);
    }

    updateRandomStats() {
        const stats = document.querySelectorAll('.stat-value');
        stats.forEach(stat => {
            if (stat.textContent.match(/^\d+$/)) {
                const current = parseInt(stat.textContent);
                const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
                const newValue = Math.max(0, current + change);
                
                if (newValue !== current) {
                    this.animateValueChange(stat, current, newValue);
                }
            }
        });
    }

    animateValueChange(element, oldValue, newValue) {
        element.style.color = newValue > oldValue ? '#10b981' : '#ef4444';
        element.textContent = newValue;
        
        setTimeout(() => {
            element.style.color = '';
        }, 1000);
    }

    // Performance Monitoring
    initializePerformanceMonitoring() {
        this.monitorPerformance();
        this.setupErrorHandling();
    }

    monitorPerformance() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            console.log(`Page loaded in ${loadTime}ms`);
        });
    }

    setupErrorHandling() {
        window.addEventListener('error', (e) => {
            console.error('Dashboard error:', e.error);
            this.showNotification('An error occurred. Please refresh the page.', 'error');
        });
    }

    // Notification System
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.dashboard-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = `dashboard-notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            border-left: 4px solid ${this.getNotificationColor(type)};
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            this.hideNotification(notification);
        }, 5000);
    }

    hideNotification(notification) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
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

    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || '#3b82f6';
    }

    // Utility Methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// CSS Animations
const style = document.createElement('style');
style.textContent = `
    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
    
    @keyframes modalSlideOut {
        from {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
        to {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
        }
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .dashboard-notification .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
    }
    
    .dashboard-notification .notification-close {
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: all 0.2s ease;
    }
    
    .dashboard-notification .notification-close:hover {
        background: #f1f5f9;
        color: #475569;
    }
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AttendifyDashboard();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttendifyDashboard;
}