/**
 * 笔记管理器
 * 处理教学页面的高亮和笔记功能
 */

export interface Note {
    id: string;
    text: string; // 选中的原文
    noteContent: string; // 用户添加的笔记内容
    range: Range; // 选中的文本范围（序列化后的信息）
    position: { top: number; left: number }; // 选中文本的位置
    timestamp: number;
}

export interface Highlight {
    id: string;
    text: string;
    range: Range;
    timestamp: number;
}

class NoteManager {
    private notes: Note[] = [];
    private highlights: Highlight[] = [];
    private noteIdCounter: number = 0;
    private highlightIdCounter: number = 0;
    private currentSelection: Range | null = null;
    private currentSelectionRect: DOMRect | null = null;

    constructor() {
        this.loadFromStorage();
    }

    /**
     * 保存笔记到localStorage
     */
    private saveToStorage(): void {
        try {
            // 由于Range无法直接序列化，我们只保存可以序列化的信息
            const notesData = this.notes.map(note => ({
                id: note.id,
                text: note.text,
                noteContent: note.noteContent,
                position: note.position,
                timestamp: note.timestamp
            }));
            localStorage.setItem('educationNotes', JSON.stringify(notesData));
            localStorage.setItem('noteIdCounter', this.noteIdCounter.toString());
            localStorage.setItem('highlightIdCounter', this.highlightIdCounter.toString());
        } catch (e) {
            console.error('保存笔记失败:', e);
        }
    }

    /**
     * 从localStorage加载笔记
     */
    private loadFromStorage(): void {
        try {
            const notesData = localStorage.getItem('educationNotes');
            if (notesData) {
                const parsed = JSON.parse(notesData);
                // 恢复笔记数据（不包含Range，因为DOM中已经有标记了）
                this.notes = parsed.map((data: any) => ({
                    id: data.id,
                    text: data.text,
                    noteContent: data.noteContent,
                    range: null as any, // Range会在需要时从DOM获取
                    position: data.position,
                    timestamp: data.timestamp
                }));
            }
            const noteCounter = localStorage.getItem('noteIdCounter');
            if (noteCounter) {
                this.noteIdCounter = parseInt(noteCounter, 10);
            }
            const highlightCounter = localStorage.getItem('highlightIdCounter');
            if (highlightCounter) {
                this.highlightIdCounter = parseInt(highlightCounter, 10);
            }
        } catch (e) {
            console.error('加载笔记失败:', e);
        }
    }

    /**
     * 获取当前选中的文本
     */
    getCurrentSelection(): { text: string; range: Range; rect: DOMRect } | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const text = range.toString().trim();
        
        if (!text) {
            return null;
        }

