
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ApiKeyChecker } from './components/ApiKeyChecker';
import { ImageUploader } from './components/ImageUploader';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ImageCropperModal } from './components/ImageCropperModal';
import { MaskEditor } from './components/MaskEditor';
import { PromptAssistant } from './components/PromptAssistant';
import { UpdateDialog } from './components/UpdateDialog';
import { AuthScreen } from './components/AuthScreen';
import MatrixScanIntro from './components/MatrixScanIntro';
import { generateImageContent, generateVideoContent, chatWithAssistant } from './services/geminiService';
import { saveTasksToStorage, loadTasksFromStorage, getToken, clearAuth, getUser } from './services/storageService';
import { GenerationConfig, GenerationStyle, GenerationMode, GenerationModel, VideoType, UploadedImage, AspectRatio, Resolution, GenerationTask, CameraAngle, VideoDuration, EditType } from './types';
import { CAMERA_ANGLES, STYLES_LIST, MODEL_OPTIONS, MODEL_LABELS, RESOLUTIONS } from './constants';

const FEATURED_STYLES = [
  'AUTO',
  'TSHIRT_DESIGN',
  'IPHONE_RAW',
  'IPHONE_PHOTO',
  'REALISTIC',
  'CINEMATIC',
  '3D_RENDER',
  'MINIMALIST'
];

const VND_PER_TOKEN = 0.15; // Estimated safe average

// --- SVG ICONS MAPPING (Defined outside component to prevent re-creation) ---
const ModeIcons: Record<GenerationMode, React.ReactNode> = {
  [GenerationMode.CREATIVE]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  [GenerationMode.COPY_IDEA]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548 5.478a1 1 0 01-.994.904H8.42a1 1 0 01-.994-.904l-.548-5.478z" /></svg>,
  [GenerationMode.VIDEO]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  [GenerationMode.EDIT]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
};

// Banana Pro Unlock Dialog Component (defined outside App to avoid hoisting issues)
const BananaProUnlockDialog: React.FC<{
  onUnlock: (success: boolean) => void;
  onClose: () => void;
}> = ({ onUnlock, onClose }) => {
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.trim().toLowerCase() === 'thanhnguyen') {
      onUnlock(true);
    } else {
      setError('Mã không đúng. Vui lòng thử lại.');
      // Không xóa code để user có thể sửa và thử lại
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          placeholder="Nhập mã..."
          className="w-full rounded-xl border border-white/20 bg-black/20 p-4 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition text-center text-lg font-mono tracking-wider"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 font-bold text-white shadow-lg transition hover:scale-105 active:scale-95"
        >
          Mở Khóa
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-6 rounded-xl bg-slate-700 py-3 font-bold text-slate-300 transition hover:bg-slate-600"
        >
          Hủy
        </button>
      </div>
    </form>
  );
};

