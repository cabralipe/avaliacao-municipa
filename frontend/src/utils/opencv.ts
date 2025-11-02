declare global {
  interface Window {
    cv?: any;
    __opencvPending?: Array<(value: unknown) => void>;
  }
}

export async function loadOpenCv(): Promise<any> {
  if (window.cv) {
    return window.cv;
  }

  if (window.__opencvPending) {
    return new Promise((resolve, reject) => {
      window.__opencvPending?.push(resolve);
      setTimeout(() => reject(new Error('Timeout loading OpenCV')), 30000);
    }) as Promise<typeof window.cv>;
  }

  return new Promise((resolve, reject) => {
    window.__opencvPending = [];

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      reject(new Error('Falha ao carregar opencv.js'));
      window.__opencvPending = undefined;
    };

    script.onload = () => {
      if (!window.cv) {
        reject(new Error('OpenCV não disponível após carregar script.'));
        return;
      }
      window.cv['onRuntimeInitialized'] = () => {
        resolve(window.cv!);
        window.__opencvPending?.forEach((cb) => cb(window.cv));
        window.__opencvPending = undefined;
      };
    };

    document.head.appendChild(script);
  }) as Promise<any>;
}
