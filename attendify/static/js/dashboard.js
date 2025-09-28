// Enhanced Cyber Dashboard Interactions
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all enhanced effects
    initMatrixBackground();
    initTypewriterEffect();
    initHologramCards();
    initDataFeed();
    initInteractiveElements();
    initScrollAnimations();
    initParticleEffects();
});

// Enhanced Matrix Background with Interactive Particles
function initMatrixBackground() {
    const matrixBg = document.querySelector('.matrix-bg');
    
    // Create interactive particles
    for (let i = 0; i < 50; i++) {
        createFloatingParticle(matrixBg);
    }
    
    // Create matrix code rain effect
    createMatrixRain(matrixBg);
}

function createFloatingParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'floating-particle';
    
    // Random properties
    const size = Math.random() * 4 + 1;
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;
    const color = getRandomNeonColor();
    
    particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        left: ${posX}%;
        top: ${posY}%;
        box-shadow: 0 0 ${size * 2}px ${color};
        animation: floatParticle ${duration}s ease-in-out ${delay}s infinite;
        opacity: ${Math.random() * 0.5 + 0.2};
    `;
    
    container.appendChild(particle);
}

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

function getRandomNeonColor() {
    const colors = [
        'rgba(0, 255, 136, 0.8)',
        'rgba(0, 162, 255, 0.8)',
        'rgba(179, 0, 255, 0.8)',
        'rgba(255, 0, 200, 0.8)'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Enhanced Typewriter Effect
function initTypewriterEffect() {
    const typewriter = document.querySelector('.typewriter');
    const username = typewriter.querySelector('.username');
    const cursor = typewriter.querySelector('.cursor');
    
    const text = username.textContent;
    username.textContent = '';
    
    let i = 0;
    const typeSpeed = 100;
    const pauseTime = 2000;
    
    function type() {
        if (i < text.length) {
            username.textContent += text.charAt(i);
            i++;
            setTimeout(type, typeSpeed);
        } else {
            // Start blinking cursor after typing is complete
            cursor.style.animation = 'blink 1s infinite';
        }
    }
    
    // Start typing after a brief delay
    setTimeout(type, 500);
}

// Enhanced Hologram Card Interactions
function initHologramCards() {
    const cards = document.querySelectorAll('.cyber-card');
    
    cards.forEach(card => {
        // Add tilt effect on mouse move
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const angleY = (x - centerX) / 25;
            const angleX = (centerY - y) / 25;
            
            card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateZ(10px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        });
        
        // Add click effect
        card.addEventListener('click', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0) scale(0.95)';
            setTimeout(() => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0) scale(1)';
            }, 150);
        });
    });
}

// Enhanced Live Data Feed
function initDataFeed() {
    const dataFeed = document.querySelector('.data-feed');
    
    // Initial messages
    const initialMessages = [
        "System: User authentication verified - security protocols active",
        "Network: Connection established with main database server",
        "Scanner: QR recognition system calibrated and ready",
        "Analytics: Real-time data processing initialized",
        "Security: Encryption algorithms active - AES-256 enabled",
        "Backup: Cloud synchronization in progress...",
        "Update: System performance optimized for peak efficiency"
    ];
    
    // Add initial messages
    initialMessages.forEach((message, index) => {
        setTimeout(() => {
            addDataFeedMessage(message);
        }, index * 1000);
    });
    
    // Continue adding random messages
    setInterval(() => {
        const randomMessages = [
            "System: All modules operating within normal parameters",
            "Network: Data transfer rate stable at 1.2 Gb/s",
            "Security: No threats detected - firewall active",
            "Analytics: Processing attendance patterns...",
            "Database: Backup completed successfully",
            "Performance: System resources at 45% capacity"
        ];
        
        const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
        addDataFeedMessage(randomMessage);
    }, 8000);
}

function addDataFeedMessage(message) {
    const dataFeed = document.querySelector('.data-feed');
    const timestamp = new Date().toLocaleTimeString();
    
    const feedItem = document.createElement('div');
    feedItem.className = 'feed-item';
    feedItem.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message">${message}</span>
    `;
    
    dataFeed.appendChild(feedItem);
    
    // Scroll to bottom
    dataFeed.scrollTop = dataFeed.scrollHeight;
    
    // Remove old messages if too many
    if (dataFeed.children.length > 10) {
        dataFeed.removeChild(dataFeed.firstChild);
    }
}

// Enhanced Interactive Elements
function initInteractiveElements() {
    // Cyber button effects
    const cyberButtons = document.querySelectorAll('.cyber-button');
    
    cyberButtons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            const glitch = button.querySelector('.cyber-glitch');
            glitch.style.left = '100%';
            
            // Add sound effect (commented out as we can't play audio without user interaction)
            // playGlitchSound();
        });
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Create ripple effect
            const ripple = document.createElement('div');
            ripple.className = 'button-ripple';
            ripple.style.cssText = `
                position: absolute;
                width: 100px;
                height: 100px;
                background: rgba(0, 255, 136, 0.3);
                border-radius: 50%;
                transform: translate(-50%, -50%) scale(0);
                animation: ripple 0.6s ease-out;
            `;
            
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            button.style.position = 'relative';
            button.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
            
            // Navigate after animation
            setTimeout(() => {
                window.location.href = button.href;
            }, 300);
        });
    });
    
    // Action button effects
    const actionButtons = document.querySelectorAll('.action-button');
    
    actionButtons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            const icon = button.querySelector('.button-icon');
            icon.style.transform = 'scale(1.2) rotate(10deg)';
        });
        
        button.addEventListener('mouseleave', () => {
            const icon = button.querySelector('.button-icon');
            icon.style.transform = 'scale(1) rotate(0deg)';
        });
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Create burst effect
            createButtonBurst(button);
            
            // Navigate after animation
            setTimeout(() => {
                window.location.href = button.href;
            }, 500);
        });
    });
}