        // 检查是否在教学页面内
        if (!this.isNodeWithinEducation(range.commonAncestorContainer)) {
            return null;
        }

        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            return null;
        }

        return { text, range: range.cloneRange(), rect };
    }

    /**
     * 检查节点是否在教学页面内
     */
    private isNodeWithinEducation(node: Node | null): boolean {
        while (node) {
            if (node instanceof HTMLElement && node.id === "educationTab") {
                return true;
            }
            let parent: Node | null = null;
            if (node instanceof HTMLElement && node.parentElement) {
                parent = node.parentElement;
            }
            if (!parent && node.parentNode) {
                parent = node.parentNode;
            }
            node = parent;
        }
        return false;
    }

    /**
     * 保存当前选中的文本信息
     */
    saveCurrentSelection(): void {
        const selection = this.getCurrentSelection();
        if (selection) {
            this.currentSelection = selection.range;
            this.currentSelectionRect = selection.rect;
        }
    }

    /**
     * 清除当前选中
     */
    clearCurrentSelection(): void {
        this.currentSelection = null;
        this.currentSelectionRect = null;
    }

    /**
     * 高亮选中的文本
     */
    highlightSelection(): boolean {
        if (!this.currentSelection) {
            return false;
        }

        try {
            const highlightId = `highlight-${++this.highlightIdCounter}`;
            const text = this.currentSelection.toString().trim();
            
            // 创建高亮标记
            const span = document.createElement('span');
            span.className = 'education-highlight';
            span.id = highlightId;
            span.setAttribute('data-highlight-id', highlightId);
            
            // 用span包裹选中的文本（使用更安全的方式）
            try {
                this.currentSelection.surroundContents(span);
            } catch (e) {
                // 如果surroundContents失败，尝试手动包裹
                const contents = this.currentSelection.extractContents();
                span.appendChild(contents);
                this.currentSelection.insertNode(span);
            }
            
            const highlight: Highlight = {
                id: highlightId,
                text,
                range: this.currentSelection,
                timestamp: Date.now()
            };
            
            this.highlights.push(highlight);
            this.saveToStorage();
            
            // 清除选中状态
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
            this.clearCurrentSelection();
            
            return true;
        } catch (e) {
            console.error('高亮失败:', e);
            return false;
        }
    }

    /**
     * 创建笔记
     */
    createNote(noteContent: string): Note | null {
        if (!this.currentSelection || !this.currentSelectionRect) {
            return null;
        }

        try {
            const noteId = `note-${++this.noteIdCounter}`;
            const text = this.currentSelection.toString().trim();
            
            // 创建笔记标记（黄色下划线）
            const span = document.createElement('span');
            span.className = 'education-note-mark';
            span.id = noteId;
            span.setAttribute('data-note-id', noteId);
            
            // 用span包裹选中的文本（使用更安全的方式）
            try {
                this.currentSelection.surroundContents(span);
            } catch (e) {
                // 如果surroundContents失败，尝试手动包裹
                const contents = this.currentSelection.extractContents();
                span.appendChild(contents);
                this.currentSelection.insertNode(span);
            }
            
            const note: Note = {
                id: noteId,
                text,
                noteContent,
                range: this.currentSelection,
                position: {
                    top: this.currentSelectionRect.top,
                    left: this.currentSelectionRect.left
                },
                timestamp: Date.now()
            };
            
            this.notes.push(note);
            this.saveToStorage();
            
            // 清除选中状态
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
            this.clearCurrentSelection();
            
            // 触发自定义事件，通知笔记已创建，以便添加点击事件
            const event = new CustomEvent('noteCreated', { detail: { noteId: noteId } });
            document.dispatchEvent(event);
            
            return note;
        } catch (e) {
            console.error('创建笔记失败:', e);
            return null;
        }
    }

    /**
     * 删除笔记
     */
    deleteNote(noteId: string): boolean {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex === -1) {
            return false;
        }

        // 移除DOM标记
        const markElement = document.getElementById(noteId);
        if (markElement) {
            const parent = markElement.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(markElement.textContent || ''), markElement);
                parent.normalize(); // 合并相邻的文本节点
            }
        }

        // 从数组中删除
        this.notes.splice(noteIndex, 1);
        this.saveToStorage();
        
        return true;
    }

    /**
     * 获取所有笔记
     */
    getAllNotes(): Note[] {
        return [...this.notes];
    }

    /**
     * 获取指定笔记
     */
    getNote(noteId: string): Note | null {
        const note = this.notes.find(n => n.id === noteId);
        return note || null;
    }

    /**
     * 更新笔记内容
     */
    updateNote(noteId: string, newContent: string): boolean {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex === -1) {
            return false;
        }

        // 更新笔记内容
        this.notes[noteIndex].noteContent = newContent;
        this.notes[noteIndex].timestamp = Date.now();
        this.saveToStorage();
        
        return true;
    }


    /**
     * 获取笔记在页面中的位置信息（用于定位笔记栏中的位置）
     */
    getNotePosition(noteId: string): { top: number } | null {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) {
            return null;
        }

        const element = document.getElementById(noteId);
        if (element) {
            const rect = element.getBoundingClientRect();
            const educationTab = document.getElementById('educationTab');
            if (educationTab) {
                const tabRect = educationTab.getBoundingClientRect();
                return {
                    top: rect.top - tabRect.top + educationTab.scrollTop
                };
            }
        }
        
        return { top: note.position.top };
    }
}

// 导出单例
export const noteManager = new NoteManager();

