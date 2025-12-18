// videoUtils.ts - Video Compression and Firebase Storage Upload Utilities
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Check if a media source is a Firebase Storage URL
 */
export const isStorageUrl = (src: string): boolean => {
    return src.includes('firebasestorage.googleapis.com') || src.startsWith('https://storage.googleapis.com');
};

/**
 * Check if a media source is a video
 */
export const isVideoSource = (src: string): boolean => {
    return src.startsWith('data:video') ||
        src.endsWith('.mp4') ||
        src.endsWith('.mov') ||
        src.endsWith('.webm') ||
        (isStorageUrl(src) && (src.includes('%2Fvideos%2F') || src.includes('/videos/')));
};

/**
 * Compress video using Canvas and MediaRecorder API
 * Reduces resolution to 720p and optimizes bitrate
 */
export const compressVideo = (
    file: File,
    onProgress?: (progress: number) => void
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
            // Target resolution: 720p max
            const MAX_WIDTH = 1280;
            const MAX_HEIGHT = 720;

            let width = video.videoWidth;
            let height = video.videoHeight;

            // Scale down if necessary
            if (width > MAX_WIDTH) {
                height = (height * MAX_WIDTH) / width;
                width = MAX_WIDTH;
            }
            if (height > MAX_HEIGHT) {
                width = (width * MAX_HEIGHT) / height;
                height = MAX_HEIGHT;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;

            // Use lower bitrate for compression
            const stream = canvas.captureStream(30); // 30 fps

            // Try WebM first, fallback to other formats
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'video/mp4';
                    }
                }
            }

            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 1500000 // 1.5 Mbps for good quality/size balance
            });

            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onstop = () => {
                URL.revokeObjectURL(url);
                const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                resolve(blob);
            };

            recorder.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };

            // Start recording
            recorder.start();
            video.currentTime = 0;

            const duration = video.duration;
            let lastProgress = 0;

            const drawFrame = () => {
                if (video.ended || video.paused) {
                    recorder.stop();
                    return;
                }

                ctx.drawImage(video, 0, 0, width, height);

                // Report progress
                if (onProgress) {
                    const progress = Math.min(50, (video.currentTime / duration) * 50); // First 50% is compression
                    if (progress - lastProgress >= 5) {
                        onProgress(progress);
                        lastProgress = progress;
                    }
                }

                requestAnimationFrame(drawFrame);
            };

            video.onended = () => {
                recorder.stop();
            };

            video.play().then(() => {
                drawFrame();
            }).catch(reject);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Video yüklenirken hata oluştu.'));
        };
    });
};

/**
 * Upload video to Firebase Storage
 * Returns the download URL
 */
export const uploadVideoToStorage = async (
    file: File | Blob,
    userId: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = file instanceof File
        ? file.name.split('.').pop() || 'webm'
        : 'webm';
    const filename = `videos/${userId}/${timestamp}_${randomId}.${extension}`;

    const storageRef = ref(storage, filename);

    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'video/webm'
    });

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                // Progress: 50-100% is upload (first 50% was compression)
                const uploadProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 50;
                if (onProgress) {
                    onProgress(50 + uploadProgress);
                }
            },
            (error) => {
                console.error('Upload error:', error);
                reject(new Error('Video yüklenirken hata oluştu: ' + error.message));
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    if (onProgress) onProgress(100);
                    resolve(downloadURL);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
};

/**
 * Process video: compress and upload to Firebase Storage
 * Returns the download URL
 */
export const processAndUploadVideo = async (
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    // Step 1: Compress video
    if (onProgress) onProgress(0);
    const compressedBlob = await compressVideo(file, onProgress);

    // Log compression results
    const originalSize = file.size / 1024 / 1024;
    const compressedSize = compressedBlob.size / 1024 / 1024;
    console.log(`Video compressed: ${originalSize.toFixed(2)}MB -> ${compressedSize.toFixed(2)}MB (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% reduction)`);

    // Step 2: Upload to Firebase Storage
    const downloadURL = await uploadVideoToStorage(compressedBlob, userId, onProgress);

    return downloadURL;
};
