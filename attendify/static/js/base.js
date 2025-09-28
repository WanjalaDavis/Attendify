// Base JavaScript for Cyber Theme
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();
    
    // Initialize loading spinner
    initLoading();
    
    // Initialize sidebar
    initSidebar();
    
    // Initialize notifications
    initNotifications();
    
    // Initialize matrix background
    initMatrixBackground();
    
    // Initialize glitch effects
    initGlitchEffects();
    
    // Initialize system status
    initSystemStatus();
});

// Theme Management
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'cyber';
    
    // Set initial theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);
    
    // Theme toggle event
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'cyber' ? 'light' : 'cyber';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        
        // Play theme change sound effect
        playSoundEffect('themeChange');
    });
    
    function updateThemeIcon(theme) {
        const icons = themeToggle.querySelectorAll('i');
        if (theme === 'cyber') {
            icons[0].style.opacity = '0';
            icons[1].style.opacity = '1';
        } else {
            icons[0].style.opacity = '1';
            icons[1].style.opacity = '0';
        }
    }
}

// Loading Spinner
function initLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    
    // Simulate loading process
    setTimeout(() => {
        loadingSpinner.classList.add('hidden');
        setTimeout(() => {
            loadingSpinner.style.display = 'none';
        }, 500);
    }, 1500);
    
    // Show loading spinner on page transitions
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.href && !e.target.href.includes('#')) {
            const href = e.target.getAttribute('href');
            if (!href.startsWith('javascript:') && !href.startsWith('#')) {
                loadingSpinner.style.display = 'flex';
                loadingSpinner.classList.remove('hidden');
            }
        }
    });
}

// Sidebar Management
function initSidebar() {
    const sidebar = document.getElementById('cyberSidebar');
    const sidebarToggle = document.getElementById('cyberSidebarToggle');
    const menuToggle = document.getElementById('cyberMenuToggle');
    
    // Toggle sidebar collapse
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        playSoundEffect('interface');
    });
    
    // Mobile menu toggle
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        playSoundEffect('interface');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });
    
    // Add active class to current page link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.cyber-nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

// Notification System
function initNotifications() {
    window.showNotification = function(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `cyber-notification cyber-notification-${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-triangle' : 
                    type === 'warning' ? 'exclamation-circle' : 'info-circle';
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="notification-message">${message}</div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
        
        // Play notification sound
        playSoundEffect('notification');
    };
}

// Matrix Background Effect
function initMatrixBackground() {
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    const container = document.querySelector('.matrix-bg');
    
    function createMatrixChar() {
        const element = document.createElement('div');
        element.style.position = 'absolute';
        element.style.top = '-20px';
        element.style.left = Math.random() * 100 + 'vw';
        element.style.color = `rgba(0, 255, 136, ${Math.random() * 0.3})`;
        element.style.fontSize = (Math.random() * 10 + 10) + 'px';
        element.style.fontFamily = 'Courier New, monospace';
        element.textContent = chars.charAt(Math.floor(Math.random() * chars.length));
        element.style.animation = `matrixFall ${Math.random() * 3 + 2}s linear forwards`;
        
        container.appendChild(element);
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 5000);
    }
    
    // Add matrix fall animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes matrixFall {
            to {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Create matrix characters
    setInterval(createMatrixChar, 100);
}

// Glitch Effects
function initGlitchEffects() {
    const glitchElements = document.querySelectorAll('.glitch');
    
    // Random glitch effect
    setInterval(() => {
        glitchElements.forEach(el => {
            if (Math.random() > 0.7) {
                el.classList.add('glitch-active');
                setTimeout(() => {
                    el.classList.remove('glitch-active');
                }, 200);
            }
        });
    }, 5000);
}

// System Status
function initSystemStatus() {
    // Simulate system status updates
    setInterval(() => {
        const statusIndicator = document.querySelector('.status-indicator i');
        if (statusIndicator) {
            statusIndicator.style.animation = 'pulse 2s infinite';
        }
    }, 2000);
    
    // Update uptime counter
    function updateUptime() {
        const uptimeElement = document.querySelector('.status-uptime');
        if (uptimeElement) {
            // Simulate uptime calculation
            const hours = Math.floor((Date.now() - performance.timing.navigationStart) / 3600000);
            uptimeElement.textContent = `${99.9 - (hours * 0.01)}% UPTIME`;
        }
    }
    
    updateUptime();
    setInterval(updateUptime, 60000);
}

// Sound Effects
function playSoundEffect(type) {
    // This would integrate with Web Audio API for actual sounds
    console.log(`Playing ${type} sound effect`);
    
    // For demo purposes, we'll just log the sound event
    const sounds = {
        'themeChange': '🔊 Theme changed',
        'interface': '🔊 Interface interaction',
        'notification': '🔊 New notification'
    };
    
    if (sounds[type]) {
        console.log(sounds[type]);
    }
}

// Utility Functions
window.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

window.throttle = function(func, limit) {
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
};

// AJAX CSRF Token Setup
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", CSRF_TOKEN);
        }
    }
});

// Error Handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('System error occurred. Please refresh the page.', 'error');
});

// Performance Monitoring
if ('performance' in window) {
    window.addEventListener('load', function() {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
        
        if (loadTime > 3000) {
            showNotification('System performance may be degraded', 'warning');
        }
    });
}