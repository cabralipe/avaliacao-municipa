import { loadOpenCv } from '../utils/opencv';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export interface NormalizedRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OmrAnalysisOptions {
  rows: number;
  columns: number;
  normalizedArea: NormalizedRect;
  scalePadding?: number;
  sensitivity?: number;
}

export interface OmrCellScore {
  letter: string;
  percent: number;
}

export interface OmrQuestionResult {
  ordem: number;
  detected: string | null;
  scores: OmrCellScore[];
}

export interface OmrAnalysisStats {
  mean: number;
  stddev: number;
  threshold: number;
  samples: number;
}

export interface OmrAnalysisResult {
  results: OmrQuestionResult[];
  stats: OmrAnalysisStats;
}

const DEFAULT_PADDING = 0.18;
const MARKED_THRESHOLD = 0.8;
const UNSURE_THRESHOLD = 0.72;
const UNSURE_DELTA = 0.07;

function clamp01(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export async function analyzeOmrImage(
  canvas: HTMLCanvasElement,
  questoesOrdem: number[],
  options: OmrAnalysisOptions
): Promise<OmrAnalysisResult> {
  const cv = await loadOpenCv();

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  const thresh = new cv.Mat();
  cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);

  const areaX = Math.floor(options.normalizedArea.left * src.cols);
  const areaY = Math.floor(options.normalizedArea.top * src.rows);
  const areaWidth = Math.floor(options.normalizedArea.width * src.cols);
  const areaHeight = Math.floor(options.normalizedArea.height * src.rows);

  const rows = options.rows;
  const columns = options.columns;
  const rowHeight = areaHeight / rows;
  const columnWidth = areaWidth / columns;
  const paddingFactor = options.scalePadding ?? DEFAULT_PADDING;

  const results: OmrQuestionResult[] = [];
  const allPercents: number[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const questionNumber = questoesOrdem[rowIndex] ?? rowIndex + 1;
    const scores: OmrCellScore[] = [];
    const top = Math.floor(areaY + rowIndex * rowHeight);
    const height = Math.max(4, Math.floor(rowHeight));
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const left = Math.floor(areaX + columnIndex * columnWidth);
      const width = Math.max(4, Math.floor(columnWidth));

      const padX = Math.floor(width * paddingFactor * 0.5);
      const padY = Math.floor(height * paddingFactor * 0.5);

      const roiX = Math.max(areaX, Math.min(left + padX, areaX + areaWidth - 4));
      const roiY = Math.max(areaY, Math.min(top + padY, areaY + areaHeight - 4));
      const roiW = Math.max(4, Math.min(width - padX * 2, areaX + areaWidth - roiX));
      const roiH = Math.max(4, Math.min(height - padY * 2, areaY + areaHeight - roiY));

      const rect = new cv.Rect(roiX, roiY, roiW, roiH);
      const cell = thresh.roi(rect);

      const white = cv.countNonZero(cell);
      const total = roiW * roiH;
      const percent = total > 0 ? white / total : 0;

      cell.delete();

      allPercents.push(percent);
      scores.push({
        letter: LETTERS[columnIndex] ?? String(columnIndex + 1),
        percent,
      });
    }

    results.push({
      ordem: questionNumber,
      detected: null,
      scores,
    });
  }

  const samples = allPercents.length || 1;
  const mean = allPercents.reduce((acc, value) => acc + value, 0) / samples;
  const variance =
    allPercents.reduce((acc, value) => acc + (value - mean) ** 2, 0) / samples;
  const stddev = Math.sqrt(variance);

  const userThreshold = clamp01(options.sensitivity ?? 0);
  const baselineThreshold = clamp01(
    Math.max(mean + Math.max(stddev * 0.75, 0.12), userThreshold)
  );

  results.forEach((result) => {
    const sorted = result.scores.slice().sort((a, b) => b.percent - a.percent);
    const topScore = sorted[0];
    const runnerUp = sorted[1];

    if (!topScore) {
      result.detected = null;
      return;
    }

    const marked = topScore.percent >= Math.max(MARKED_THRESHOLD, baselineThreshold);
    const gapOk =
      !runnerUp || topScore.percent - runnerUp.percent >= Math.max(UNSURE_DELTA, stddev * 0.25);

    if (marked && gapOk) {
      result.detected = topScore.letter;
    } else if (topScore.percent >= UNSURE_THRESHOLD) {
      result.detected = null;
    } else {
      result.detected = null;
    }
  });

  src.delete();
  gray.delete();
  blurred.delete();
  thresh.delete();

  return {
    results,
    stats: {
      mean,
      stddev,
      threshold: baselineThreshold,
      samples: allPercents.length,
    },
  };
}
