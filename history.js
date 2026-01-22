/**
 * History Manager
 * Handles Undo/Redo stack and UI button states
 */
class HistoryManager {
    constructor(limit = 20) {
        this.stack = [];
        this.currentIndex = -1; // 指針初始為 -1，代表沒有任何狀態
        this.limit = limit;
    }

    /**
     * Save a new state
     */
    saveState(state) {
        // 如果我們在中間狀態 (曾按過 Undo)，新的動作會切斷後面的 Redo 歷史
        if (this.currentIndex < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
        }

        // 加入新狀態
        this.stack.push(state);
        this.currentIndex++;

        // 限制堆疊大小 (FIFO)
        if (this.stack.length > this.limit) {
            this.stack.shift();
            this.currentIndex--;
        }

        this.updateButtons();
    }

    /**
     * Undo: Move pointer back and return that state
     */
    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateButtons();
            return this.stack[this.currentIndex];
        }
        return null; // 無法再 Undo
    }

    /**
     * Redo: Move pointer forward and return that state
     */
    redo() {
        if (this.currentIndex < this.stack.length - 1) {
            this.currentIndex++;
            this.updateButtons();
            return this.stack[this.currentIndex];
        }
        return null; // 無法再 Redo
    }

    /**
     * Clear history
     */
    clear() {
        this.stack = [];
        this.currentIndex = -1;
        this.updateButtons();
    }

    /**
     * Update UI Buttons (Disable/Enable)
     */
    updateButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (undoBtn) {
            // 只有當 index > 0 時才能 Undo (至少要有一個「上一頁」)
            undoBtn.disabled = this.currentIndex <= 0;
        }

        if (redoBtn) {
            // 只有當 index 不是最後一個時才能 Redo
            redoBtn.disabled = this.currentIndex >= this.stack.length - 1;
        }
    }
}

// [關鍵修正] 立即實例化並掛載到 window，確保 app.js 能讀取到
window.historyManager = new HistoryManager();
console.log('[History] Manager initialized');