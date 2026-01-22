/**
 * Custom Message Box Module
 * Replaces native browser alert, confirm, and prompt with a UI consistent with the app.
 * Supports: Dark Mode, Dragging, Async/Await
 */
class MessageBox {
    
    static async alert(message, title = 'Notification') {
        return this.show({
            type: 'alert',
            title: title,
            message: message,
            confirmText: 'OK'
        });
    }

    static async confirm(message, title = 'Confirm') {
        return this.show({
            type: 'confirm',
            title: title,
            message: message,
            confirmText: 'Yes',
            cancelText: 'Cancel'
        });
    }

    static async prompt(message, defaultValue = '', title = 'Input') {
        return this.show({
            type: 'prompt',
            title: title,
            message: message,
            inputValue: defaultValue,
            confirmText: 'OK',
            cancelText: 'Cancel',
            input: true
        });
    }

    static async custom(message, title = 'Action Required', buttons = []) {
        return this.show({
            type: 'custom',
            title: title,
            message: message,
            buttons: buttons
        });
    }

    /**
     * Internal render method
     */
    static show({
        type = 'alert',
        title = '',
        message = '',
        confirmText = 'OK',
        cancelText = null,
        input = false,
        inputType = 'text',
        inputValue = '',
        buttons = []
    } = {}) {
        return new Promise((resolve) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-box-wrapper';

            const popup = document.createElement('div');
            popup.className = 'message-box-popup modal-content bg-dark text-light border-secondary';
            
            // 按鈕生成邏輯
            let footerHtml = '';
            
            if (type === 'custom') {
                buttons.forEach(btn => {
                    footerHtml += `<button type="button" class="btn ${btn.className || 'btn-secondary'} btn-sm ms-2" data-value="${btn.value}">${btn.text}</button>`;
                });
            } else {
                if (cancelText) {
                    footerHtml += `<button type="button" class="btn btn-secondary btn-sm" data-action="cancel">${cancelText}</button>`;
                }
                footerHtml += `<button type="button" class="btn btn-primary btn-sm ms-2" data-action="confirm">${confirmText}</button>`;
            }

            // [關鍵修改] 移除了 style="white-space: pre-wrap;" 
            // 這樣 HTML 標籤才能正常排版，不會被程式碼縮排影響
            popup.innerHTML = `
                <div class="modal-header border-secondary py-2">
                    <h6 class="modal-title"><i class="bi bi-info-circle-fill me-2"></i>${title}</h6>
                    <button type="button" class="btn-close btn-close-white ms-auto" data-action="close"></button>
                </div>
                <div class="modal-body p-3 text-start">
                    <div class="mb-3">${message}</div>
                    ${input ? `<input type="${inputType}" class="form-control form-control-sm bg-dark text-light border-secondary" value="${inputValue}">` : ''}
                </div>
                <div class="modal-footer border-secondary py-2">
                    ${footerHtml}
                </div>
            `;

            wrapper.appendChild(popup);
            document.body.appendChild(wrapper);

            const inputEl = popup.querySelector('input');
            
            if (inputEl) {
                setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);
            }

            const close = (result) => {
                wrapper.remove();
                resolve(result);
            };

            popup.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                const customValue = target.getAttribute('data-value');
                if (customValue !== null) {
                    close(customValue);
                    return;
                }

                const action = target.getAttribute('data-action');
                if (action === 'confirm') {
                    type === 'prompt' ? close(inputEl.value) : close(true);
                } else if (action === 'cancel' || action === 'close') {
                    type === 'prompt' ? close(null) : close(false);
                }
            });

            wrapper.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            });

            const header = popup.querySelector('.modal-header');
            this.makeDraggable(popup, header);
        });
    }

    /**
     * Draggable Utility
     */
    static makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            
            // Switch from flex centered to absolute positioning for dragging
            const rect = element.getBoundingClientRect();
            element.style.position = 'absolute';
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.parentElement.style.justifyContent = 'unset'; // Remove flex center from wrapper
            element.parentElement.style.alignItems = 'unset';
            
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            handle.style.cursor = 'grabbing';
            e.preventDefault();
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // Cleanup listener when element is removed (handled by the closure logic mainly, 
        // but robust implementation would remove these listeners on close)
    }
}