function createButtonBurst(button) {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'burst-particle';
        
        const angle = (i / 12) * Math.PI * 2;
        const distance = 50;
        const size = Math.random() * 4 + 2;
        const color = getRandomNeonColor();
        
        particle.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY}px;
            box-shadow: 0 0 ${size * 2}px ${color};
            animation: burst 0.8s ease-out forwards;
            z-index: 1000;
        `;
        
        // Set animation
        particle.style.setProperty('--endX', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--endY', `${Math.sin(angle) * distance}px`);
        
        document.body.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            particle.remove();
        }, 800);
    }
}

// Enhanced Scroll Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements to animate
    const elementsToAnimate = document.querySelectorAll('.cyber-card, .terminal-container, .feed-container, .panel-container');
    elementsToAnimate.forEach(el => {
        observer.observe(el);
    });
}

// Enhanced Particle Effects for Special Interactions
function initParticleEffects() {
    // Add particle effect to logo
    const logo = document.querySelector('.hologram-logo');
    
    logo.addEventListener('mouseenter', () => {
        createLogoParticles(logo);
    });
    
    // Add particle effect to user orb
    const userOrb = document.querySelector('.user-orb');
    
    userOrb.addEventListener('mouseenter', () => {
        createOrbParticles(userOrb);
    });
}

function createLogoParticles(logo) {
    const rect = logo.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'logo-particle';
        
        const angle = (i / 8) * Math.PI * 2;
        const distance = 30;
        const size = Math.random() * 3 + 1;
        const color = getRandomNeonColor();
        
        particle.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY}px;
            box-shadow: 0 0 ${size * 2}px ${color};
            animation: logoPulse 1.5s ease-out forwards;
            z-index: 1000;
        `;
        
        // Set animation
        particle.style.setProperty('--endX', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--endY', `${Math.sin(angle) * distance}px`);
        
        document.body.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            particle.remove();
        }, 1500);
    }
}

function createOrbParticles(orb) {
    const rect = orb.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'orb-particle';
        
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 40 + 10;
        const size = Math.random() * 2 + 1;
        const color = getRandomNeonColor();
        const delay = Math.random() * 0.5;
        
        particle.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: ${centerX}px;
            top: ${centerY}px;
            box-shadow: 0 0 ${size * 2}px ${color};
            animation: orbFloat 2s ease-out ${delay}s forwards;
            z-index: 1000;
        `;
        
        // Set animation
        particle.style.setProperty('--endX', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--endY', `${Math.sin(angle) * distance}px`);
        
        document.body.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            particle.remove();
        }, 2000 + delay * 1000);
    }
}

// Add CSS animations for new effects
const style = document.createElement('style');
style.textContent = `
    @keyframes floatParticle {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        25% { transform: translate(10px, -10px) rotate(90deg); }
        50% { transform: translate(0, -20px) rotate(180deg); }
        75% { transform: translate(-10px, -10px) rotate(270deg); }
    }
    
    @keyframes fallDown {
        0% { transform: translateY(-20px); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(100vh); opacity: 0; }
    }
    
    @keyframes ripple {
        to { transform: translate(-50%, -50%) scale(4); opacity: 0; }
    }
    
    @keyframes burst {
        to { 
            transform: translate(var(--endX), var(--endY)) scale(0); 
            opacity: 0;
        }
    }
    
    @keyframes logoPulse {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { 
            transform: translate(var(--endX), var(--endY)) scale(0); 
            opacity: 0;
        }
    }
    
    @keyframes orbFloat {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { 
            transform: translate(var(--endX), var(--endY)) scale(0); 
            opacity: 0;
        }
    }
    
    .animate-in {
        animation: slideUp 0.8s ease-out forwards;
    }
    
    @keyframes slideUp {
        from { 
            opacity: 0; 
            transform: translateY(30px); 
        }
        to { 
            opacity: 1; 
            transform: translateY(0); 
        }
    }
    
    .matrix-column {
        position: absolute;
        top: 0;
        height: 100%;
        width: 1px;
    }
    
    .floating-particle, .burst-particle, .logo-particle, .orb-particle {
        pointer-events: none;
    }
`;

document.head.appendChild(style);

// System performance monitoring (optional)
function monitorPerformance() {
    // Log performance metrics (could be sent to analytics)
    if ('performance' in window) {
        setTimeout(() => {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            console.log(`Page load time: ${loadTime}ms`);
        }, 1000);
    }
}


// Initialize performance monitoring
monitorPerformance();