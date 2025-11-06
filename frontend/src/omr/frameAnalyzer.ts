import { loadOpenCv } from '../utils/opencv';
import { analyzeOmrImage, NormalizedRect, OmrAnalysisResult } from './analysis';

const GRID_COLUMNS_MM = [22, 14, 14, 14, 14, 14];
const GRID_PADDING_MM = { top: 20, bottom: 20, left: 22, right: 22 } as const;
const ROW_HEIGHT_MM = 11;
const MARKER_SIZE_MM = 14;
const MARKER_OFFSET_MM = 12;
const PX_PER_MM = 10;

const GRID_INNER_WIDTH_MM = GRID_COLUMNS_MM.reduce((acc, value) => acc + value, 0);
const TOTAL_WIDTH_MM = GRID_INNER_WIDTH_MM + GRID_PADDING_MM.left + GRID_PADDING_MM.right;

const clamp01 = (value: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
};

const computeTotalHeightMm = (rows: number) =>
  GRID_PADDING_MM.top + GRID_PADDING_MM.bottom + ROW_HEIGHT_MM * rows;

const computeNormalizedGridArea = (rows: number): NormalizedRect => {
  const totalHeightMm = computeTotalHeightMm(rows);
  return {
    top: GRID_PADDING_MM.top / totalHeightMm,
    left: GRID_PADDING_MM.left / TOTAL_WIDTH_MM,
    width: GRID_INNER_WIDTH_MM / TOTAL_WIDTH_MM,
    height: (ROW_HEIGHT_MM * rows) / totalHeightMm,
  };
};

const detectAnswerGridBounds = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): NormalizedRect | null => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const step = Math.max(4, Math.floor(Math.min(width, height) / 220));
  const verticalStart = Math.floor(height * 0.18);
  const horizontalPadding = Math.floor(width * 0.04);
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasSamples = false;

  for (let y = verticalStart; y < height; y += step) {
    for (let x = horizontalPadding; x < width - horizontalPadding; x += step) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (brightness < 0.7) {
        hasSamples = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasSamples || maxX <= minX || maxY <= minY) {
    return null;
  }

  const marginX = Math.floor((maxX - minX) * 0.05);
  const marginY = Math.floor((maxY - minY) * 0.05);
  minX = Math.max(minX - marginX, 0);
  minY = Math.max(minY - marginY, 0);
  maxX = Math.min(maxX + marginX, width - 1);
  maxY = Math.min(maxY + marginY, height - 1);

  return {
    top: clamp01(minY / height),
    left: clamp01(minX / width),
    width: clamp01((maxX - minX) / width),
    height: clamp01((maxY - minY) / height),
  };
};

