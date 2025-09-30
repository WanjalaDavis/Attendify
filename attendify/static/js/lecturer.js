// Matrix Background Animation
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

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Matrix Background
    const matrix = new MatrixBackground('matrixCanvas');
    
    // Initialize Chart.js
    initializeAttendanceChart();
    
    // Add interactive effects
    initializeInteractiveEffects();
    
    // Initialize modals
    initializeModals();
    
    // Show loading spinner briefly
    showLoadingSpinner();
    
    // Initialize clock
    updateClock();
    setInterval(updateClock, 1000);
});

// Initialize Attendance Chart
function initializeAttendanceChart() {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;
    
    const canvas = ctx.getContext('2d');
    
    // Chart data
    const data = {
        labels: ['Present', 'Late', 'Absent'],
        datasets: [{
            data: [75, 15, 10],
            backgroundColor: [
                'rgba(0, 255, 136, 0.8)',
                'rgba(0, 136, 255, 0.8)',
                'rgba(255, 0, 136, 0.8)'
            ],
            borderColor: [
                'rgba(0, 255, 136, 1)',
                'rgba(0, 136, 255, 1)',
                'rgba(255, 0, 136, 1)'
            ],
            borderWidth: 2,
            borderAlign: 'inner',
            hoverOffset: 15
        }]
    };
    
    // Chart configuration
    const config = {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}%`;
                        }
                    }
                }
            },
            cutout: '70%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    };
    
    // Create chart
    new Chart(canvas, config);
}

// Initialize Interactive Effects
function initializeInteractiveEffects() {
    // Add hover effects to cyber cards
    const cyberCards = document.querySelectorAll('.cyber-card');
    cyberCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Add click effects to buttons
    const cyberButtons = document.querySelectorAll('.cyber-btn');
    cyberButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple-effect');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Initialize notification button
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            // Toggle notification panel (to be implemented)
            console.log('Notification button clicked');
            showNotification('No new notifications');
        });
    }
    
    // Initialize dropdown menus
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const button = dropdown.querySelector('.btn-profile-dropdown');
        const menu = dropdown.querySelector('.cyber-dropdown');
        
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            dropdown.classList.remove('show');
        });
    });
}

// Modal functionality
function initializeModals() {
    // Profile modal trigger
    const profileModalTrigger = document.querySelector('[data-bs-target="#profileModal"]');
    const profileModal = document.getElementById('profileModal');
    
    if (profileModalTrigger && profileModal) {
        profileModalTrigger.addEventListener('click', function(e) {
            e.preventDefault();
            openModal(profileModal);
        });
    }
    
    // Close modal when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });
    
    // Close modal with escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                closeModal(openModal);
            }
        }
    });
    
    // Form submission handling
    const profileForm = document.querySelector('#profileModal form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFormSubmission(this);
        });
    }
}

function openModal(modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

function handleFormSubmission(form) {
    // Add loading state
    form.classList.add('form-loading');
    
    // Simulate form submission
    setTimeout(() => {
        form.classList.remove('form-loading');
        
        // Show success message
        showFormSuccess('Profile updated successfully!');
        
        // Close modal after success
        const modal = form.closest('.modal');
        if (modal) {
            setTimeout(() => {
                closeModal(modal);
            }, 1500);
        }
    }, 2000);
}

function showFormSuccess(message) {
    const successEl = document.createElement('div');
    successEl.className = 'form-success';
    successEl.textContent = message;
    document.body.appendChild(successEl);
    
    setTimeout(() => {
        successEl.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        successEl.classList.remove('show');
        setTimeout(() => {
            successEl.remove();
        }, 300);
    }, 3000);
}

// Show Loading Spinner
function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = 'flex';
        setTimeout(() => {
            spinner.style.display = 'none';
        }, 1500);
    }
}

// Generate QR Code
function generateQRCode(classId) {
    showLoadingSpinner();
    
    // Simulate API call to generate QR code
    setTimeout(() => {
        alert(`QR Code generated for class ID: ${classId}`);
        // In a real implementation, this would open a modal with the QR code
    }, 1000);
}

// Tutorial Modal Functions
let currentTutorialStep = 0;

function showTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (modal) {
        openModal(modal);
        currentTutorialStep = 0;
        updateTutorialSteps();
    }
}

function closeTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (modal) {
        closeModal(modal);
    }
}

function nextTutorialStep() {
    const steps = document.querySelectorAll('.tutorial-step');
    if (currentTutorialStep < steps.length - 1) {
        currentTutorialStep++;
        updateTutorialSteps();
    } else {
        closeTutorial();
    }
}

function prevTutorialStep() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        updateTutorialSteps();
    }
}

function updateTutorialSteps() {
    const steps = document.querySelectorAll('.tutorial-step');
    steps.forEach((step, index) => {
        if (index === currentTutorialStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
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
    
    // Find or create clock element
    let clockElement = document.querySelector('.header-clock');
    if (!clockElement) {
        clockElement = document.createElement('div');
        clockElement.className = 'header-clock';
        document.querySelector('.header-actions').prepend(clockElement);
    }
    
    clockElement.innerHTML = `
        <div class="clock-time">${timeString}</div>
        <div class="clock-date">${dateString}</div>
    `;
}

// Notification system
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'form-success';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS for ripple effect dynamically
const style = document.createElement('style');
style.textContent = `
    .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(0, 255, 136, 0.6);
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
    
    .form-loading {
        position: relative;
        pointer-events: none;
        opacity: 0.7;
    }
    
    .form-loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        margin: -10px 0 0 -10px;
        border: 2px solid transparent;
        border-top: 2px solid var(--primary-color);
        border-radius: 50%;
        animation: formSpin 1s linear infinite;
    }
    
    @keyframes formSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);