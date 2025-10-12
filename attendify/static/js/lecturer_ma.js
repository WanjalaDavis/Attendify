class LecturerPortal {
    constructor() {
        this.currentTab = 'classes';
        this.selectedClass = null;
        this.activeQRCode = null;
        this.csrfToken = this.getCSRFToken();
        this.currentLocation = null;
        this.locationDetector = null;
        this.lecturerData = null;
        this.classTimers = new Map();
        
        this.init();
    }

    init() {
        this.verifyLibraries();
        this.bindEvents();
        this.initDynamicGreeting();
        this.initClassTimeTracking();
        this.initLocationDetection();
        this.initFormValidation();
        this.startAutoRefresh();
        
        console.log('Lecturer Portal initialized successfully');
    }

    // ==================== LIBRARY VERIFICATION ====================
    verifyLibraries() {
        console.log('Verifying required libraries...');
        
        const libraries = {
            'QRCode': typeof QRCode,
            'bootstrap': typeof bootstrap,
            'Chart': typeof Chart
        };
        
        console.log('Library status:', libraries);
        
        // Check QRCode library specifically
        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not loaded - using fallback method');
            this.showPersistentLibraryWarning();
            this.initializeFallbackQRGenerator();
        } else {
            console.log('QRCode library loaded successfully');
            this.removeLibraryWarnings();
        }
    }

    initializeFallbackQRGenerator() {
        // Create a simple fallback QR generator
        window.fallbackQRGenerator = {
            generate: function(text, canvas, size = 200) {
                try {
                    // Simple fallback: create a placeholder with text
                    const ctx = canvas.getContext('2d');
                    canvas.width = size;
                    canvas.height = size;
                    
                    // Clear canvas
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, size, size);
                    
                    // Draw border
                    ctx.strokeStyle = '#4f46e5';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(10, 10, size - 20, size - 20);
                    
                    // Draw text
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('QR CODE', size / 2, size / 2 - 10);
                    
                    ctx.font = '12px Arial';
                    ctx.fillText('Library Not Loaded', size / 2, size / 2 + 10);
                    
                    return true;
                } catch (error) {
                    console.error('Fallback QR generation failed:', error);
                    return false;
                }
            }
        };
        
        console.log('Fallback QR generator initialized');
    }

    showPersistentLibraryWarning() {
        this.removeLibraryWarnings();
        
        const warning = document.createElement('div');
        warning.id = 'qr-library-warning';
        warning.className = 'alert alert-warning alert-dismissible fade show m-3';
        warning.style.cssText = 'position: fixed; top: 100px; right: 20px; z-index: 9999; max-width: 400px;';
        warning.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-exclamation-triangle fa-2x me-3"></i>
                <div>
                    <strong class="d-block">QR Code Warning</strong>
                    <span class="d-block">Using limited QR functionality.</span>
                    <small class="d-block mt-1">Check internet connection for full features.</small>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(warning);
    }

    removeLibraryWarnings() {
        const existingWarning = document.getElementById('qr-library-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
    }

    // ==================== CORE UTILITIES ====================
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }

    async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken,
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        };

        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showNotification(`API Error: ${error.message}`, 'error');
            throw error;
        }
    }

    showLoading(show = true, message = 'Processing your request...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const messageEl = overlay.querySelector('p');
            if (messageEl) messageEl.textContent = message;
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notifications-container');
        if (!container) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        container.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }

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

        // Class scheduling form
        const scheduleForm = document.getElementById('schedule-class-form');
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', (e) => this.handleClassSchedule(e));
        }
        
        // QR code generation - Event delegation
        document.addEventListener('click', (e) => {
            const qrBtn = e.target.closest('.generate-qr-btn');
            if (qrBtn) {
                const classId = qrBtn.dataset.classId;
                console.log('QR Generation clicked for class:', classId);
                this.generateQRCode(classId);
            }
        });

        // Class deletion - Event delegation
        document.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-class-btn');
            if (deleteBtn) {
                const classId = deleteBtn.dataset.classId;
                this.showDeleteConfirmation(classId);
            }
        });

        // Confirm delete button
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteClass());
        }

        // Report generation
        const reportForm = document.getElementById('report-generation-form');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => this.handleReportGeneration(e));
        }

        const previewReportBtn = document.getElementById('preview-report-btn');
        if (previewReportBtn) {
            previewReportBtn.addEventListener('click', () => this.previewReport());
        }

        // Refresh buttons
        const refreshButtons = [
            { id: 'refresh-reports-btn', method: 'refreshPage' }
        ];

        refreshButtons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                element.addEventListener('click', () => this[btn.method]());
            }
        });

        // Unit details
        document.addEventListener('click', (e) => {
            const unitBtn = e.target.closest('.view-unit-details');
            if (unitBtn) {
                const unitId = unitBtn.dataset.unitId;
                this.loadUnitAnalytics(unitId);
            }
        });

        // QR modal actions
        const qrActions = [
            { id: 'download-modal-qr', method: 'downloadQRCode' }
        ];

        qrActions.forEach(action => {
            const element = document.getElementById(action.id);
            if (element) {
                element.addEventListener('click', () => this[action.method]());
            }
        });

        // Form reset
        const resetBtn = document.getElementById('reset-form-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetScheduleForm());
        }

        // Global error handling
        window.addEventListener('error', (e) => this.handleGlobalError(e));
        window.addEventListener('unhandledrejection', (e) => this.handlePromiseRejection(e));
    }

    // ==================== TAB MANAGEMENT ====================
    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        switch(tabName) {
            case 'classes':
                this.initClassTimeTracking();
                break;
            case 'reports':
                this.initReportForm();
                break;
        }
        
        this.showNotification(`Switched to ${tabName} tab`, 'info', 2000);
    }

    // ==================== CLASS STATUS AND TIME TRACKING ====================
    initClassTimeTracking() {
        this.classTimers.forEach((timer, classId) => {
            clearInterval(timer);
        });
        this.classTimers.clear();

        this.trackAllClassTimes();
        
        setInterval(() => {
            this.trackAllClassTimes();
        }, 1000);
    }

    trackAllClassTimes() {
        document.querySelectorAll('.class-card').forEach(card => {
            const classId = card.dataset.classId;
            const scheduleDate = card.dataset.scheduleDate;
            const startTime = card.dataset.startTime;
            const endTime = card.dataset.endTime;

            if (scheduleDate && startTime) {
                this.updateClassStatus(classId, scheduleDate, startTime, endTime);
            }
        });

        document.querySelectorAll('.compact-item.class-card').forEach(card => {
            const classId = card.dataset.classId;
            const scheduleDate = card.dataset.scheduleDate;
            const startTime = card.dataset.startTime;
            const endTime = card.dataset.endTime;

            if (scheduleDate && startTime) {
                this.updateClassStatus(classId, scheduleDate, startTime, endTime);
            }
        });
    }

    getClassStatus(scheduleDate, startTime, endTime) {
        const now = new Date();
        const classStart = new Date(`${scheduleDate}T${startTime}`);
        const classEnd = endTime ? new Date(`${scheduleDate}T${endTime}`) : null;

        if (now < classStart) {
            return 'UPCOMING';
        } else if (classEnd && now > classEnd) {
            return 'ENDED';
        } else {
            return 'ONGOING';
        }
    }

    canGenerateQR(classStatus) {
        return classStatus === 'ONGOING';
    }

    updateClassStatus(classId, scheduleDate, startTime, endTime) {
        const now = new Date();
        const classStart = new Date(`${scheduleDate}T${startTime}`);
        const classEnd = endTime ? new Date(`${scheduleDate}T${endTime}`) : null;

        const classStatus = this.getClassStatus(scheduleDate, startTime, endTime);
        const classCard = document.querySelector(`[data-class-id="${classId}"]`);
        if (!classCard) return;

        // Update status display
        const statusElement = classCard.querySelector('.class-status-indicator');
        if (statusElement) {
            statusElement.className = `class-status-indicator status-${classStatus.toLowerCase()}`;
            
            const statusText = statusElement.nextElementSibling;
            if (statusText && statusText.style) {
                statusText.textContent = classStatus;
                statusText.style.textTransform = 'uppercase';
                statusText.style.color = classStatus === 'ONGOING' ? '#10b981' : 
                                       classStatus === 'UPCOMING' ? '#f59e0b' : '#6b7280';
            }
        }

        // Update time display
        const timeDisplay = classCard.querySelector('.class-time-display');
        if (timeDisplay) {
            if (classStatus === 'UPCOMING') {
                const timeDiff = classStart - now;
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                const timeRemainingElement = document.getElementById(`time-remaining-${classId}`);
                if (timeRemainingElement) {
                    timeRemainingElement.textContent = `${hours}h ${minutes}m`;
                }
                
            } else if (classStatus === 'ONGOING' && classEnd) {
                const elapsed = now - classStart;
                const remaining = classEnd - now;
                const elapsedMinutes = Math.floor(elapsed / (1000 * 60));
                const remainingMinutes = Math.floor(remaining / (1000 * 60));
                
                const timeElapsedElement = document.getElementById(`time-elapsed-${classId}`);
                if (timeElapsedElement) {
                    timeElapsedElement.textContent = `${elapsedMinutes}m (${remainingMinutes}m left)`;
                }
                
            } else if (classStatus === 'ENDED') {
                const timeDisplayElement = classCard.querySelector('.class-time-display span');
                if (timeDisplayElement) {
                    timeDisplayElement.textContent = 'Class Ended';
                }
            }
        }

        // Update QR button state
        this.updateQRButtonState(classId, classStatus);

        // Update card border color
        classCard.style.borderLeft = `4px solid ${
            classStatus === 'ONGOING' ? '#10b981' :
            classStatus === 'UPCOMING' ? '#f59e0b' : '#6b7280'
        }`;
    }

    updateQRButtonState(classId, status) {
        const qrButton = document.querySelector(`.generate-qr-btn[data-class-id="${classId}"]`);
        if (!qrButton) return;

        qrButton.dataset.status = status;

        switch(status) {
            case 'ONGOING':
                qrButton.innerHTML = '<i class="fas fa-qrcode"></i> Generate QR';
                qrButton.disabled = false;
                qrButton.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
                qrButton.style.borderColor = '#4f46e5';
                qrButton.style.color = 'white';
                qrButton.style.cursor = 'pointer';
                break;
            case 'UPCOMING':
                qrButton.innerHTML = '<i class="fas fa-clock"></i> Not Started';
                qrButton.disabled = true;
                qrButton.style.background = 'rgba(245, 158, 11, 0.1)';
                qrButton.style.borderColor = '#f59e0b';
                qrButton.style.color = '#f59e0b';
                qrButton.style.cursor = 'not-allowed';
                break;
            case 'ENDED':
                qrButton.innerHTML = '<i class="fas fa-ban"></i> Class Ended';
                qrButton.disabled = true;
                qrButton.style.background = 'rgba(107, 114, 128, 0.1)';
                qrButton.style.borderColor = '#6b7280';
                qrButton.style.color = '#6b7280';
                qrButton.style.cursor = 'not-allowed';
                break;
        }
    }

    // ==================== QR CODE MANAGEMENT ====================
    async generateQRCode(classId) {
        console.log('Starting QR generation for class:', classId);
        
        if (!classId) {
            this.showNotification('No class selected', 'error');
            return;
        }

        // Check if class is ongoing
        const classCard = document.querySelector(`[data-class-id="${classId}"]`);
        if (!classCard) {
            this.showNotification('Class not found', 'error');
            return;
        }

        const scheduleDate = classCard.dataset.scheduleDate;
        const startTime = classCard.dataset.startTime;
        const endTime = classCard.dataset.endTime;

        const classStatus = this.getClassStatus(scheduleDate, startTime, endTime);
        if (!this.canGenerateQR(classStatus)) {
            this.showNotification(`Cannot generate QR code: Class is ${classStatus.toLowerCase()}`, 'warning');
            return;
        }

        this.showLoading(true, 'Generating QR code...');

        try {
            const response = await fetch(`/lecturer/generate-qr/${classId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            console.log('QR generation response:', data);
            
            if (data.success) {
                this.activeQRCode = {
                    classId: classId,
                    token: data.token,
                    expiresAt: new Date(data.expires_at),
                    qrData: JSON.stringify({
                        token: data.token,
                        class_id: classId,
                        expires_at: data.expires_at
                    })
                };
                
                const classInfo = this.getClassInfo(classId);
                console.log('Class info for QR:', classInfo);
                this.showQRModal(this.activeQRCode.qrData, classInfo);
                this.showNotification('QR code generated successfully!', 'success');
                this.startQRExpiryCountdown(new Date(data.expires_at));
                
            } else {
                throw new Error(data.message || 'Failed to generate QR code');
            }

        } catch (error) {
            console.error('QR generation error:', error);
            this.showNotification('Error generating QR code: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showQRModal(qrData, classInfo) {
        const modalElement = document.getElementById('qrCodeModal');
        if (!modalElement) {
            console.error('QR modal element not found');
            return;
        }

        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        const modalQrCode = document.getElementById('modal-qr-code');
        const qrClassInfo = document.getElementById('qr-class-info');
        const qrExpiryInfo = document.getElementById('qr-expiry-info');
        const downloadBtn = document.getElementById('download-modal-qr');
        
        if (!modalQrCode || !qrClassInfo) {
            console.error('QR modal content elements not found');
            return;
        }

        // Set class info - FIXED: Use proper class info
        qrClassInfo.textContent = `${classInfo.unitCode} - ${classInfo.unitName}`;
        if (qrExpiryInfo) {
            qrExpiryInfo.textContent = `Venue: ${classInfo.venue} | Time: ${classInfo.startTime} - ${classInfo.endTime}`;
        }

        // Clear and prepare QR code container
        modalQrCode.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Generating QR code...</p></div>';
        
        // Enable download button
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }
        
        // Show modal first
        modal.show();

        // Generate QR code after a short delay to ensure modal is visible
        setTimeout(() => {
            this.generateQRImage(qrData, modalQrCode);
        }, 100);
    }

    generateQRImage(qrData, container) {
        try {
            // Clear container
            container.innerHTML = '';
            
            // Create canvas element
            const canvas = document.createElement('canvas');
            canvas.width = 250;
            canvas.height = 250;
            canvas.style.border = '2px solid #dee2e6';
            canvas.style.borderRadius = '8px';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            
            container.appendChild(canvas);

            // Check if we have QRCode library or use fallback
            if (typeof QRCode !== 'undefined') {
                // Use real QR code library
                QRCode.toCanvas(canvas, qrData, {
                    width: 250,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                }, (error) => {
                    if (error) {
                        console.error('QR code generation failed:', error);
                        this.useFallbackQR(canvas, qrData);
                        return;
                    }
                    
                    console.log('QR code generated successfully with library');
                });
            } else {
                // Use fallback method
                this.useFallbackQR(canvas, qrData);
            }
            
        } catch (error) {
            console.error('QR code rendering error:', error);
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    QR display limited. Functionality preserved.
                </div>
            `;
        }
    }

    useFallbackQR(canvas, qrData) {
        console.log('Using fallback QR generator');
        
        if (window.fallbackQRGenerator && window.fallbackQRGenerator.generate) {
            window.fallbackQRGenerator.generate(qrData, canvas, 250);
        } else {
            // Basic fallback
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 250, 250);
            
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.strokeRect(10, 10, 230, 230);
            
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('ATTENDANCE QR', 125, 120);
            
            ctx.font = '12px Arial';
            ctx.fillText('Scan with Attendify App', 125, 140);
        }
    }

    downloadQRCode() {
        console.log('Download QR code clicked');
        
        if (!this.activeQRCode) {
            this.showNotification('No active QR code to download', 'warning');
            return;
        }

        try {
            const canvas = document.querySelector('#modal-qr-code canvas');
            
            if (!canvas) {
                this.showNotification('QR code not available for download. Please generate it again.', 'error');
                return;
            }

            const classInfo = this.getClassInfo(this.activeQRCode.classId);
            const filename = `qr-${classInfo.unitCode}-${new Date().toISOString().slice(0, 10)}.png`;

            // Create download link
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showNotification('QR code downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Failed to download QR code: ' + error.message, 'error');
        }
    }

    startQRExpiryCountdown(expiresAt) {
        const expiryTime = expiresAt.getTime();
        
        const countdown = setInterval(() => {
            const now = new Date().getTime();
            const distance = expiryTime - now;
            
            if (distance <= 0) {
                clearInterval(countdown);
                this.showNotification('QR code has expired', 'warning');
                
                const modalExpiryInfo = document.getElementById('qr-expiry-info');
                if (modalExpiryInfo) {
                    const baseText = modalExpiryInfo.textContent.split('|')[0];
                    modalExpiryInfo.textContent = `${baseText} | EXPIRED`;
                    modalExpiryInfo.classList.add('text-danger');
                }
                return;
            }
            
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            const modalExpiryInfo = document.getElementById('qr-expiry-info');
            if (modalExpiryInfo) {
                const baseText = modalExpiryInfo.textContent.split('|')[0];
                modalExpiryInfo.textContent = `${baseText} | Expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                modalExpiryInfo.classList.remove('text-danger');
            }
            
        }, 1000);
    }

    getClassInfo(classId) {
        const classElement = document.querySelector(`[data-class-id="${classId}"]`);
        if (!classElement) {
            console.warn('Class element not found for ID:', classId);
            return this.getDefaultClassInfo();
        }

        try {
            // Improved class info extraction
            let unitName = 'Unknown Class';
            let unitCode = 'Unknown';
            let venue = 'Unknown Venue';
            let startTime = '00:00';
            let endTime = '00:00';
            let scheduleDate = 'Unknown Date';

            // Try to extract from h4 element
            const unitNameElement = classElement.querySelector('h4');
            if (unitNameElement) {
                unitName = unitNameElement.textContent.trim();
            }

            // Try to extract from class-meta element
            const classMetaElement = classElement.querySelector('.class-meta');
            if (classMetaElement) {
                const metaText = classMetaElement.textContent.trim();
                const parts = metaText.split('|');
                if (parts.length >= 1) unitCode = parts[0].trim();
                if (parts.length >= 2) venue = parts[1].trim();
            }

            // Try to extract time from time element
            const timeElement = classElement.querySelector('.time');
            if (timeElement) {
                const timeText = timeElement.textContent.trim();
                const times = timeText.split(' - ');
                if (times.length >= 1) startTime = times[0].trim();
                if (times.length >= 2) endTime = times[1].trim();
            }

            // Get schedule date from data attribute
            if (classElement.dataset.scheduleDate) {
                scheduleDate = classElement.dataset.scheduleDate;
            }

            console.log('Extracted class info:', { unitCode, unitName, venue, startTime, endTime, scheduleDate });
            
            return {
                unitCode,
                unitName,
                venue,
                startTime,
                endTime,
                scheduleDate
            };
        } catch (error) {
            console.error('Error extracting class info:', error);
            return this.getDefaultClassInfo();
        }
    }

    getDefaultClassInfo() {
        return {
            unitCode: 'Unknown',
            unitName: 'Unknown Class',
            venue: 'Unknown Venue',
            startTime: '00:00',
            endTime: '00:00',
            scheduleDate: 'Unknown Date'
        };
    }

    // ==================== CLASS DELETION ====================
    showDeleteConfirmation(classId) {
        const classInfo = this.getClassInfo(classId);
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteClassModal'));
        const classInfoElement = document.getElementById('class-to-delete-info');

        if (classInfoElement) {
            classInfoElement.innerHTML = `
                <div class="class-info-preview">
                    <strong>${classInfo.unitCode} - ${classInfo.unitName}</strong><br>
                    <small>Date: ${classInfo.scheduleDate}</small><br>
                    <small>Time: ${classInfo.startTime} - ${classInfo.endTime}</small><br>
                    <small>Venue: ${classInfo.venue}</small>
                </div>
            `;
        }

        document.getElementById('deleteClassModal').dataset.classToDelete = classId;
        modal.show();
    }

    async confirmDeleteClass() {
        const classId = document.getElementById('deleteClassModal').dataset.classToDelete;
        
        if (!classId) {
            this.showNotification('No class selected for deletion', 'error');
            return;
        }

        this.showLoading(true, 'Deleting class...');

        try {
            const response = await this.apiCall(`/api/lecturer/delete-class/${classId}/`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showNotification('Class deleted successfully!', 'success');
                this.removeClassFromUI(classId);
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteClassModal'));
                modal.hide();
                
            } else {
                throw new Error(response.message || 'Failed to delete class');
            }

        } catch (error) {
            console.error('Class deletion error:', error);
            this.showNotification('Error deleting class: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    removeClassFromUI(classId) {
        const todayClass = document.querySelector(`[data-class-id="${classId}"]`);
        if (todayClass) {
            todayClass.remove();
        }

        const upcomingClass = document.querySelector(`.compact-item[data-class-id="${classId}"]`);
        if (upcomingClass) {
            upcomingClass.remove();
        }

        this.updateClassCounts();
    }

    updateClassCounts() {
        const todayCount = document.querySelectorAll('#todays-classes-list .class-card').length;
        const upcomingCount = document.querySelectorAll('.compact-list .compact-item.class-card').length;
        
        const todayBadge = document.querySelector('.card-badge');
        if (todayBadge) {
            todayBadge.textContent = `${todayCount} scheduled`;
        }

        const upcomingBadge = document.querySelector('.content-card:nth-child(3) .card-badge');
        if (upcomingBadge) {
            upcomingBadge.textContent = `${upcomingCount} classes`;
        }
    }

    // ==================== CLASS SCHEDULING ====================
    initLocationDetection() {
        this.locationDetector = new LocationDetector();
    }

    async handleClassSchedule(event) {
        event.preventDefault();
        this.showLoading(true, 'Scheduling class...');

        try {
            const formData = new FormData(event.target);

            const requiredFields = ['semester_unit', 'schedule_date', 'start_time', 'end_time', 'venue'];
            for (const field of requiredFields) {
                if (!formData.get(field)) {
                    this.showNotification(`${field.replace('_', ' ')} is required`, 'error');
                    this.showLoading(false);
                    return;
                }
            }

            if (!this.validateClassTime(formData.get('start_time'), formData.get('end_time'))) {
                this.showNotification('End time must be after start time', 'error');
                this.showLoading(false);
                return;
            }

            if (!this.validateClassDate(formData.get('schedule_date'))) {
                this.showNotification('Class date cannot be in the past', 'error');
                this.showLoading(false);
                return;
            }

            const response = await fetch(event.target.action, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.csrfToken,
                },
                body: formData
            });

            if (response.ok) {
                this.showNotification('Class scheduled successfully!', 'success');
                this.resetScheduleForm();
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } else {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to schedule class');
            }

        } catch (error) {
            console.error('Class scheduling error:', error);
            this.showNotification('Error scheduling class. Please check the form and try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    validateClassTime(startTime, endTime) {
        if (!startTime || !endTime) return false;
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        return end > start;
    }

    validateClassDate(date) {
        if (!date) return false;
        const classDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return classDate >= today;
    }

    resetScheduleForm() {
        const form = document.getElementById('schedule-class-form');
        if (form) {
            form.reset();
            const radiusInput = document.getElementById('location_radius');
            if (radiusInput) radiusInput.value = 100;
        }
        if (this.locationDetector) {
            this.locationDetector.clearLocation();
        }
    }

    initFormValidation() {
        const form = document.getElementById('schedule-class-form');
        if (!form) return;

        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    validateField(field) {
        const value = field.value.trim();
        
        if (field.hasAttribute('required') && !value) {
            this.showFieldError(field, 'This field is required');
            return false;
        }

        this.clearFieldError(field);
        return true;
    }

    showFieldError(field, message) {
        field.classList.add('is-invalid');
        
        let errorElement = field.parentNode.querySelector('.invalid-feedback');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'invalid-feedback';
            field.parentNode.appendChild(errorElement);
        }
        errorElement.textContent = message;
    }

    clearFieldError(field) {
        field.classList.remove('is-invalid');
        const errorElement = field.parentNode.querySelector('.invalid-feedback');
        if (errorElement) {
            errorElement.remove();
        }
    }

    // ==================== REPORT GENERATION ====================
    initReportForm() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const startDateInput = document.getElementById('start_date');
        const endDateInput = document.getElementById('end_date');
        
        if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
    }

    async handleReportGeneration(event) {
        event.preventDefault();
        this.showLoading(true, 'Generating report...');

        try {
            const formData = new FormData(event.target);
            
            const response = await fetch(event.target.action, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.csrfToken,
                },
                body: formData
            });

            if (response.ok) {
                this.showNotification('Report generated successfully!', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to generate report');
            }

        } catch (error) {
            console.error('Report generation error:', error);
            this.showNotification('Error generating report. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async previewReport() {
        const form = document.getElementById('report-generation-form');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        if (!data.start_date || !data.end_date || !data.title) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }

        this.showLoading(true, 'Generating preview...');

        try {
            const response = await this.apiCall('/api/lecturer/reports-preview/', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.success) {
                this.showReportPreview(response.preview_data);
            } else {
                this.showNotification('Failed to generate preview', 'error');
            }

        } catch (error) {
            console.error('Preview generation error:', error);
            this.showNotification('Error generating preview', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showReportPreview(previewData) {
        const previewHtml = `
            <div class="preview-content">
                <h5>Report Preview</h5>
                <div class="preview-stats">
                    <div class="stat-item">
                        <span class="label">Total Classes:</span>
                        <span class="value">${previewData.total_classes}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Average Attendance:</span>
                        <span class="value">${previewData.average_attendance}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Total Students:</span>
                        <span class="value">${previewData.total_students}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Date Range:</span>
                        <span class="value">${previewData.date_range}</span>
                    </div>
                </div>
            </div>
        `;

        console.log('Report preview:', previewData);
        this.showNotification('Report preview generated successfully', 'info');
    }

    // ==================== UNIT MANAGEMENT ====================
    async loadUnitAnalytics(unitId) {
        if (!unitId) {
            this.showNotification('No unit selected', 'error');
            return;
        }

        this.showLoading(true, 'Loading unit analytics...');

        try {
            const response = await this.apiCall(`/api/lecturer/unit-analytics/${unitId}/`);
            this.displayUnitDetails(response.unit_data);
            
        } catch (error) {
            console.error('Error loading unit details:', error);
            this.showNotification('Failed to load unit analytics', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayUnitDetails(unitData) {
        const content = document.getElementById('unit-details-content');
        const card = document.getElementById('unit-details-card');
        
        if (!content || !card) return;

        const html = `
            <div class="unit-analytics-header">
                <h4>${unitData.code} - ${unitData.name}</h4>
                <div class="attendance-overview">
                    <div class="attendance-circle-large">
                        <div class="circle-progress" style="--percentage: ${unitData.attendance_percentage}">
                            <span>${unitData.attendance_percentage}%</span>
                        </div>
                    </div>
                    <div class="attendance-breakdown">
                        <div class="breakdown-item">
                            <span class="label">Total Students</span>
                            <span class="value">${unitData.enrolled_students || 0}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="label">Present</span>
                            <span class="value text-success">${unitData.present_count || 0}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="label">Late</span>
                            <span class="value text-warning">${unitData.late_count || 0}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="label">Absent</span>
                            <span class="value text-danger">${unitData.absent_count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="analytics-charts">
                <div class="chart-container">
                    <canvas id="attendanceTrendChart" width="400" height="200"></canvas>
                </div>
            </div>
            
            <div class="top-students-section">
                <h5>Top Performing Students</h5>
                <div class="students-list">
                    ${unitData.top_students && unitData.top_students.length > 0 ? 
                        unitData.top_students.map(student => `
                            <div class="student-performance-item">
                                <div class="student-info">
                                    <i class="fas fa-user-graduate"></i>
                                    <div>
                                        <strong>${student.name}</strong>
                                        <small>${student.registration_number}</small>
                                    </div>
                                </div>
                                <div class="performance-rate">
                                    <span class="rate ${student.attendance_rate > 80 ? 'text-success' : 'text-warning'}">
                                        ${student.attendance_rate}%
                                    </span>
                                </div>
                            </div>
                        `).join('') : 
                        '<p class="text-muted">No student data available</p>'
                    }
                </div>
            </div>
        `;

        content.innerHTML = html;
        card.style.display = 'block';

        if (typeof Chart !== 'undefined' && unitData.chart_data) {
            this.renderAttendanceChart(unitData.chart_data);
        }
    }

    renderAttendanceChart(chartData) {
        const ctx = document.getElementById('attendanceTrendChart')?.getContext('2d');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Attendance Rate',
                    data: chartData.rates || [75, 82, 78, 85],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
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
        });
    }

    hideUnitDetails() {
        const card = document.getElementById('unit-details-card');
        if (card) {
            card.style.display = 'none';
        }
    }

    // ==================== UTILITY METHODS ====================
    refreshPage() {
        window.location.reload();
    }

    initDynamicGreeting() {
        const greetingElement = document.getElementById('dynamic-greeting');
        if (!greetingElement) return;

        const hour = new Date().getHours();
        let greeting = 'Good evening';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        
        const userName = document.querySelector('.user-name')?.textContent || 'Professor';
        greetingElement.textContent = `${greeting}, ${userName.split(' ')[0]}`;
    }

    // ==================== AUTO REFRESH ====================
    startAutoRefresh() {
        setInterval(() => {
            if (this.currentTab === 'classes') {
                this.trackAllClassTimes();
            }
        }, 60000);
    }

    // ==================== ERROR HANDLING ====================
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
        this.classTimers.forEach((timer, classId) => {
            clearInterval(timer);
        });
        this.classTimers.clear();
        
        console.log('Lecturer Portal destroyed');
    }
}

// Location Detector Class (keep the same as before)
class LocationDetector {
    constructor() {
        this.currentLocation = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setDefaultDate();
    }

    bindEvents() {
        const buttons = [
            { id: 'get-current-location-btn', method: 'getCurrentLocation' },
            { id: 'clear-location-btn', method: 'clearLocation' },
            { id: 'test-location-btn', method: 'testLocationAccuracy' },
            { id: 'detect-location-btn', method: 'suggestVenueFromLocation' }
        ];

        buttons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                element.addEventListener('click', () => this[btn.method]());
            }
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('schedule_date');
        if (dateInput) {
            dateInput.value = today;
        }
    }

    async getCurrentLocation() {
        this.showLocationStatus('Acquiring location...', 'warning');

        if (!navigator.geolocation) {
            this.showLocationStatus('Geolocation not supported', 'error');
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                });
            });

            this.updateLocationData(position);
            this.showLocationStatus('Location acquired successfully!', 'success');
            
            const testBtn = document.getElementById('test-location-btn');
            if (testBtn) testBtn.disabled = false;

        } catch (error) {
            this.handleLocationError(error);
        }
    }

    updateLocationData(position) {
        this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };

        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        
        if (latInput) latInput.value = this.currentLocation.latitude.toFixed(6);
        if (lngInput) lngInput.value = this.currentLocation.longitude.toFixed(6);
        
        this.showAccuracyInfo(position.coords.accuracy);
    }

    showAccuracyInfo(accuracy) {
        const accuracyElement = document.getElementById('location-accuracy');
        const accuracyValue = document.getElementById('accuracy-value');
        const timestampElement = document.getElementById('location-timestamp');

        if (!accuracyElement || !accuracyValue || !timestampElement) return;

        accuracyValue.textContent = `±${Math.round(accuracy)} meters`;
        timestampElement.textContent = `Detected ${new Date().toLocaleTimeString()}`;
        accuracyElement.style.display = 'block';
    }

    async suggestVenueFromLocation() {
        if (!this.currentLocation) {
            await this.getCurrentLocation();
        }

        if (this.currentLocation) {
            this.showLocationStatus('Looking up venue name...', 'warning');
            
            try {
                const venue = await this.reverseGeocode(this.currentLocation.latitude, this.currentLocation.longitude);
                const venueInput = document.getElementById('venue');
                if (venueInput) {
                    venueInput.value = venue || 'Current Location';
                }
                this.showLocationStatus('Venue suggested from location', 'success');
            } catch (error) {
                const venueInput = document.getElementById('venue');
                if (venueInput) {
                    venueInput.value = 'Current Location';
                }
                this.showLocationStatus('Using generic venue name', 'info');
            }
        }
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            
            if (data.address) {
                return data.address.building || 
                       data.address.university ||
                       data.address.college ||
                       data.address.road ||
                       data.display_name.split(',')[0];
            }
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
        }
        
        return null;
    }

    testLocationAccuracy() {
        if (!this.currentLocation) return;

        const accuracy = this.currentLocation.accuracy;
        let message, type;

        if (accuracy <= 10) {
            message = 'Excellent GPS accuracy!';
            type = 'success';
        } else if (accuracy <= 25) {
            message = 'Good GPS accuracy';
            type = 'success';
        } else if (accuracy <= 50) {
            message = 'Fair GPS accuracy';
            type = 'warning';
        } else {
            message = 'Poor GPS accuracy - consider manual entry';
            type = 'error';
        }

        this.showNotification(message, type);
        const accuracyElement = document.getElementById('location-accuracy');
        if (accuracyElement) {
            accuracyElement.className = `location-accuracy ${type}`;
        }
    }

    clearLocation() {
        this.currentLocation = null;
        
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        const accuracyElement = document.getElementById('location-accuracy');
        const testBtn = document.getElementById('test-location-btn');
        
        if (latInput) latInput.value = '';
        if (lngInput) lngInput.value = '';
        if (accuracyElement) accuracyElement.style.display = 'none';
        if (testBtn) testBtn.disabled = true;
        
        this.showLocationStatus('Location cleared', 'info');
    }

    showLocationStatus(message, type) {
        const statusElement = document.getElementById('location-status');
        if (!statusElement) return;
        
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        if (text) text.textContent = message;
        statusElement.className = `location-status ${type}`;
        if (icon) icon.className = `fas fa-circle text-${type}`;
    }

    handleLocationError(error) {
        let message = 'Location detection failed';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied by user';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timeout';
                break;
        }
        
        this.showLocationStatus(message, 'error');
        this.showNotification('Please enable location services or enter coordinates manually', 'warning');
    }

    showNotification(message, type = 'info') {
        if (window.lecturerPortal && window.lecturerPortal.showNotification) {
            window.lecturerPortal.showNotification(message, type);
        } else {
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize the portal when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.lecturerPortal = new LecturerPortal();
});

// Global functions for HTML onclick handlers
function showTab(tabName) {
    if (window.lecturerPortal) {
        window.lecturerPortal.switchTab(tabName);
    }
}

function hideUnitDetails() {
    if (window.lecturerPortal) {
        window.lecturerPortal.hideUnitDetails();
    }
}

function generateQRCode(classId) {
    if (window.lecturerPortal) {
        window.lecturerPortal.generateQRCode(classId);
    }
}

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (window.lecturerPortal) {
        window.lecturerPortal.destroy();
    }
});