const attemptPerspectiveNormalization = async (
  baseCanvas: HTMLCanvasElement,
  rows: number
): Promise<{ canvas: HTMLCanvasElement; normalizedArea: NormalizedRect } | null> => {
  try {
    const cv = await loadOpenCv();
    const src = cv.imread(baseCanvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    const blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    const binary = new cv.Mat();
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      35,
      12
    );
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    type MarkerCandidate = {
      center: { x: number; y: number };
      size: number;
    };
    const markers: MarkerCandidate[] = [];

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = cv.contourArea(approx);
        if (area < src.cols * src.rows * 0.005) {
          approx.delete();
          contour.delete();
          continue;
        }
        const rect = cv.boundingRect(approx);
        const aspect = rect.width / rect.height;
        if (aspect < 0.75 || aspect > 1.25) {
          approx.delete();
          contour.delete();
          continue;
        }
        const moments = cv.moments(approx);
        if (moments.m00 === 0) {
          approx.delete();
          contour.delete();
          continue;
        }
        const center = {
          x: moments.m10 / moments.m00,
          y: moments.m01 / moments.m00,
        };
        markers.push({ center, size: (rect.width + rect.height) / 2 });
        approx.delete();
      } else {
        approx.delete();
      }
      contour.delete();
    }

    contours.delete();
    hierarchy.delete();
    binary.delete();
    blur.delete();
    gray.delete();

    if (markers.length < 4) {
      src.delete();
      return null;
    }

    const orderedMarkers = markers
      .sort((a, b) => b.size - a.size)
      .slice(0, 4)
      .sort((a, b) => a.center.y - b.center.y);

    const topPair = orderedMarkers.slice(0, 2).sort((a, b) => a.center.x - b.center.x);
    const bottomPair = orderedMarkers.slice(2, 4).sort((a, b) => a.center.x - b.center.x);
    const arranged = [topPair[0], topPair[1], bottomPair[0], bottomPair[1]];

    const avgMarkerSize = arranged.reduce((acc, marker) => acc + marker.size, 0) / arranged.length;
    const pxPerMm = avgMarkerSize / MARKER_SIZE_MM;
    const offsetPx = pxPerMm * (MARKER_OFFSET_MM - MARKER_SIZE_MM / 2);

    const srcPoints = [
      { x: arranged[0].center.x - offsetPx, y: arranged[0].center.y - offsetPx },
      { x: arranged[1].center.x + offsetPx, y: arranged[1].center.y - offsetPx },
      { x: arranged[2].center.x - offsetPx, y: arranged[2].center.y + offsetPx },
      { x: arranged[3].center.x + offsetPx, y: arranged[3].center.y + offsetPx },
    ];

    const totalHeightMm = computeTotalHeightMm(rows);
    const destWidth = Math.round(TOTAL_WIDTH_MM * PX_PER_MM);
    const destHeight = Math.round(totalHeightMm * PX_PER_MM);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      srcPoints[0].x,
      srcPoints[0].y,
      srcPoints[1].x,
      srcPoints[1].y,
      srcPoints[2].x,
      srcPoints[2].y,
      srcPoints[3].x,
      srcPoints[3].y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, destWidth, 0, 0, destHeight, destWidth, destHeight]);

    const transform = cv.getPerspectiveTransform(srcTri, dstTri);
    const warped = new cv.Mat();
    cv.warpPerspective(
      src,
      warped,
      transform,
      new cv.Size(destWidth, destHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    const warpCanvas = document.createElement('canvas');
    warpCanvas.width = destWidth;
    warpCanvas.height = destHeight;
    cv.imshow(warpCanvas, warped);

    warped.delete();
    transform.delete();
    srcTri.delete();
    dstTri.delete();
    src.delete();

    return {
      canvas: warpCanvas,
      normalizedArea: computeNormalizedGridArea(rows),
    };
  } catch (error) {
    console.error('Perspective normalization failed', error);
    return null;
  }
};

export interface FrameAnalysis {
  area: NormalizedRect;
  results: OmrAnalysisResult['results'];
  stats: OmrAnalysisResult['stats'];
}

export async function analyzeFrame(
  canvas: HTMLCanvasElement,
  questoesOrdem: number[]
): Promise<FrameAnalysis> {
  const rows = questoesOrdem.length;
  if (rows === 0) {
    return {
      area: computeNormalizedGridArea(1),
      results: [],
      stats: { mean: 0, stddev: 0, threshold: 0, samples: 0 },
    };
  }

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = canvas.width;
  baseCanvas.height = canvas.height;
  const ctx = baseCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas não suportado.');
  }
  ctx.drawImage(canvas, 0, 0);

  const detectedArea = detectAnswerGridBounds(ctx, baseCanvas.width, baseCanvas.height);
  let normalizedArea = detectedArea ?? computeNormalizedGridArea(rows);

  let workingCanvas = baseCanvas;
  let workingArea = normalizedArea;

  const warpResult = await attemptPerspectiveNormalization(baseCanvas, rows);
  if (warpResult) {
    workingCanvas = warpResult.canvas;
    workingArea = warpResult.normalizedArea;
  }

  const omrOutcome = await analyzeOmrImage(workingCanvas, questoesOrdem, {
    rows,
    columns: 5,
    normalizedArea: workingArea,
    sensitivity: 0.6,
  });

  return {
    area: workingArea,
    results: omrOutcome.results,
    stats: omrOutcome.stats,
  };
}
