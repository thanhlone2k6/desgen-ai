import { GenerationTask, UploadedImage } from "../types";

const STORAGE_KEY = "desgen_tasks";
const MAX_STORED_TASKS = 50; // Tăng lên vì không còn lưu base64 nặng

// OPTIMIZATION: Loại bỏ base64 images khỏi task trước khi lưu
// Chỉ giữ lại resultUrl (đã là blob URL hoặc data URL nhỏ hơn)
const sanitizeTaskForStorage = (task: GenerationTask): GenerationTask => {
    const sanitizedConfig = { ...task.config };
    
    // Xóa các ảnh base64 nặng khỏi config
    // Người dùng sẽ cần upload lại khi reuse task
    delete (sanitizedConfig as any).referenceImages;
    delete (sanitizedConfig as any).conceptImages;
    delete (sanitizedConfig as any).subjectImages;
    delete (sanitizedConfig as any).startFrame;
    delete (sanitizedConfig as any).endFrame;
    delete (sanitizedConfig as any).editImage;
    delete (sanitizedConfig as any).maskImage;
    
    return {
        ...task,
        config: sanitizedConfig
    };
};

// Debounce save để tránh gọi quá nhiều lần liên tiếp
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingTasks: GenerationTask[] | null = null;

export const saveTasksToStorage = (tasks: GenerationTask[]) => {
    pendingTasks = tasks;
    
    // Clear timeout cũ nếu có
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Debounce 2 giây - chỉ save khi không có thay đổi mới trong 2s
    saveTimeout = setTimeout(() => {
        if (!pendingTasks) return;
        
        try {
            // Sort by timestamp desc to keep newest
            const sortedTasks = [...pendingTasks].sort((a, b) => b.timestamp - a.timestamp);

            // Keep only completed/failed tasks with results (skip pending/processing)
            const completedTasks = sortedTasks.filter(t => 
                t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
            );
            
            // Sanitize và limit
            const tasksToSave = completedTasks
                .slice(0, MAX_STORED_TASKS)
                .map(sanitizeTaskForStorage);

            const jsonString = JSON.stringify(tasksToSave);
            
            // Kiểm tra size trước khi lưu (limit ~4MB để an toàn)
            if (jsonString.length > 4 * 1024 * 1024) {
                console.warn("Tasks data too large, reducing stored tasks");
                // Giảm số lượng tasks nếu quá lớn
                const reducedTasks = tasksToSave.slice(0, Math.floor(MAX_STORED_TASKS / 2));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedTasks));
            } else {
                localStorage.setItem(STORAGE_KEY, jsonString);
            }
        } catch (error) {
            console.warn("Failed to save tasks to localStorage:", error);
            // Nếu lỗi quota, xóa bớt data cũ
            if ((error as any)?.name === 'QuotaExceededError') {
                try {
                    const minimal = pendingTasks
                        .filter(t => t.status === 'completed' && t.isFavorite)
                        .slice(0, 10)
                        .map(sanitizeTaskForStorage);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
                } catch {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        }
        
        pendingTasks = null;
        saveTimeout = null;
    }, 2000);
};

export const loadTasksFromStorage = (): GenerationTask[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        
        const tasks = JSON.parse(stored) as GenerationTask[];
        
        // Validate và clean up tasks
        return tasks.filter(task => 
            task && 
            task.id && 
            task.config && 
            (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
        );
    } catch (error) {
        console.warn("Failed to load tasks from localStorage:", error);
        return [];
    }
};

// Force save ngay lập tức (dùng khi app sắp đóng)
export const flushTasksToStorage = () => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    if (pendingTasks) {
        const tasks = pendingTasks;
        pendingTasks = null;
        // Gọi lại với delay = 0
        saveTasksToStorage(tasks);
    }
};

// ============================================
// Device ID Management
// ============================================

const DEVICE_KEY = "desgen_device_id";

export const getOrCreateDeviceId = (): string => {
    try {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch (error) {
        console.warn("Failed to get/create device ID:", error);
        // Fallback: generate a temporary ID
        return crypto.randomUUID();
    }
};

// ============================================
// JWT Token Management
// ============================================

const TOKEN_KEY = "desgen_token";

export const setToken = (token: string): void => {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
        console.warn("Failed to save token to localStorage:", error);
    }
};

export const getToken = (): string | null => {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
        console.warn("Failed to get token from localStorage:", error);
        return null;
    }
};

export const clearToken = (): void => {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
        console.warn("Failed to remove token from localStorage:", error);
    }
};

// ============================================
// User Info Management
// ============================================

const USER_KEY = "desgen_user";

export interface StoredUser {
    user_id: string;
    email: string;
    name?: string;
    role: "free" | "vip";
}

export const setUser = (user: StoredUser): void => {
    try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
        console.warn("Failed to save user to localStorage:", error);
    }
};

export const getUser = (): StoredUser | null => {
    try {
        const stored = localStorage.getItem(USER_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as StoredUser;
    } catch (error) {
        console.warn("Failed to get user from localStorage:", error);
        return null;
    }
};

export const clearUser = (): void => {
    try {
        localStorage.removeItem(USER_KEY);
    } catch (error) {
        console.warn("Failed to remove user from localStorage:", error);
    }
};

// Clear all auth data (token + user) - Device ID is NOT cleared
export const clearAuth = (): void => {
    clearToken();
    clearUser();
};

// ============================================
// Saved Login Credentials (Auto-fill only)
// ============================================

const SAVED_CREDENTIALS_KEY = "desgen_saved_credentials";

export interface SavedCredentials {
    email: string;
    password: string; // Base64 encoded for basic obfuscation
}

// Simple base64 encoding/decoding (not encryption, just obfuscation)
const encodePassword = (password: string): string => {
    try {
        return btoa(password);
    } catch {
        return password; // Fallback if encoding fails
    }
};

const decodePassword = (encoded: string): string => {
    try {
        return atob(encoded);
    } catch {
        return encoded; // Fallback if decoding fails
    }
};

export const saveCredentials = (email: string, password: string): void => {
    try {
        const credentials: SavedCredentials = {
            email: email.toLowerCase().trim(),
            password: encodePassword(password)
        };
        localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(credentials));
    } catch (error) {
        console.warn("Failed to save credentials to localStorage:", error);
    }
};

export const getSavedCredentials = (): { email: string; password: string } | null => {
    try {
        const stored = localStorage.getItem(SAVED_CREDENTIALS_KEY);
        if (!stored) return null;
        const credentials = JSON.parse(stored) as SavedCredentials;
        return {
            email: credentials.email,
            password: decodePassword(credentials.password)
        };
    } catch (error) {
        console.warn("Failed to get saved credentials from localStorage:", error);
        return null;
    }
};

export const clearSavedCredentials = (): void => {
    try {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY);
    } catch (error) {
        console.warn("Failed to remove saved credentials from localStorage:", error);
    }
};

// ============================================
// Backward Compatibility (Deprecated - Not Used)
// ============================================
// These keys are kept for backward compatibility but are no longer used.
// Old keys: "gemini_api_key", "banana_pro_unlocked", "banana_pro_usage_count"