const WORKER_URL = "https://desgen-ai-worker.thanhnguyenphotowork.workers.dev";

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [entitlements, setEntitlements] = useState<{
    can_use_banana_pro: boolean;
    can_use_video: boolean;
    banana_pro_remaining: number;
    banana_pro_total: number;
    free_eligible: boolean;
  } | null>(null);
  const [user, setUser] = useState<{ user_id: string; email: string; name?: string; role: "free" | "vip" } | null>(null);
  const [showIntro, setShowIntro] = useState(true); // Show intro animation
  const [isDarkMode, setIsDarkMode] = useState(true); // Default Dark Mode for better Glass effect
  const [currentTime, setCurrentTime] = useState(Date.now()); // For Timer
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Mobile Drawer State
  const [showPromptAssistant, setShowPromptAssistant] = useState(false); // New Assistant State
  const [showUpdateDialog, setShowUpdateDialog] = useState(false); // Update Dialog State
  const [showBananaProLock, setShowBananaProLock] = useState(false); // Banana Pro Lock Dialog
  const BANANA_PRO_FREE_LIMIT = 20; // Giới hạn 20 ảnh miễn phí

  // -- RESIZABLE PANELS --
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem('leftPanelWidth');
    return saved ? parseInt(saved) : 320; // Default 320px (w-80)
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = localStorage.getItem('rightPanelWidth');
    return saved ? parseInt(saved) : 320; // Default 320px
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // -- TOKEN USAGE --
  const [totalTokens, setTotalTokens] = useState(0);

  // -- MODE STATE --
  const [mode, setMode] = useState<GenerationMode>(GenerationMode.CREATIVE);

  // -- COMMON INPUTS --
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [resolution, setResolution] = useState<Resolution>('2K');
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('NONE');
  const [selectedModel, setSelectedModel] = useState<GenerationModel>(GenerationModel.GEMINI_PRO);

  // -- CREATIVE MODE INPUTS --
  const [selectedStyle, setSelectedStyle] = useState<GenerationStyle>(GenerationStyle.AUTO); // Default AUTO
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [tshirtColor, setTshirtColor] = useState('');

  // -- COPY CONCEPT MODE INPUTS --
  const [conceptImages, setConceptImages] = useState<UploadedImage[]>([]);
  const [subjectImages, setSubjectImages] = useState<UploadedImage[]>([]); // Changed to array
  const [conceptStrength, setConceptStrength] = useState<number>(75);
  const [subjectStrength, setSubjectStrength] = useState<number>(80);
  const [conceptPrompt, setConceptPrompt] = useState('');

  // -- VIDEO MODE INPUTS --
  const [videoType, setVideoType] = useState<VideoType>(VideoType.TEXT_TO_VIDEO);
  const [videoStartFrame, setVideoStartFrame] = useState<UploadedImage | null>(null);
  const [videoEndFrame, setVideoEndFrame] = useState<UploadedImage | null>(null);
  const [videoDuration, setVideoDuration] = useState<VideoDuration>('5s');
  const [keepOutfit, setKeepOutfit] = useState(false);
  const [keepBackground, setKeepBackground] = useState(false);

  // -- EDIT MODE INPUTS --
  const [editImage, setEditImage] = useState<UploadedImage | null>(null);
  const [isEditingMask, setIsEditingMask] = useState(false);
  const [editType, setEditType] = useState<EditType>(EditType.OUTPAINT); // Default to OUTPAINT
  const [maskImage, setMaskImage] = useState<UploadedImage | null>(null);

  // -- PRESERVATION FLAGS --
  const [keepFace, setKeepFace] = useState(false);
  const [preservePose, setPreservePose] = useState(false);
  const [preserveExpression, setPreserveExpression] = useState(false);
  const [preserveStructure, setPreserveStructure] = useState(false);

  // -- SKIN BEAUTY --
  const [skinBeautyEnabled, setSkinBeautyEnabled] = useState(false);
  const [skinBeautyLevel, setSkinBeautyLevel] = useState(5); // 1-10

  // -- TASK QUEUE --
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [activeTab, setActiveTab] = useState<'creative' | 'copy' | 'video' | 'edit' | 'favorites'>('creative');
  const [previewTask, setPreviewTask] = useState<GenerationTask | null>(null);
  
  // Performance optimization: Limit displayed tasks to prevent lag
  const MAX_DISPLAYED_TASKS = 50;
  
  // Memoized filtered and limited tasks for better performance
  const displayedTasks = useMemo(() => {
    const filtered = tasks.filter(t => activeTab === 'favorites' ? t.isFavorite : true);
    // Sort by timestamp desc (newest first) and limit
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_DISPLAYED_TASKS);
  }, [tasks, activeTab]);
  
  // Store interval IDs for cancelling tasks
  const taskIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // -- API KEY STATE --
  const [apiKeyInput, setApiKeyInput] = useState('');

  // -- CROPPER STATE --
  const [cropState, setCropState] = useState<{
    image: UploadedImage;
    aspectRatio: number;
    isOutpaint?: boolean;
    callback: (cropped: UploadedImage, mask?: UploadedImage) => void;
  } | null>(null);

  // -- COMPUTED --
  // Filter Models based on Mode
  const filteredModels = useMemo(() => {
    if (mode === GenerationMode.VIDEO) {
      return MODEL_OPTIONS.filter(m => m.id === GenerationModel.VEO_FAST);
    } else if (mode === GenerationMode.EDIT) {
      // Edit mode: chỉ hiển thị Banana models
      return MODEL_OPTIONS.filter(m => 
        m.id === GenerationModel.GEMINI_PRO || m.id === GenerationModel.GEMINI_FLASH
      );
    } else {
      return MODEL_OPTIONS.filter(m => m.id !== GenerationModel.VEO_FAST);
    }
  }, [mode]);

  // Determine if Resolution Selector should be shown
  const showResolutionSelector = useMemo(() => {
    // Ẩn Resolution selector trong Edit mode
    if (mode === GenerationMode.EDIT) return false;
    return selectedModel === GenerationModel.GEMINI_PRO || selectedModel === GenerationModel.IMAGEN_ULTRA;
  }, [selectedModel, mode]);

  // -- EFFECTS --
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Function to fetch user info
  const fetchUserInfo = useCallback(async () => {
    const token = getToken();
    const storedUser = getUser();
    
    if (!token) {
      setIsAuthed(false);
      setUser(null);
      return;
    }

    // Set user from localStorage immediately for UI
    if (storedUser) {
      setUser(storedUser);
    }

    // Fetch user info and entitlements from server
      try {
        const res = await fetch(`${WORKER_URL}/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
        console.log('User info fetched:', data.user);
          setUser(data.user);
          setEntitlements(data.entitlements);
          setIsAuthed(true);
        } else {
          // Token invalid, clear auth
          clearAuth();
          setIsAuthed(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        clearAuth();
        setIsAuthed(false);
        setUser(null);
      }
  }, []);

  // Check auth and fetch entitlements on mount
  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  // Refresh entitlements after successful generation
  const refreshEntitlements = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${WORKER_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setEntitlements(data.entitlements);
      }
    } catch (error) {
      console.error('Failed to refresh entitlements:', error);
    }
  };

  // Load API Key on Mount from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('gemini_api_key');
    if (stored) setApiKeyInput(stored);
  }, []);

  // Setup Update Listeners and Auto-Check on Startup (only in Electron)
  useEffect(() => {
    if (!window.electronAPI?.update) return; // Not in Electron environment

    const handleUpdateAvailable = (info: { version: string; releaseDate: string; releaseNotes: string }) => {
      console.log('Update available:', info.version);
      setShowUpdateDialog(true);
    };

    const handleUpdateNotAvailable = () => {
      console.log('App is up to date');
    };

    const handleUpdateError = (error: string) => {
      console.error('Update check error:', error);
    };

    // Register listeners
    window.electronAPI.update.onAvailable(handleUpdateAvailable);
    window.electronAPI.update.onNotAvailable(handleUpdateNotAvailable);
    window.electronAPI.update.onError(handleUpdateError);

    // Auto-check for updates on startup (after a short delay to let app fully load)
    const checkTimer = setTimeout(() => {
      console.log('Auto-checking for updates on startup...');
      window.electronAPI?.update?.check();
    }, 3000); // Check after 3 seconds

    return () => {
      clearTimeout(checkTimer);
      window.electronAPI?.update?.removeAllListeners('update-available');
      window.electronAPI?.update?.removeAllListeners('update-not-available');
      window.electronAPI?.update?.removeAllListeners('update-error');
    };
  }, []);

  // Update Timer - CHỈ cập nhật cho tasks đang processing
  // OPTIMIZATION: Chỉ chạy khi có task đang xử lý, và giảm frequency xuống 1s
  const hasProcessingTasks = tasks.some(t => t.status === 'processing');
  useEffect(() => {
    if (!hasProcessingTasks) return; // Không chạy timer nếu không có task nào đang xử lý
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Giảm từ 100ms xuống 1000ms (10x ít hơn)
    return () => clearInterval(interval);
  }, [hasProcessingTasks]);

  // Update Selected Model when filtering changes
  useEffect(() => {
    if (!filteredModels.find(m => m.id === selectedModel)) {
      if (filteredModels.length > 0) {
        setSelectedModel(filteredModels[0].id);
      }
    }
    // Không tự động chuyển model khi chưa unlock - cho phép người dùng sử dụng 20 ảnh miễn phí
  }, [filteredModels, selectedModel]);

  // Set default resolution to 4K when using GEMINI_PRO
  useEffect(() => {
    if (selectedModel === GenerationModel.GEMINI_PRO && mode !== GenerationMode.EDIT) {
      setResolution('4K');
    }
  }, [selectedModel, mode]);

  // Set camera angle to NONE for Edit mode (giữ nguyên theo ảnh gốc)
  useEffect(() => {
    if (mode === GenerationMode.EDIT) {
      setCameraAngle('NONE');
    }
  }, [mode]);

  // Clear prompt khi chuyển mode/tab
  useEffect(() => {
    setPrompt('');
    setConceptPrompt(''); // Clear concept prompt trong Copy Idea mode
  }, [mode, activeTab]);

  // Update API Key - REMOVED: This function is no longer used
  // API key is now handled directly in the input field onChange
  /*
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Sanitize input: remove any non-ASCII characters to prevent headers error
    const sanitizedVal = val.replace(/[^\x00-\x7F]/g, "").trim();
    setApiKeyInput(sanitizedVal);
    sessionStorage.setItem('gemini_api_key', sanitizedVal);
  };
  */

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // If paste occurs inside a specific container that handles its own paste (like PromptAssistant), we skip
      if (e.target instanceof HTMLElement && e.target.closest('.prompt-assistant-container')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      const uploadedImage = await new Promise<UploadedImage>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.includes('base64,') ? base64String.split('base64,')[1] : base64String;
          resolve({
            id: Date.now().toString(),
            base64: base64Data,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      });

      if (mode === GenerationMode.CREATIVE) {
        setReferenceImages(prev => [...prev, uploadedImage]);
      } else if (mode === GenerationMode.COPY_IDEA) {
        if (conceptImages.length < 3) {
          setConceptImages(prev => [...prev, uploadedImage]);
        } else if (subjectImages.length < 3) { // Updated for subjectImages array
          setSubjectImages(prev => [...prev, uploadedImage]);
        }
      } else if (mode === GenerationMode.VIDEO) {
        if (videoType === VideoType.FRAMES) {
          if (!videoStartFrame) {
            triggerCrop(uploadedImage, (cropped) => setVideoStartFrame(cropped));
          } else if (!videoEndFrame) {
            triggerCrop(uploadedImage, (cropped) => setVideoEndFrame(cropped));
          }
        } else if (videoType === VideoType.IMAGE_TO_VIDEO) {
          triggerCrop(uploadedImage, (cropped) => setVideoStartFrame(cropped));
        }
      } else if (mode === GenerationMode.EDIT) {
        if (!editImage) setEditImage(uploadedImage);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [mode, videoType, conceptImages, subjectImages, videoStartFrame, videoEndFrame, aspectRatio, editImage]);

  // -- HANDLERS (MEMOIZED) --

  const triggerCrop = useCallback((img: UploadedImage, cb: (img: UploadedImage) => void, forcedRatio?: number) => {
    const ratio = forcedRatio !== undefined ? forcedRatio : (aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '16:9' ? 16 / 9 : 0);
    setCropState({
      image: img,
      aspectRatio: ratio,
      callback: cb
    });
  }, [aspectRatio]);

  const handleAddRefImages = useCallback((imgs: UploadedImage[]) => setReferenceImages(prev => [...prev, ...imgs]), []);
  const handleRemoveRefImage = useCallback((id: string) => setReferenceImages(prev => prev.filter(img => img.id !== id)), []);
  const handleClearRefImages = useCallback(() => setReferenceImages([]), []);

  const handleAddConceptImages = useCallback((imgs: UploadedImage[]) => {
    setConceptImages(prev => {
      const newConcepts = [...prev, ...imgs];
      if (newConcepts.length > 3) {
        alert("Chỉ được chọn tối đa 3 ảnh Concept.");
        return prev;
      }
      return newConcepts;
    });
  }, []);
  const handleRemoveConceptImage = useCallback((id: string) => setConceptImages(prev => prev.filter(img => img.id !== id)), []);
  const handleClearConceptImages = useCallback(() => setConceptImages([]), []);

  const handleAddSubjectImages = useCallback((imgs: UploadedImage[]) => {
    setSubjectImages(prev => {
      const newSubjects = [...prev, ...imgs];
      if (newSubjects.length > 3) {
        alert("Chỉ được chọn tối đa 3 ảnh Subject.");
        return prev;
      }
      return newSubjects;
    });
  }, []);
  const handleRemoveSubjectImage = useCallback((id: string) => setSubjectImages(prev => prev.filter(img => img.id !== id)), []);
  const handleClearSubjectImages = useCallback(() => setSubjectImages([]), []);

  const handleSwapConceptSubject = useCallback(() => {
    // Swap arrays - cần dùng refs tạm để tránh race condition
    const tempConcepts = conceptImages;
    const tempSubjects = subjectImages;
    setConceptImages(tempSubjects);
    setSubjectImages(tempConcepts);
  }, [conceptImages, subjectImages]);

  const handleVideoCrop = useCallback((img: UploadedImage, cb: (cropped: UploadedImage) => void) => {
    triggerCrop(img, cb, aspectRatio === '9:16' ? 9 / 16 : 16 / 9);
  }, [aspectRatio, triggerCrop]);

  const handleSetStartFrame = useCallback((imgs: UploadedImage[]) => setVideoStartFrame(imgs[0]), []);
  const handleRemoveStartFrame = useCallback(() => setVideoStartFrame(null), []);
  const handleSetEndFrame = useCallback((imgs: UploadedImage[]) => setVideoEndFrame(imgs[0]), []);
  const handleRemoveEndFrame = useCallback(() => setVideoEndFrame(null), []);

  const handleSetEditImage = useCallback((imgs: UploadedImage[]) => setEditImage(imgs[0]), []);
  const handleRemoveEditImage = useCallback(() => { setEditImage(null); setMaskImage(null); }, []);
  const handleOpenMaskEditor = useCallback(() => { if (editImage) setIsEditingMask(true); }, [editImage]);
  const handleMaskSave = useCallback((edited: UploadedImage, mask: UploadedImage, isOutpaint?: boolean, isSuperZoom?: boolean) => {
    setEditImage(edited);
    setMaskImage(mask);
    setIsEditingMask(false);
    if (isOutpaint) setEditType(EditType.OUTPAINT);
    else if (isSuperZoom) setEditType(EditType.SUPER_ZOOM);
  }, []);

  const handleMaskCancel = useCallback(() => setIsEditingMask(false), []);

  // Load tasks on mount
  useEffect(() => {
    const storedTasks = loadTasksFromStorage();
    if (storedTasks.length > 0) {
      setTasks(storedTasks);
    }
  }, []);

  // Save tasks on change
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  const handleGenerate = async () => {
    // Check if API key exists (required)
    const apiKey = sessionStorage.getItem('gemini_api_key');
    if (!apiKey || apiKey.trim().length === 0) {
      alert('Vui lòng nhập API key để sử dụng dịch vụ. API key là bắt buộc.');
      return;
    }
    
    // TEMPORARILY DISABLED - Unlimited Banana Pro (can be re-enabled later)
    // Check if trying to use Banana Pro without entitlements
    /*
    if (selectedModel === GenerationModel.GEMINI_PRO) {
      const canUse = entitlements?.can_use_banana_pro ?? false;
      const remaining = entitlements?.banana_pro_remaining ?? 0;
      
      if (!canUse && remaining <= 0) {
        setShowBananaProLock(true);
        const total = entitlements?.banana_pro_total ?? 0;
        if (total === 0) {
          alert('Tài khoản này không có lượt miễn phí Banana Pro. Vui lòng nâng cấp để tiếp tục.');
        } else {
          alert(`Bạn đã sử dụng hết ${total} lượt miễn phí Banana Pro. Vui lòng nâng cấp để tiếp tục.`);
        }
        return;
      }
    }
    */

    // Validate inputs
    if (mode === GenerationMode.CREATIVE) {
      if (!prompt.trim() && referenceImages.length === 0) {
        alert("Vui lòng nhập mô tả hoặc tải ảnh tham khảo.");
        return;
      }
    }

    if (mode === GenerationMode.COPY_IDEA) {
      if (conceptImages.length === 0 && subjectImages.length === 0) {
        alert("Vui lòng tải ít nhất 1 ảnh Concept hoặc Subject.");
        return;
      }
    }

    if (mode === GenerationMode.VIDEO) {
      if (!entitlements?.can_use_video) {
        alert("Tính năng Video chỉ dành cho tài khoản VIP. Vui lòng nâng cấp để sử dụng.");
        return;
      }
      if (videoType === VideoType.TEXT_TO_VIDEO && !prompt.trim()) {
        alert("Vui lòng nhập mô tả video.");
        return;
      }
      if (videoType !== VideoType.TEXT_TO_VIDEO && !videoStartFrame) {
        alert("Vui lòng tải Frame bắt đầu.");
        return;
      }
    }

    if (mode === GenerationMode.EDIT) {
      if (!editImage) {
        alert("Vui lòng tải ảnh cần chỉnh sửa.");
        return;
      }
    }

    // Auto-fill prompt for Outpainting if empty
    let finalPrompt = prompt;
    if (mode === GenerationMode.EDIT && editType === EditType.OUTPAINT && !finalPrompt.trim()) {
      finalPrompt = "Outpaint and expand this image naturally, maintaining the original style, lighting, and details. Fill the new area seamlessly. CRITICAL: Do NOT leave any black background or empty areas. You MUST fill the entire canvas completely with appropriate content that matches the scene. No black borders, no empty spaces, no transparent areas.";
    } else if (mode === GenerationMode.EDIT && finalPrompt.trim()) {
      // Thêm instruction vào prompt nếu người dùng đã nhập
      finalPrompt = finalPrompt + " CRITICAL: Do NOT leave any black background or empty areas. You MUST fill the entire canvas completely with appropriate content that matches the scene. No black borders, no empty spaces, no transparent areas.";
    }

    const taskId = Date.now().toString();
    
    // Set resolution to 4K for GEMINI_PRO in Edit mode
    const finalResolution = (mode === GenerationMode.EDIT && selectedModel === GenerationModel.GEMINI_PRO) 
      ? '4K' 
      : resolution;
    
    // For Edit mode: aspect ratio tùy theo người dùng mở rộng (không cố định)
    // Camera angle giữ nguyên theo ảnh gốc (NONE)
    const finalAspectRatio = mode === GenerationMode.EDIT ? '1:1' : aspectRatio; // Default, sẽ được override bởi crop
    const finalCameraAngle = mode === GenerationMode.EDIT ? 'NONE' : cameraAngle;
    
    const config: GenerationConfig = {
      mode,
      model: selectedModel as GenerationModel,
      prompt: finalPrompt,
      style: selectedStyle,
      referenceImages,
      conceptImages,
      subjectImages, // Updated to array
      conceptStrength,
      subjectStrength,
      conceptPrompt,
      videoType,
      startFrame: videoStartFrame || undefined,
      endFrame: videoEndFrame || undefined,
      videoResolution: '720p', // Default value, can be made dynamic
      videoDuration,
      editType,
      editImage: editImage || undefined,
      maskImage: maskImage || undefined,
      aspectRatio: finalAspectRatio,
      resolution: finalResolution,
      cameraAngle: finalCameraAngle,
      keepFace,
      preservePose,
      preserveExpression,
      preserveStructure,
      keepOutfit,
      keepBackground,
      backgroundColor: tshirtColor,
      skinBeautyEnabled,
      skinBeautyLevel
    };
    const newTask: GenerationTask = {
      id: taskId,
      config: config,
      status: 'pending',
      progress: 0,
      timestamp: Date.now(),
      isFavorite: false,
    };

    setTasks(prev => [newTask, ...prev]);

    // Progress Simulation - OPTIMIZED: Giảm frequency từ 500ms xuống 1500ms
    const progressInterval = setInterval(() => {
      setTasks(currentTasks => {
        const task = currentTasks.find(t => t.id === taskId);
        // Early return nếu task không tồn tại hoặc không còn processing
        if (!task || task.status !== 'processing') return currentTasks;
        
        let increment = 0;
        if (task.progress < 30) increment = Math.random() * 8 + 4; // Tăng increment để bù cho frequency thấp hơn
        else if (task.progress < 70) increment = Math.random() * 4 + 2;
        else if (task.progress < 90) increment = Math.random() * 1.5;
        else increment = 0;

        const nextProgress = Math.min(task.progress + increment, 95);
        
        return currentTasks.map(t => 
          t.id === taskId ? { ...t, progress: parseFloat(nextProgress.toFixed(1)) } : t
        );
      });
    }, 1500); // Giảm từ 500ms xuống 1500ms (3x ít hơn)
    
    // Lưu interval ID để cleanup
    taskIntervalsRef.current.set(taskId, progressInterval);

    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'processing', progress: 5 } : t));

      let result;
      if (mode === GenerationMode.VIDEO) {
        result = await generateVideoContent(newTask.config);
      } else {
        result = await generateImageContent(newTask.config);
      }

      clearInterval(progressInterval);
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        status: 'completed',
        progress: 100,
        resultUrl: result.url,
        usage: result.usage,
        elapsedSeconds: (Date.now() - t.timestamp) / 1000
      } : t));

      if (result.usage?.totalTokenCount) {
        setTotalTokens(prev => prev + result.usage!.totalTokenCount);
      }

      // Refresh entitlements after successful generation
      if (selectedModel === GenerationModel.GEMINI_PRO) {
        await refreshEntitlements();
      }

    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('Generation error:', error);
      
      // Safely extract error message - handle nested objects
      let errorMessage = "Lỗi không xác định";
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message || error.toString();
      } else if (error?.message) {
        errorMessage = String(error.message);
      } else if (error?.error) {
        // Handle nested error object
        if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (error.error?.message) {
          errorMessage = String(error.error.message);
        } else if (error.error?.details && Array.isArray(error.error.details)) {
          // Extract from Google API error details
          const details = error.error.details.map((d: any) => d.message || JSON.stringify(d)).filter(Boolean);
          errorMessage = details.join('; ') || String(error.error);
        } else {
          errorMessage = String(error.error);
        }
      } else if (error) {
        // Last resort: try to extract meaningful info
        try {
          const errorStr = JSON.stringify(error);
          // If it's too long or complex, try to extract message field
          if (errorStr.length > 500) {
            const parsed = JSON.parse(errorStr);
            if (parsed.message) {
              errorMessage = String(parsed.message);
            } else if (parsed.error?.message) {
              errorMessage = String(parsed.error.message);
            } else {
              errorMessage = errorStr.substring(0, 200) + '...';
            }
          } else {
            errorMessage = errorStr;
          }
        } catch {
          errorMessage = String(error);
        }
      }
      
      // TEMPORARILY DISABLED - Unlimited Banana Pro
      // Handle 403 upgrade_required
      /*
      if (errorMessage.includes('upgrade_required') || errorMessage.includes('Hết 20 lượt')) {
        errorMessage = 'Hết 20 lượt free Banana Pro. Vui lòng nâng cấp để tiếp tục.';
        await refreshEntitlements();
      }
      */
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed', error: errorMessage } : t));
    }
  };

  const handleToggleFavorite = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    // Clear interval if task is processing
    const interval = taskIntervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      taskIntervalsRef.current.delete(id);
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  // Copy task configuration to reuse
  const handleReuseTask = (task: GenerationTask) => {
    const config = task.config;
    
    // Set mode and active tab
    setMode(config.mode);
    if (config.mode === GenerationMode.CREATIVE) setActiveTab('creative');
    else if (config.mode === GenerationMode.COPY_IDEA) setActiveTab('copy');
    else if (config.mode === GenerationMode.VIDEO) setActiveTab('video');
    else if (config.mode === GenerationMode.EDIT) setActiveTab('edit');
    
    // Set prompt
    setPrompt(config.prompt || '');
    
    // Set model
    setSelectedModel(config.model);
    
    // Set style (for Creative mode)
    if (config.style) {
      setSelectedStyle(config.style);
    }
    
    // Set aspect ratio and resolution
    if (config.aspectRatio) {
      setAspectRatio(config.aspectRatio);
    }
    if (config.resolution) {
      setResolution(config.resolution);
    }
    
    // Set camera angle
    if (config.cameraAngle) {
      setCameraAngle(config.cameraAngle);
    }
    
    // IMPORTANT: Clear all images first to avoid keeping old images
    setReferenceImages([]);
    setConceptImages([]);
    setSubjectImages([]);
    setVideoStartFrame(null);
    setVideoEndFrame(null);
    setEditImage(null);
    setMaskImage(null);
    setTshirtColor('');
    
    // Copy images based on mode - only if they exist
    if (config.mode === GenerationMode.CREATIVE) {
      // Reference images
      if (config.referenceImages && config.referenceImages.length > 0) {
        setReferenceImages([...config.referenceImages]);
      }
      // T-shirt color
      if (config.backgroundColor) {
        setTshirtColor(config.backgroundColor);
      }
    } else if (config.mode === GenerationMode.COPY_IDEA) {
      // Concept images
      if (config.conceptImages && config.conceptImages.length > 0) {
        setConceptImages([...config.conceptImages]);
      }
      // Subject images
      if (config.subjectImages && config.subjectImages.length > 0) {
        setSubjectImages([...config.subjectImages]);
      }
      // Concept strength and prompt
      if (config.conceptStrength !== undefined) {
        setConceptStrength(config.conceptStrength);
      }
      if (config.subjectStrength !== undefined) {
        setSubjectStrength(config.subjectStrength);
      }
      if (config.conceptPrompt) {
        setConceptPrompt(config.conceptPrompt);
      } else {
        setConceptPrompt('');
      }
    } else if (config.mode === GenerationMode.VIDEO) {
      // Video settings
      if (config.videoType) {
        setVideoType(config.videoType);
      }
      if (config.startFrame) {
        setVideoStartFrame(config.startFrame);
      }
      if (config.endFrame) {
        setVideoEndFrame(config.endFrame);
      }
      if (config.videoDuration) {
        setVideoDuration(config.videoDuration);
      }
      if (config.keepOutfit !== undefined) {
        setKeepOutfit(config.keepOutfit);
      }
      if (config.keepBackground !== undefined) {
        setKeepBackground(config.keepBackground);
      }
    } else if (config.mode === GenerationMode.EDIT) {
      // Edit settings
      if (config.editImage) {
        setEditImage(config.editImage);
      }
      if (config.maskImage) {
        setMaskImage(config.maskImage);
      }
      if (config.editType) {
        setEditType(config.editType);
      }
    }
    
    // Preservation flags
    if (config.keepFace !== undefined) setKeepFace(config.keepFace);
    if (config.preservePose !== undefined) setPreservePose(config.preservePose);
    if (config.preserveExpression !== undefined) setPreserveExpression(config.preserveExpression);
    if (config.preserveStructure !== undefined) setPreserveStructure(config.preserveStructure);
    
    // Scroll to top of input section
    setTimeout(() => {
      const inputSection = document.querySelector('.glass-panel');
      if (inputSection) {
        inputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCancelTask = useCallback((id: string) => {
    // Clear progress interval
    const interval = taskIntervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      taskIntervalsRef.current.delete(id);
    }
    
    // Update task status to cancelled
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: 'cancelled', error: 'Đã hủy bởi người dùng' } : t
    ));
  }, []);

  const getElapsedTime = useCallback((startTime: number) => {
    const diff = currentTime - startTime;
    return (diff / 1000).toFixed(1) + 's';
  }, [currentTime]);

  const handleCopyImage = useCallback(async (imageUrl: string) => {
    try {
      let blob: Blob;
      
      // Handle data URL (base64)
      if (imageUrl.startsWith('data:')) {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } 
      // Handle blob URL
      else if (imageUrl.startsWith('blob:')) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch blob URL');
        }
        blob = await response.blob();
      }
      // Handle regular URL
      else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch image');
        }
        blob = await response.blob();
      }

      // Ensure we have a valid blob
      if (!blob || blob.size === 0) {
        throw new Error('Invalid blob');
      }

      // Normalize MIME type - fallback to image/png if not set
      const mimeType = blob.type || 'image/png';
      
      // Create ClipboardItem with proper MIME type
      const clipboardItem = new ClipboardItem({
        [mimeType]: blob
      });

      await navigator.clipboard.write([clipboardItem]);
      alert("Đã copy ảnh vào clipboard!");
    } catch (err: any) {
      console.error("Failed to copy:", err);
      
      // Fallback: Try converting to canvas and copying
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get canvas context');
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (!blob) {
            alert("Không thể copy ảnh này. Vui lòng thử tải về thay vì copy.");
            return;
          }
          
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                [blob.type || 'image/png']: blob
              })
            ]);
            alert("Đã copy ảnh vào clipboard!");
          } catch (e) {
            console.error("Fallback copy failed:", e);
            alert("Không thể copy ảnh này. Vui lòng thử tải về thay vì copy.");
          }
        }, 'image/png');
      } catch (fallbackErr) {
        console.error("Fallback method failed:", fallbackErr);
        alert("Không thể copy ảnh này. Vui lòng thử tải về thay vì copy.");
      }
    }
  }, []);

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 600) {
          setLeftPanelWidth(newWidth);
          localStorage.setItem('leftPanelWidth', newWidth.toString());
        }
      }
      if (isResizingRight) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 200 && newWidth <= 600) {
          setRightPanelWidth(newWidth);
          localStorage.setItem('rightPanelWidth', newWidth.toString());
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight]);

  // --- RENDER SIDEBAR CONTENT (SHARED) ---
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full space-y-6">
      {/* API Key Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Key</label>
          {sessionStorage.getItem('gemini_api_key') && (
        <button
          onClick={() => {
                if (confirm('Bạn có chắc muốn xóa API Key? Bạn sẽ cần nhập lại để tiếp tục sử dụng.')) {
              setApiKeyInput('');
                  sessionStorage.removeItem('gemini_api_key');
                }
              }}
              className="text-[10px] text-slate-500 hover:text-red-400 transition font-medium"
              title="Xóa API Key"
            >
              Clear API Key
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => {
              const value = e.target.value.replace(/[^\x00-\x7F]/g, "");
              setApiKeyInput(value);
              // Auto-save to sessionStorage
              if (value.trim().length > 10) {
                sessionStorage.setItem('gemini_api_key', value.trim());
              } else if (value.trim().length === 0) {
                sessionStorage.removeItem('gemini_api_key');
            }
          }}
            placeholder="Nhập API Key..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
          />
          {apiKeyInput && (
            <button
              onClick={() => {
                setApiKeyInput('');
                sessionStorage.removeItem('gemini_api_key');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 hover:text-red-400 transition"
              title="Xóa API Key"
        >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
          )}
        </div>
        {sessionStorage.getItem('gemini_api_key') && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            API Key đã lưu
          </div>
        )}
      </div>

      {/* Model Selection (Filtered) */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Model</label>
        <div className="grid gap-2">
          {filteredModels.map(opt => {
            const isBananaPro = opt.id === GenerationModel.GEMINI_PRO;
            const canUse = entitlements?.can_use_banana_pro ?? false;
            const isLocked = isBananaPro && !canUse;
            const remainingFree = isLocked ? (entitlements?.banana_pro_remaining ?? 0) : null;
            const totalFree = entitlements?.banana_pro_total ?? 0;
            
            return (
              <div key={opt.id} className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedModel(opt.id);
                    setShowMobileMenu(false);
                  }}
                  className={`relative flex items-center justify-between rounded-xl border p-3 text-left transition-all w-full ${
                    selectedModel === opt.id ? 'border-brand-500 bg-brand-500/10 shadow-neon' : 
                    'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                  }`}
                >
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${selectedModel === opt.id ? 'text-brand-300' : 'text-slate-300'}`}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-slate-500">{opt.desc}</div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${selectedModel === opt.id ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{opt.badge}</span>
                </button>
                {/* Chú thích giới hạn cho Banana Pro chưa unlock */}
                {isLocked && (
                  <div className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-yellow-400 font-bold">
                        {remainingFree !== null && remainingFree > 0 
                          ? `Còn ${remainingFree}/${totalFree} ảnh miễn phí`
                          : totalFree > 0
                          ? `Đã hết ${totalFree} ảnh miễn phí`
                          : 'Không có lượt miễn phí'
                        }
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBananaProLock(true);
                          setShowMobileMenu(false);
                        }}
                        className="text-yellow-300 hover:text-yellow-200 underline text-[9px] font-bold"
                      >
                        Nhập mã
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Style Selector */}
      {mode === GenerationMode.CREATIVE && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Art Style</label>
            <button onClick={() => setShowAllStyles(!showAllStyles)} className="text-[10px] text-brand-400 hover:text-brand-300 underline">
              {showAllStyles ? 'Thu gọn' : 'Xem tất cả'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STYLES_LIST.filter(s => showAllStyles || FEATURED_STYLES.includes(s.id)).map((style) => (
              <button
                key={style.id}
                onClick={() => { setSelectedStyle(style.id as GenerationStyle); setShowMobileMenu(false); }}
                className={`relative overflow-hidden rounded-xl border transition-all h-16 group ${selectedStyle === style.id ? 'border-brand-500 ring-1 ring-brand-500 scale-[1.02]' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <div className={`absolute inset-0 ${style.gradient || 'bg-slate-800'} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                <div className="relative z-10 flex flex-col items-center justify-center h-full p-1">
                  <span className="text-lg drop-shadow-md filter">{style.icon}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide drop-shadow-md ${style.gradient?.includes('text-black') || style.gradient?.includes('text-slate-800') ? 'text-slate-900' : 'text-white'}`}>
                    {style.label.split('(')[0]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Selector (Conditional) - Ẩn trong Edit mode */}
      {showResolutionSelector && (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resolution</label>
          <div className="grid grid-cols-3 gap-2">
            {RESOLUTIONS.map((res) => (
              <button
                key={res.value}
                onClick={() => setResolution(res.value as Resolution)}
                className={`rounded-lg border py-2 text-xs font-bold transition ${resolution === res.value ? 'border-brand-500 bg-brand-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {res.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aspect Ratio - Ẩn trong Edit mode */}
      {mode !== GenerationMode.EDIT && (
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aspect Ratio</label>
          <div className="grid grid-cols-3 gap-2">
            {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio as AspectRatio)}
                className={`rounded-lg border py-2 text-xs font-bold transition ${aspectRatio === ratio ? 'border-brand-500 bg-brand-500/20 text-white' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Camera Angle - Ẩn trong Edit mode */}
      {mode !== GenerationMode.EDIT && (
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Camera Angle</label>
          <select
            value={cameraAngle}
            onChange={(e) => setCameraAngle(e.target.value as CameraAngle)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-brand-500"
          >
            {CAMERA_ANGLES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="pt-4 mt-auto border-t border-slate-800 pb-20 md:pb-0 space-y-3">
        {/* Logout Button */}
        <button
          onClick={() => {
            if (confirm('Bạn có chắc muốn đăng xuất?')) {
              clearAuth();
              setIsAuthed(false);
              setUser(null);
              setEntitlements(null);
              window.location.reload();
            }
          }}
          className="w-full rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-900/30 hover:text-red-200 transition flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Đăng xuất
        </button>
        
        {/* Check for Updates Button (only in Electron) */}
        {window.electronAPI?.update && (
          <button
            onClick={() => {
              setShowUpdateDialog(true);
              window.electronAPI?.update?.check();
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Kiểm Tra Cập Nhật
          </button>
        )}
        
        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
          <span>Tokens Used:</span>
          <span className="font-mono text-brand-400">{totalTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>Est. Cost:</span>
          <span className="font-mono text-green-400">≈ {(totalTokens * VND_PER_TOKEN).toLocaleString('vi-VN')}₫</span>
        </div>
      </div>
    </div>
  );

  // Show intro animation first
  if (showIntro) {
    return (
      <MatrixScanIntro 
        durationMs={6000} 
        onDone={() => setShowIntro(false)} 
        title="DesGen AI Pro"
      />
    );
  }

  // Check authentication
  // TEMPORARILY DISABLED - AuthScreen hidden (can be re-enabled later)
  // To re-enable: uncomment the code below and remove this comment block
  /*
  if (!isAuthed) {
    return <AuthScreen onAuthed={() => {
      // Reload user info after authentication
      fetchUserInfo();
    }} />;
  }
  */

  if (!isReady) {
    return <ApiKeyChecker onReady={() => setIsReady(true)} />;
  }

  return (
    <div className={`flex min-h-screen w-full transition-colors duration-500 ${isDarkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>

      {/* --- DESKTOP SIDEBAR --- */}
      <div 
        className="hidden flex-col border-r border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl md:flex shrink-0 relative"
        style={{ width: `${leftPanelWidth}px`, minWidth: '200px', maxWidth: '600px' }}
      >
        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-500/50 transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingLeft(true);
          }}
          style={{ cursor: 'col-resize' }}
        />
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-400 to-brand-600 shadow-lg shadow-brand-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">DesGen AI <span className="text-brand-400">Pro</span></h1>
            <button
              onClick={() => {
                const url = "https://www.facebook.com/thanh.ng.274715/";
                if (window.electronAPI?.shell?.openExternal) {
                  window.electronAPI.shell.openExternal(url);
                } else {
                  // Fallback for web/browser
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
              className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition mt-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </button>
          </div>
        </div>

        {/* User Info - Hiển thị ngay dưới tên app */}
        {user && (
          <div className="mb-6 p-3 rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white/20">
                  {user.name ? (
                    user.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  ) : (
                    user.email[0].toUpperCase()
                  )}
                </div>
              </div>
              
              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {user.name || 'Người dùng'}
                  </div>
                  <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                    user.role === 'vip' 
                      ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-300 border border-yellow-500/60 shadow-sm' 
                      : 'bg-slate-700/60 text-slate-300 border border-slate-600/60'
                  }`}>
                    {user.role === 'vip' ? 'VIP' : 'Free'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          {renderSidebarContent()}
        </div>
      </div>

      {/* --- MOBILE SIDEBAR DRAWER --- */}
      <div className={`fixed inset-0 z-50 flex transform transition-transform duration-300 md:hidden ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}></div>

        {/* Drawer */}
        <div className="relative flex w-80 max-w-[85vw] flex-col bg-slate-900 p-6 shadow-2xl overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-400 to-brand-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <div>
                <div className="font-bold text-white">DesGen AI Pro</div>
                <button
                  onClick={() => {
                    const url = "https://www.facebook.com/thanh.ng.274715/";
                    if (window.electronAPI?.shell?.openExternal) {
                      window.electronAPI.shell.openExternal(url);
                    } else {
                      // Fallback for web/browser
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
              </div>
            </div>
            <button onClick={() => setShowMobileMenu(false)} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          
          {/* User Info - Mobile Sidebar */}
          {user && (
            <div className="mb-6 p-3 rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white/20">
                    {user.name ? (
                      user.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    ) : (
                      user.email[0].toUpperCase()
                    )}
                  </div>
                </div>
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm font-semibold text-white truncate">
                      {user.name || 'Người dùng'}
                    </div>
                    <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                      user.role === 'vip' 
                        ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-300 border border-yellow-500/60 shadow-sm' 
                        : 'bg-slate-700/60 text-slate-300 border border-slate-600/60'
                    }`}>
                      {user.role === 'vip' ? 'VIP' : 'Free'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {renderSidebarContent()}
        </div>
      </div>

      {/* --- MAIN CONTENT WRAPPER --- */}
      <div className="flex flex-1 relative overflow-hidden">

        {/* CENTER CONTENT */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-aurora w-full">
          {/* Top Navigation / Mobile Header */}
          <div className="glass-panel z-10 flex flex-col gap-4 border-b border-white/10 p-4 shadow-glass backdrop-blur-md sticky top-0 md:relative">
            <div className="flex items-center justify-between">

              {/* Mobile Menu Button (Only Visible on Mobile) */}
              <div className="flex items-center gap-3 md:hidden">
                <button onClick={() => setShowMobileMenu(true)} className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="font-bold text-white text-base">DesGen AI <span className="text-brand-400">Pro</span></div>
              </div>

              {/* Mode Tabs (Responsive) */}
              <div className="flex overflow-x-auto scrollbar-hide gap-2 p-1 bg-black/20 rounded-xl backdrop-blur-sm self-center w-full sm:w-auto mt-2 sm:mt-0">
                {[
                  { id: GenerationMode.CREATIVE, label: 'Creative', tab: 'creative', disabled: false },
                  { id: GenerationMode.COPY_IDEA, label: 'Copy Idea', tab: 'copy', disabled: false },
                  { id: GenerationMode.VIDEO, label: 'Video', tab: 'video', disabled: true }, // Locked
                  { id: GenerationMode.EDIT, label: 'Edit', tab: 'edit', disabled: false },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { 
                      if (m.disabled) return;
                      setMode(m.id as GenerationMode); 
                      setActiveTab(m.tab as any);
                      // Clear prompt khi chuyển tab
                      setPrompt('');
                      setConceptPrompt('');
                    }}
                    disabled={m.disabled}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                      m.disabled 
                        ? 'text-slate-600 cursor-not-allowed opacity-50' 
                        : activeTab === m.tab 
                          ? 'bg-white text-slate-900 shadow-lg scale-105' 
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    title={m.disabled ? 'Tính năng này đang tạm khóa' : ''}
                  >
                    {ModeIcons[m.id as GenerationMode]}
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.label.split(' ')[0]}</span>
                    {m.disabled && <span className="ml-1 text-[10px]">🔒</span>}
                  </button>
                ))}

                {/* Favorites Tab */}
                <button
                  onClick={() => { 
                    setActiveTab('favorites');
                    // Clear prompt khi chuyển sang Favorites
                    setPrompt('');
                    setConceptPrompt('');
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-bold transition whitespace-nowrap ${activeTab === 'favorites' ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg scale-105' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <span className="hidden sm:inline">Favorites</span>
                </button>
              </div>

              {/* Right Controls (Dark Mode & Assistant Toggle) */}
              <div className="flex items-center gap-2 absolute right-4 top-4 md:relative md:right-0 md:top-0">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="rounded-full bg-white/10 p-2 text-white">
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
              </div>

            </div>
          </div>

          {/* Scrollable Workspace */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide relative z-0">
            <div className="mx-auto max-w-6xl space-y-8 pb-20">

              {/* --- INPUT SECTION (Hidden in Favorites) --- */}
              {activeTab !== 'favorites' && (
                <div className="glass-panel rounded-3xl p-4 sm:p-6 shadow-2xl animate-[fadeIn_0.5s_ease-out]">

                  {/* 1. CREATIVE MODE UI */}
                  {mode === GenerationMode.CREATIVE && (
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                        {/* Reference Image Section (Large) */}
                        <div className="w-full md:w-5/12 space-y-2">
                          <ImageUploader
                            images={referenceImages}
                            onImagesSelected={handleAddRefImages}
                            onRemoveImage={handleRemoveRefImage}
                            onClearAll={handleClearRefImages}
                            onCrop={(img, cb) => triggerCrop(img, cb)}
                            label="Ảnh Tham Khảo (Optional)"
                            placeholder="Thêm ảnh mẫu"
                          />
                        </div>
                        <div className="w-full md:w-7/12 flex flex-col gap-4">
                          <div>
                            <label className="mb-2 block text-xs font-bold text-slate-300 uppercase">Mô tả ý tưởng</label>
                            <textarea
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              placeholder="Mô tả chi tiết hình ảnh bạn muốn tạo..."
                              className="h-32 sm:h-40 w-full rounded-2xl border border-white/20 bg-black/20 p-4 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition resize-none text-sm"
                            />
                          </div>

                          {/* --- T-SHIRT COLOR INPUT --- */}
                          {selectedStyle === GenerationStyle.TSHIRT_DESIGN && (
                            <div className="animate-[fadeIn_0.3s_ease-out]">
                              <label className="mb-2 block text-xs font-bold text-brand-300 uppercase">Màu nền mong muốn</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={tshirtColor}
                                  onChange={(e) => setTshirtColor(e.target.value)}
                                  placeholder="VD: Xanh đậm, Đen... (Nền ảnh kết quả)"
                                  className="w-full rounded-xl border border-white/20 bg-black/20 p-3 text-white text-sm placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition"
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-slate-400">AI sẽ tạo ảnh với màu nền bạn nhập ở trên.</p>
                            </div>
                          )}

                          {/* Preservation Toggles */}
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: 'Giữ Khuôn Mặt', state: keepFace, set: setKeepFace },
                              { label: 'Giữ Dáng Pose', state: preservePose, set: setPreservePose },
                              { label: 'Giữ Cấu Trúc', state: preserveStructure, set: setPreserveStructure },
                            ].map((t) => (
                              <button
                                key={t.label}
                                onClick={() => t.set(!t.state)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${t.state ? 'bg-brand-500 border-brand-500 text-white' : 'bg-transparent border-white/20 text-slate-300 hover:bg-white/10'}`}
                              >
                                <span className={t.state ? 'text-white' : 'text-transparent'}>✓</span> {t.label}
                              </button>
                            ))}
                          </div>

                          {/* Skin Beauty Slider */}
                          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-300">✨ Làn Da Đẹp</span>
                                <span className="text-[10px] text-slate-500">(Beauty Skin)</span>
                              </div>
                              <button
                                onClick={() => setSkinBeautyEnabled(!skinBeautyEnabled)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${skinBeautyEnabled ? 'bg-brand-500' : 'bg-slate-600'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${skinBeautyEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                              </button>
                            </div>
                            
                            {skinBeautyEnabled && (
                              <div className="space-y-2 animate-[fadeIn_0.3s_ease-out]">
                                <div className="flex justify-between text-[10px] text-slate-400">
                                  <span>😐 Tự nhiên</span>
                                  <span>😊 Trung bình</span>
                                  <span>✨ Bóng mịn</span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  value={skinBeautyLevel}
                                  onChange={(e) => setSkinBeautyLevel(Number(e.target.value))}
                                  className="w-full h-2 bg-gradient-to-r from-slate-600 via-brand-500 to-pink-500 rounded-lg appearance-none cursor-pointer"
                                  style={{
                                    background: `linear-gradient(to right, #475569 0%, #0ea5e9 50%, #ec4899 100%)`
                                  }}
                                />
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-500">Mức độ:</span>
                                  <span className="text-lg font-bold text-brand-400">{skinBeautyLevel}/10</span>
                                </div>
                                <p className="text-[10px] text-slate-500 italic">
                                  {skinBeautyLevel <= 3 ? '💡 Da tự nhiên, ít chỉnh sửa' : 
                                   skinBeautyLevel <= 6 ? '💡 Da mịn màng, giảm khuyết điểm' : 
                                   '💡 Da bóng mịn như gương, hoàn hảo'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. COPY IDEA MODE UI - COMPACT LAYOUT UPDATED */}
                  {mode === GenerationMode.COPY_IDEA && (
                    <div className="space-y-6">
                      {/* Forced Grid-cols-2 for compact side-by-side view even on medium screens */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 relative">
                        {/* Swap Button */}
                        <button
                          onClick={handleSwapConceptSubject}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-slate-800 border border-slate-600 text-white shadow-xl flex items-center justify-center hover:bg-brand-600 transition"
                          title="Đổi chỗ Concept & Subject"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>

                        {/* Concept Section */}
                        <div className="space-y-2 p-2 sm:p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-brand-300 uppercase truncate">1. Style (Max 3)</span>
                            <span className="text-[10px] text-slate-400">{conceptStrength}%</span>
                          </div>
                          <div className="flex-1 min-h-[100px]">
                            <ImageUploader
                              images={conceptImages}
                              maxImages={3}
                              onImagesSelected={handleAddConceptImages}
                              onRemoveImage={handleRemoveConceptImage}
                              onClearAll={handleClearConceptImages}
                              onCrop={(img, cb) => triggerCrop(img, cb)}
                              placeholder="Tải Concept"
                            />
                          </div>
                          <input
                            type="range" min="0" max="100" value={conceptStrength}
                            onChange={(e) => setConceptStrength(Number(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                          />
                          <textarea
                            value={conceptPrompt}
                            onChange={(e) => setConceptPrompt(e.target.value)}
                            placeholder="Ghi chú thêm..."
                            className="w-full h-12 sm:h-16 rounded-xl bg-black/20 border-white/10 text-[10px] sm:text-xs p-2 text-white placeholder-white/30 resize-none focus:bg-black/40 outline-none"
                          />
                        </div>

                        {/* Subject Section */}
                        <div className="space-y-2 p-2 sm:p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-blue-300 uppercase truncate">2. Subject (Chủ thể)</span>
                            <span className="text-[10px] text-slate-400">{subjectStrength}%</span>
                          </div>
                          <div className="flex-1 min-h-[100px]">
                            <ImageUploader
                              images={subjectImages}
                              maxImages={3}
                              onImagesSelected={handleAddSubjectImages}
                              onRemoveImage={handleRemoveSubjectImage}
                              onClearAll={handleClearSubjectImages}
                              onCrop={(img, cb) => triggerCrop(img, cb)}
                              placeholder="Tải Subject"
                            />
                          </div>
                          <input
                            type="range" min="0" max="100" value={subjectStrength}
                            onChange={(e) => setSubjectStrength(Number(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Mô tả chủ thể..."
                            className="w-full h-12 sm:h-16 rounded-xl bg-black/20 border-white/10 text-[10px] sm:text-xs p-2 text-white placeholder-white/30 resize-none focus:bg-black/40 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. VIDEO MODE UI */}
                  {mode === GenerationMode.VIDEO && (
                    <div className="space-y-6">
                      {/* Video Type Tabs */}
                      <div className="flex justify-center mb-6 overflow-x-auto pb-1 scrollbar-hide">
                        <div className="flex bg-black/30 p-1 rounded-xl whitespace-nowrap">
                          {[
                            { id: VideoType.TEXT_TO_VIDEO, label: 'Text to Video' },
                            { id: VideoType.IMAGE_TO_VIDEO, label: 'Image to Video' },
                            { id: VideoType.FRAMES, label: 'Start & End Frame' },
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setVideoType(t.id as VideoType)}
                              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition ${videoType === t.id ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Image Inputs */}
                        {(videoType !== VideoType.TEXT_TO_VIDEO) && (
                          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-5/12">
                            <div className="flex-1 space-y-2">
                              <label className="text-xs font-bold text-slate-400">Start Frame</label>
                              <ImageUploader
                                images={videoStartFrame ? [videoStartFrame] : []}
                                maxImages={1}
                                onImagesSelected={handleSetStartFrame}
                                onRemoveImage={handleRemoveStartFrame}
                                onClearAll={handleRemoveStartFrame}
                                onCrop={handleVideoCrop}
                                placeholder="Frame Bắt đầu"
                              />
                            </div>
                            {videoType === VideoType.FRAMES && (
                              <div className="flex-1 space-y-2">
                                <label className="text-xs font-bold text-slate-400">End Frame</label>
                                <ImageUploader
                                  images={videoEndFrame ? [videoEndFrame] : []}
                                  maxImages={1}
                                  onImagesSelected={handleSetEndFrame}
                                  onRemoveImage={handleRemoveEndFrame}
                                  onClearAll={handleRemoveEndFrame}
                                  onCrop={handleVideoCrop}
                                  placeholder="Frame Kết thúc"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Prompt & Settings */}
                        <div className={`w-full ${videoType === VideoType.TEXT_TO_VIDEO ? 'lg:w-full' : 'lg:w-7/12'} space-y-4`}>
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={videoType === VideoType.FRAMES ? "Mô tả chuyển động giữa 2 frame..." : "Mô tả video bạn muốn tạo..."}
                            className="h-32 sm:h-40 w-full rounded-2xl border border-white/20 bg-black/20 p-4 text-white placeholder-white/40 shadow-inner resize-none focus:bg-black/30 outline-none text-sm"
                          />
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="text-xs font-bold text-slate-400 block mb-1">Duration</label>
                              <select
                                value={videoDuration}
                                onChange={(e) => setVideoDuration(e.target.value as VideoDuration)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                              >
                                <option value="5s">5 Seconds</option>
                                <option value="10s">10 Seconds (Beta)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="checkbox" checked={keepOutfit} onChange={(e) => setKeepOutfit(e.target.checked)} className="accent-brand-500 rounded" />
                              Giữ Trang Phục
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="checkbox" checked={keepBackground} onChange={(e) => setKeepBackground(e.target.checked)} className="accent-brand-500 rounded" />
                              Giữ Background
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. EDIT MODE UI (Refactored for Outpainting Only) */}
                  {mode === GenerationMode.EDIT && (
                    <div className="mb-6 space-y-4">
                      {/* Image Upload Area */}
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Original Image (Ảnh gốc)</label>
                          <ImageUploader
                            images={editImage ? [editImage] : []}
                            onImagesSelected={(imgs) => setEditImage(imgs[0])}
                            onRemoveImage={() => { setEditImage(null); setMaskImage(null); }}
                            onClearAll={() => { setEditImage(null); setMaskImage(null); }}
                            maxImages={1}
                            onCrop={(img) => {
                              setCropState({
                                image: img,
                                aspectRatio: 0, // Free aspect for initial crop if needed, or fixed
                                isOutpaint: true, // Enable Outpaint Mode
                                callback: (cropped, mask) => {
                                  setEditImage(cropped);
                                  if (mask) setMaskImage(mask);
                                }
                              });
                            }}
                          />
                        </div>
                      </div>

                      {/* Prompt Input for Edit Mode */}
                      <div className="space-y-2">
                        <label className="mb-2 block text-xs font-bold text-slate-300 uppercase">Mô tả chỉnh sửa (Optional)</label>
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Mô tả cách bạn muốn chỉnh sửa ảnh... (Để trống sẽ tự động mở rộng ảnh)"
                          className="h-32 sm:h-40 w-full rounded-2xl border border-white/20 bg-black/20 p-4 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition resize-none text-sm"
                        />
                      </div>

                      {/* Outpaint Controls */}
                      {editImage && (
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-white">Tính năng Mở Rộng Ảnh (Outpainting)</h3>
                              <p className="text-xs text-slate-400 mt-1">AI sẽ tự động vẽ thêm chi tiết xung quanh ảnh gốc của bạn.</p>
                            </div>
                            <button
                              onClick={() => {
                                setCropState({
                                  image: editImage,
                                  aspectRatio: 16 / 9, // Default starting ratio
                                  isOutpaint: true,
                                  callback: (cropped, mask) => {
                                    setEditImage(cropped);
                                    if (mask) setMaskImage(mask);
                                  }
                                });
                              }}
                              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm3 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                              Chỉnh khung hình (Canvas)
                            </button>
                          </div>

                          {/* Visual Feedback for Mask */}
                          {maskImage && (
                            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg border border-emerald-400/20">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              Đã tạo vùng mở rộng thành công!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACTION BUTTON */}
                  <div className="mt-6 sm:mt-8">
                    <button
                      onClick={handleGenerate}
                      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 py-3 sm:py-4 font-bold text-white shadow-neon transition-all hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 transition group-hover:opacity-100"></div>
                      <div className="relative flex items-center justify-center gap-2 text-lg">
                        {mode === GenerationMode.VIDEO ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Generate Video</>
                        ) : mode === GenerationMode.EDIT ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> Execute Edit</>
                        ) : (
                          <><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generate Design</>
                        )}
                      </div>
                    </button>
                  </div>

                </div>
              )}

              {/* --- RESULTS SECTION (Optimized Grid) --- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {displayedTasks.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-400">
                    <p className="text-lg">Chưa có kết quả nào</p>
                    <p className="text-sm mt-2">Tạo ảnh đầu tiên của bạn!</p>
                  </div>
                )}
                {displayedTasks.length > 0 && displayedTasks.length === MAX_DISPLAYED_TASKS && (
                  <div className="col-span-full text-center py-2 text-xs text-slate-500">
                    Hiển thị {MAX_DISPLAYED_TASKS} kết quả mới nhất. Xóa bớt tasks cũ để xem thêm.
                  </div>
                )}
                {displayedTasks.map((task) => (
                    <div key={task.id} className="glass-panel group relative overflow-hidden rounded-3xl transition-all hover:-translate-y-1 hover:shadow-2xl">

                      {/* LOADING STATE: SOPHISTICATED LIGHT SWEEP ANIMATION */}
                      {task.status === 'processing' && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl transition-all duration-500 overflow-hidden pointer-events-auto">

                          {/* Full Card Light Sweep Effect */}
                          <div className="absolute inset-0 z-0 pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite_linear]"></div>
                          </div>

                          {/* Central Animated Loader */}
                          <div className="relative mb-8 z-10 pointer-events-none">
                            {/* Outer Ring */}
                            <div className="h-24 w-24 rounded-full border-2 border-slate-800"></div>

                            {/* Spinning Gradient Ring */}
                            <div className="absolute inset-0 h-24 w-24 rounded-full border-t-2 border-l-2 border-brand-500 animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>

                            {/* Inner Pulse */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-16 w-16 rounded-full bg-brand-500/10 animate-pulse flex items-center justify-center backdrop-blur-sm border border-brand-500/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Status Text */}
                          <div className="text-center space-y-2 px-6 max-w-full z-10 pointer-events-none">
                            <div className="flex flex-col items-center">
                              <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tighter font-mono">
                                {task.progress}%
                              </span>
                              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.3em] animate-pulse mt-1">
                                Generating
                              </span>
                            </div>

                            <div className="mt-4 py-2 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm max-w-[200px] mx-auto">
                              <p className="text-xs text-slate-300 truncate font-medium">
                                {task.config.prompt}
                              </p>
                            </div>
                          </div>

                          {/* Bottom Progress Line */}
                          <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none">
                            <div className="h-1 w-full bg-slate-800/50">
                              <div
                                className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-300 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out relative"
                                style={{ width: `${task.progress}%` }}
                              >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                              </div>
                            </div>
                          </div>

                          {/* Cancel Button - Chỉ hiện khi hover */}
                          <div className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelTask(task.id);
                              }}
                              className="p-2 rounded-full bg-red-600/90 hover:bg-red-700 text-white transition-all hover:scale-110 shadow-lg backdrop-blur-sm border border-red-500/30"
                              title="Hủy task"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Content */}
                      <div className="aspect-square w-full bg-black/40 relative">
                        {task.resultUrl ? (
                          task.config.mode === GenerationMode.VIDEO ? (
                            <video
                              src={task.resultUrl}
                              className="h-full w-full object-cover"
                              autoPlay muted loop playsInline
                              onClick={() => setPreviewTask(task)}
                            />
                          ) : (
                            <img
                              src={task.resultUrl}
                              className="h-full w-full object-cover cursor-pointer transition duration-700 group-hover:scale-110"
                              alt="Result"
                              loading="lazy"
                              onClick={() => setPreviewTask(task)}
                            />
                          )
                        ) : (
                          (task.status === 'failed' || task.status === 'cancelled') && (
                            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-red-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <p className="text-sm font-bold">{task.status === 'cancelled' ? 'Đã Hủy' : 'Generation Failed'}</p>
                              <p className="text-xs mt-1 opacity-80 break-words px-2 max-h-32 overflow-y-auto">
                                {(() => {
                                  if (!task.error) return 'Lỗi không xác định';
                                  if (typeof task.error === 'string') return task.error;
                                  // Handle object errors
                                  try {
                                    if (task.error?.message) return String(task.error.message);
                                    if (task.error?.error?.message) return String(task.error.error.message);
                                    const str = JSON.stringify(task.error);
                                    return str.length > 300 ? str.substring(0, 300) + '...' : str;
                                  } catch {
                                    return String(task.error);
                                  }
                                })()}
                              </p>
                            </div>
                          )
                        )}

                        {/* Overlay Info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                            {/* PROMPT INPUT (Hidden in Edit Mode) */}
                            {mode !== GenerationMode.EDIT && (
                              <div className="relative z-10">
                                <div className="flex justify-between mb-2">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {mode === GenerationMode.VIDEO ? 'Video Description' : 'Prompt / Description'}
                                  </label>
                                  {mode === GenerationMode.CREATIVE && (
                                    <button
                                      onClick={() => setPrompt(prev => prev + " --v 6.0 --style raw")}
                                      className="text-[10px] text-brand-400 hover:text-brand-300"
                                    >
                                      + Add Parameters
                                    </button>
                                  )}
                                </div>
                                <div className="relative group">
                                  <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={mode === GenerationMode.VIDEO ? "Describe the video you want to generate..." : "Describe your idea..."}
                                    className="w-full h-32 rounded-2xl bg-slate-800/50 border border-slate-700 p-4 text-white placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none transition-all shadow-inner"
                                  />
                                  <div className="absolute bottom-3 right-3 flex gap-2">
                                    <button className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Voice Input">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 10.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-5v-2.07z" clipRule="evenodd" /></svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-end">
                              <div>
                                <div className="text-xs font-bold text-brand-300 mb-1 uppercase tracking-wider">{task.config.mode} • {task.config.style}</div>
                                <p className="line-clamp-2 text-sm opacity-90">{task.config.prompt}</p>
                              </div>
                              {task.elapsedSeconds && (
                                <div className="text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-1 rounded">
                                  {task.elapsedSeconds.toFixed(1)}s
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions - Always visible on small screens, hover on larger screens */}
                        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-wrap gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
                          {/* Reuse Task Button - Only show for completed tasks */}
                          {task.status === 'completed' && task.resultUrl && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReuseTask(task);
                              }} 
                              className="p-1.5 sm:p-2 rounded-full bg-purple-600/90 text-white hover:bg-purple-500 backdrop-blur-md transition-all hover:scale-110 shadow-lg active:scale-95"
                              title="Sử dụng lại cấu hình này (hình ảnh, settings, prompt)"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18C6.67 18 6 17.33 6 16.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.17 6 16 6s1.5.67 1.5 1.5S16.83 9 16 9z"/>
                              </svg>
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(task.id);
                            }} 
                            className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-all active:scale-95 ${task.isFavorite ? 'bg-red-500 text-white' : 'bg-black/60 text-white hover:bg-red-500'}`}
                            title={task.isFavorite ? "Bỏ thích" : "Yêu thích"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                          </button>
                          {task.resultUrl && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyImage(task.resultUrl!);
                              }} 
                              className="p-1.5 sm:p-2 rounded-full bg-black/60 text-white hover:bg-blue-500 backdrop-blur-md transition-all active:scale-95"
                              title="Copy ảnh"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                            </button>
                          )}
                          {task.resultUrl && (
                            <a 
                              href={task.resultUrl} 
                              download 
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 sm:p-2 rounded-full bg-black/60 text-white hover:bg-brand-500 backdrop-blur-md transition-all active:scale-95"
                              title="Tải về"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </a>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }} 
                            className="p-1.5 sm:p-2 rounded-full bg-black/60 text-white hover:bg-red-600 backdrop-blur-md transition-all active:scale-95"
                            title="Xóa"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR - PROMPT ASSISTANT (ALWAYS VISIBLE - FIXED HEIGHT) */}
        <div 
          className="hidden md:flex flex-col shrink-0 overflow-hidden relative" 
          style={{ 
            width: `${rightPanelWidth}px`, 
            minWidth: '200px', 
            maxWidth: '600px',
            height: '100vh', 
            position: 'sticky', 
            top: 0, 
            maxHeight: '100vh' 
          }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-500/50 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingRight(true);
            }}
            style={{ cursor: 'col-resize' }}
          />
          <PromptAssistant
            onApplyPrompt={(newPrompt) => setPrompt(newPrompt)}
          />
        </div>

      </div>

      {/* MODALS */}
      {previewTask && (
          <ImagePreviewModal
            task={previewTask}
            onClose={() => setPreviewTask(null)}
            onToggleFavorite={handleToggleFavorite}
            onEdit={(task) => {
              setPreviewTask(null);
              // Switch to Edit Mode
              setActiveTab('edit');
              setMode(GenerationMode.EDIT);
              setEditType(EditType.OUTPAINT); // Default to Outpaint as requested

              // Set image as editImage
              // We need to convert the resultUrl (data:image...) back to UploadedImage structure
              if (task.resultUrl) {
                const mimeType = task.resultUrl.split(';')[0].split(':')[1];
                const base64 = task.resultUrl.split(',')[1];
                const img = {
                  id: Date.now().toString(),
                  base64: base64,
                  mimeType: mimeType
                };
                setEditImage(img);

                // Open Cropper immediately for Outpaint
                setTimeout(() => {
                  setCropState({
                    image: img,
                    aspectRatio: 16 / 9,
                    isOutpaint: true,
                    callback: (cropped, mask) => {
                      setEditImage(cropped);
                      if (mask) setMaskImage(mask);
                    }
                  });
                }, 100);
              }
            }}
          />
        )}

        {cropState && (
          <ImageCropperModal
            image={cropState.image}
            aspectRatio={cropState.aspectRatio}
            isOutpaintMode={cropState.isOutpaint} // Pass mode
            onConfirm={(cropped, mask) => {
              cropState.callback(cropped, mask);
              setCropState(null);
            }}
            onCancel={() => setCropState(null)}
          />
        )}

        {isEditingMask && editImage && (
          <MaskEditor
            image={editImage}
            onSave={handleMaskSave}
            onCancel={handleMaskCancel}
            isUpscaleMode={editType === EditType.UPSCALE}
          />
        )}

        {/* Update Dialog */}
        {window.electronAPI?.update && (
          <UpdateDialog
            isOpen={showUpdateDialog}
            onClose={() => setShowUpdateDialog(false)}
          />
        )}

        {/* Banana Pro Lock Dialog */}
        {showBananaProLock && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-panel relative w-full max-w-md rounded-3xl border border-white/20 p-6 shadow-2xl">
              {/* Close Button */}
              <button
                onClick={() => setShowBananaProLock(false)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 to-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Mở Khóa Nano Banana Pro</h2>
                <p className="mt-2 text-sm text-slate-400">Nhập mã để sử dụng mô hình này</p>
              </div>

              {/* Code Input */}
              <BananaProUnlockDialog
                onUnlock={(success) => {
                  if (success) {
                    setBananaProUnlocked(true);
                    localStorage.setItem('banana_pro_unlocked', 'true');
                    // Reset counter khi unlock
                    setBananaProUsageCount(0);
                    localStorage.removeItem('banana_pro_usage_count');
                    setSelectedModel(GenerationModel.GEMINI_PRO);
                    setShowBananaProLock(false);
                  }
                }}
                onClose={() => setShowBananaProLock(false)}
              />
            </div>
          </div>
        )}

      </div>
    );
};

export default App;
