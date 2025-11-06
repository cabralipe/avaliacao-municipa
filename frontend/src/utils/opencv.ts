declare global {
  interface Window {
    cvLoaded?: boolean;
    cv?: any;
    __opencvPending?: Array<(value: unknown) => void>;
  }
}

export async function loadOpenCv(): Promise<any> {
  if (window.cvLoaded && window.cv) {
    return window.cv;
  }

  if (window.__opencvPending) {
    return new Promise((resolve) => {
      window.__opencvPending?.push(resolve);
    });
  }

  window.__opencvPending = [];

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.onload = () => resolve();
    script.onerror = () => {
      reject(new Error('Falha ao carregar opencv.js'));
      window.__opencvPending = undefined;
    };
    document.body.appendChild(script);
  });

  await new Promise<void>((resolve) => {
    const check = () => {
      if (window.cv && window.cv.Mat) {
        window.cvLoaded = true;
        resolve();
      } else {
        window.requestAnimationFrame(check);
      }
    };
    check();
  });

  if (window.__opencvPending) {
    window.__opencvPending.forEach((cb) => cb(window.cv));
    window.__opencvPending = undefined;
  }

  return window.cv;
}

export function isOpenCvLoaded() {
  return Boolean(window.cvLoaded && window.cv);
}
