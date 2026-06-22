/**
 * ConvertIMG - Client Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let uploadedFiles = []; // Array of { id, original_name, temp_filename, size }
    let conversionHistory = JSON.parse(localStorage.getItem('convertimg_history') || '[]');
    let currentTheme = localStorage.getItem('convertimg_theme') || 'light';
    let draggedItemIndex = null;

    // Elements
    const htmlElement = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIconSun = document.getElementById('themeIconSun');
    const themeIconMoon = document.getElementById('themeIconMoon');
    
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    
    const progressCard = document.getElementById('progressCard');
    const progressStatus = document.getElementById('progressStatus');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressBar = document.getElementById('progressBar');
    
    const listHeader = document.getElementById('listHeader');
    const imageCountBadge = document.getElementById('imageCountBadge');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const imageGrid = document.getElementById('imageGrid');
    const emptyState = document.getElementById('emptyState');
    
    const pdfSettingsForm = document.getElementById('pdfSettingsForm');
    const pdfFilename = document.getElementById('pdfFilename');
    const pageSize = document.getElementById('pageSize');
    const orientationWrapper = document.getElementById('orientationWrapper');
    const pageOrientation = document.getElementById('pageOrientation');
    const pageMargin = document.getElementById('pageMargin');
    const convertBtn = document.getElementById('convertBtn');
    
    const historyContainer = document.getElementById('historyContainer');
    const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    const statusToast = document.getElementById('statusToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    
    // Initialize Toast
    const bsToast = new bootstrap.Toast(statusToast, { delay: 5000 });

    // Initialize App
    initApp();

    function initApp() {
        // Theme
        applyTheme(currentTheme);
        themeToggleBtn.addEventListener('click', toggleTheme);

        // File Selection listeners
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);

        // Drag & Drop listeners
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', handleFileDrop, false);

        // Settings Listeners
        pageSize.addEventListener('change', toggleOrientationField);
        pdfSettingsForm.addEventListener('submit', handleConvertSubmit);
        clearAllBtn.addEventListener('click', clearQueue);
        
        // History Listeners
        clearHistoryBtn.addEventListener('click', clearHistory);
        renderHistory();

        // Setup dropzone file limit warnings
        setInitialUIState();
    }

    // --- Theme Management ---
    function applyTheme(theme) {
        htmlElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('convertimg_theme', theme);
        if (theme === 'dark') {
            themeIconSun.classList.add('d-none');
            themeIconMoon.classList.remove('d-none');
        } else {
            themeIconSun.classList.remove('d-none');
            themeIconMoon.classList.add('d-none');
        }
    }

    function toggleTheme() {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(currentTheme);
    }

    // --- UI Helpers ---
    function showNotification(message, type = 'info') {
        toastMessage.textContent = message;
        
        // Reset classes
        statusToast.className = 'toast align-items-center border-0 shadow-lg';
        toastIcon.className = 'bi ';

        if (type === 'success') {
            statusToast.classList.add('text-bg-success');
            toastIcon.classList.add('bi-check-circle-fill');
        } else if (type === 'danger') {
            statusToast.classList.add('text-bg-danger');
            toastIcon.classList.add('bi-exclamation-triangle-fill');
        } else if (type === 'warning') {
            statusToast.classList.add('text-bg-warning');
            toastIcon.classList.add('bi-exclamation-circle-fill');
        } else {
            statusToast.classList.add('text-bg-info');
            toastIcon.classList.add('bi-info-circle-fill');
        }
        
        bsToast.show();
    }

    function toggleOrientationField() {
        if (pageSize.value === 'original') {
            orientationWrapper.classList.add('d-none');
        } else {
            orientationWrapper.classList.remove('d-none');
        }
    }

    function setInitialUIState() {
        if (uploadedFiles.length === 0) {
            emptyState.classList.remove('d-none');
            listHeader.classList.add('d-none');
            convertBtn.disabled = true;
        } else {
            emptyState.classList.add('d-none');
            listHeader.classList.remove('d-none');
            convertBtn.disabled = false;
        }
        imageCountBadge.textContent = uploadedFiles.length;
    }

    // Format file sizes
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // --- File Handlers ---
    function handleFileDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        processFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        processFiles(files);
        fileInput.value = ''; // Reset input so same files can be uploaded again
    }

    function processFiles(files) {
        if (!files || files.length === 0) return;
        
        const filesArray = Array.from(files);
        const validExtensions = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];
        const maxSizeBytes = 15 * 1024 * 1024; // 15MB
        
        const filterFiles = filesArray.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (!validExtensions.includes(ext)) {
                showNotification(`Skipped file "${file.name}": Unsupported format.`, 'warning');
                return false;
            }
            if (file.size > maxSizeBytes) {
                showNotification(`Skipped file "${file.name}": Size exceeds 15MB.`, 'warning');
                return false;
            }
            return true;
        });

        if (filterFiles.length === 0) return;

        // Upload files sequentially to manage progress effectively
        uploadSequential(filterFiles);
    }

    async function uploadSequential(files) {
        progressCard.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressPercentage.textContent = '0%';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            progressStatus.textContent = `Uploading file ${i + 1} of ${files.length}: ${file.name}`;
            
            try {
                const result = await uploadSingleFile(file);
                if (result && result.success) {
                    uploadedFiles.push({
                        id: 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        original_name: file.name,
                        temp_filename: result.temp_filename,
                        size: file.size,
                        preview_url: URL.createObjectURL(file) // Create object URL for local fast rendering
                    });
                    renderThumbnails();
                } else {
                    showNotification(`Failed to upload ${file.name}: ${result.error || 'Server error'}`, 'danger');
                }
            } catch (error) {
                showNotification(`Network error uploading ${file.name}`, 'danger');
            }
        }

        // Complete upload phase
        progressCard.classList.add('d-none');
        showNotification(`Successfully uploaded ${files.length} file(s).`, 'success');
        setInitialUIState();
    }

    function uploadSingleFile(file) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('image', file);

            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                    progressPercentage.textContent = percentComplete + '%';
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject(new Error('Invalid response format'));
                    }
                } else {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        reject(new Error(response.error || 'Upload error'));
                    } catch (e) {
                        reject(new Error(`Server returned code ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('Network connection error'));
            xhr.send(formData);
        });
    }

    // --- Thumbnails Grid & Drag Reordering ---
    function renderThumbnails() {
        imageGrid.innerHTML = '';
        
        uploadedFiles.forEach((file, index) => {
            const col = document.createElement('div');
            col.className = 'col';
            col.setAttribute('data-id', file.id);
            
            const card = document.createElement('div');
            card.className = 'thumbnail-card shadow-sm h-100';
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-index', index);
            
            // Thumbnail Index Badge
            const badge = document.createElement('div');
            badge.className = 'thumbnail-badge';
            badge.textContent = index + 1;
            
            // Actions
            const actions = document.createElement('div');
            actions.className = 'thumbnail-actions';
            
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-action-del';
            delBtn.innerHTML = '<i class="bi bi-x"></i>';
            delBtn.setAttribute('title', 'Remove image');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(index);
            });
            actions.appendChild(delBtn);
            
            // Image Preview Container
            const imgContainer = document.createElement('div');
            imgContainer.className = 'thumbnail-image-container';
            
            const img = document.createElement('img');
            img.src = file.preview_url;
            img.className = 'thumbnail-img';
            img.alt = file.original_name;
            imgContainer.appendChild(img);

            // Reorder buttons (left/right accessibility)
            const reorderContainer = document.createElement('div');
            reorderContainer.className = 'thumbnail-reorder-btns';
            
            const leftBtn = document.createElement('button');
            leftBtn.type = 'button';
            leftBtn.className = 'btn-reorder';
            leftBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
            leftBtn.setAttribute('title', 'Move left');
            leftBtn.disabled = index === 0;
            leftBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveImage(index, index - 1);
            });
            
            const rightBtn = document.createElement('button');
            rightBtn.type = 'button';
            rightBtn.className = 'btn-reorder';
            rightBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
            rightBtn.setAttribute('title', 'Move right');
            rightBtn.disabled = index === uploadedFiles.length - 1;
            rightBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveImage(index, index + 1);
            });
            
            reorderContainer.appendChild(leftBtn);
            reorderContainer.appendChild(rightBtn);
            
            // Thumbnail Details
            const details = document.createElement('div');
            details.className = 'thumbnail-details';
            
            const name = document.createElement('div');
            name.className = 'thumbnail-name';
            name.textContent = file.original_name;
            name.setAttribute('title', file.original_name);
            
            const size = document.createElement('div');
            size.className = 'thumbnail-size';
            size.textContent = formatBytes(file.size);
            
            details.appendChild(name);
            details.appendChild(size);
            
            card.appendChild(badge);
            card.appendChild(actions);
            card.appendChild(imgContainer);
            card.appendChild(reorderContainer);
            card.appendChild(details);
            
            // Drag and drop event bindings
            bindDragEvents(card);
            
            col.appendChild(card);
            imageGrid.appendChild(col);
        });
        
        setInitialUIState();
    }

    function removeFile(index) {
        // Revoke the object URL to release memory
        URL.revokeObjectURL(uploadedFiles[index].preview_url);
        uploadedFiles.splice(index, 1);
        renderThumbnails();
        showNotification('Image removed from conversion list.', 'info');
    }

    function moveImage(fromIndex, toIndex) {
        if (toIndex < 0 || toIndex >= uploadedFiles.length) return;
        const item = uploadedFiles.splice(fromIndex, 1)[0];
        uploadedFiles.splice(toIndex, 0, item);
        renderThumbnails();
    }

    function clearQueue() {
        if (confirm('Are you sure you want to clear all uploaded images?')) {
            uploadedFiles.forEach(file => URL.revokeObjectURL(file.preview_url));
            uploadedFiles = [];
            renderThumbnails();
            showNotification('Upload queue cleared.', 'info');
        }
    }

    // --- HTML5 Drag & Drop Reordering logic ---
    function bindDragEvents(card) {
        card.addEventListener('dragstart', (e) => {
            draggedItemIndex = parseInt(card.getAttribute('data-index'));
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Set simple string data for Firefox support
            e.dataTransfer.setData('text/plain', draggedItemIndex);
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            return false;
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetIndex = parseInt(card.getAttribute('data-index'));
            
            if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
                const draggedItem = uploadedFiles.splice(draggedItemIndex, 1)[0];
                uploadedFiles.splice(targetIndex, 0, draggedItem);
                renderThumbnails();
            }
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedItemIndex = null;
        });
    }

    // --- PDF Conversion Submission ---
    async function handleConvertSubmit(e) {
        e.preventDefault();
        
        if (uploadedFiles.length === 0) {
            showNotification('No images to convert.', 'warning');
            return;
        }

        // Enter loading state
        convertBtn.disabled = true;
        const btnTextSpan = convertBtn.querySelector('span');
        const originalBtnText = btnTextSpan.textContent;
        btnTextSpan.textContent = 'Processing PDF...';
        
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm me-2';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        convertBtn.insertBefore(spinner, convertBtn.firstChild);

        // Gather options
        const filename = pdfFilename.value.trim() || 'converted_images';
        const sizeOption = pageSize.value;
        const orientationOption = pageOrientation.value;
        const marginOption = pageMargin.value;
        
        // Get ordered list of temp filenames
        const orderedFiles = uploadedFiles.map(file => file.temp_filename);

        try {
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filenames: orderedFiles,
                    pdf_name: filename,
                    page_size: sizeOption,
                    orientation: orientationOption,
                    margin: marginOption
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showNotification('PDF converted successfully! Starting download...', 'success');
                
                // Add to history
                addHistoryItem({
                    filename: data.pdf_filename,
                    download_url: data.download_url,
                    timestamp: new Date().toLocaleString(),
                    size_text: formatBytes(data.pdf_size || 0)
                });

                // Trigger download
                const link = document.createElement('a');
                link.href = data.download_url;
                link.download = data.pdf_filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                showNotification(`Conversion failed: ${data.error || 'Server error'}`, 'danger');
            }
        } catch (error) {
            showNotification('Network connection error during PDF compilation', 'danger');
        } finally {
            // Restore conversion button state
            convertBtn.disabled = false;
            if (convertBtn.contains(spinner)) {
                convertBtn.removeChild(spinner);
            }
            btnTextSpan.textContent = originalBtnText;
        }
    }

    // --- History Tracking (Client-side localStorage) ---
    function addHistoryItem(item) {
        // Generate a random unique ID
        item.id = 'hist-' + Date.now();
        // Insert at beginning of list
        conversionHistory.unshift(item);
        // Retain only last 8 items
        if (conversionHistory.length > 8) {
            conversionHistory.pop();
        }
        localStorage.setItem('convertimg_history', JSON.stringify(conversionHistory));
        renderHistory();
    }

    function renderHistory() {
        historyContainer.innerHTML = '';
        
        if (conversionHistory.length === 0) {
            emptyHistoryMsg.classList.remove('d-none');
            clearHistoryBtn.classList.add('d-none');
            return;
        }

        emptyHistoryMsg.classList.add('d-none');
        clearHistoryBtn.classList.remove('d-none');

        conversionHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item align-items-center gap-2';
            
            const info = document.createElement('div');
            info.className = 'history-info';
            
            const name = document.createElement('div');
            name.className = 'history-name';
            name.textContent = item.filename;
            name.setAttribute('title', item.filename);
            
            const meta = document.createElement('div');
            meta.className = 'history-time d-flex gap-2';
            
            const dateSpan = document.createElement('span');
            dateSpan.textContent = item.timestamp;
            
            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'badge bg-secondary-subtle text-secondary-emphasis';
            sizeSpan.textContent = item.size_text;

            meta.appendChild(dateSpan);
            meta.appendChild(sizeSpan);
            
            info.appendChild(name);
            info.appendChild(meta);
            
            const downloadBtn = document.createElement('a');
            downloadBtn.href = item.download_url;
            downloadBtn.download = item.filename;
            downloadBtn.className = 'btn-history-dl';
            downloadBtn.innerHTML = '<i class="bi bi-arrow-down-circle-fill"></i>';
            downloadBtn.setAttribute('title', 'Download PDF again');
            
            div.appendChild(info);
            div.appendChild(downloadBtn);
            historyContainer.appendChild(div);
        });
    }

    function clearHistory() {
        if (confirm('Clear conversion history list? This will not delete files on the server.')) {
            conversionHistory = [];
            localStorage.setItem('convertimg_history', JSON.stringify(conversionHistory));
            renderHistory();
            showNotification('History list cleared.', 'info');
        }
    }
});
