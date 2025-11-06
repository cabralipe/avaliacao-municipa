from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence

import cv2
import numpy as np
import imutils
from imutils import contours
from imutils.perspective import four_point_transform

LETTERS = ["A", "B", "C", "D", "E"]


class OmrProcessingError(RuntimeError):
    """Raised when the OMR pipeline fails to read the answer sheet."""


@dataclass
class OmrCellScore:
    letter: str
    percent: float


@dataclass
class OmrQuestionResult:
    ordem: int
    caderno_questao_id: int
    detected: str | None
    scores: List[OmrCellScore]


@dataclass
class OmrAnalysisStats:
    mean: float
    stddev: float
    threshold: float
    samples: int


@dataclass
class OmrAnalysisResult:
    results: List[OmrQuestionResult]
    stats: OmrAnalysisStats
    detected_count: int


def _decode_image(image_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    if array.size == 0:
        raise OmrProcessingError("Imagem inválida ou vazia fornecida para leitura.")
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise OmrProcessingError("Não foi possível decodificar a imagem como um gabarito válido.")
    return image


def _find_document_contour(edged_image: np.ndarray) -> np.ndarray:
    cnts = cv2.findContours(edged_image.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = imutils.grab_contours(cnts)
    if not cnts:
        raise OmrProcessingError("Nenhum contorno maior foi identificado na imagem do gabarito.")

    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)
    for contour in cnts:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4:
            return approx
    raise OmrProcessingError(
        "Não foi possível identificar os quatro cantos do gabarito. Verifique o enquadramento."
    )


def _extract_bubble_contours(thresh_image: np.ndarray) -> List[np.ndarray]:
    cnts = cv2.findContours(thresh_image.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = imutils.grab_contours(cnts)
    question_cnts: List[np.ndarray] = []

    for contour in cnts:
        x, y, w, h = cv2.boundingRect(contour)
        if h == 0:
            continue
        aspect_ratio = w / float(h)
        if w >= 20 and h >= 20 and 0.8 <= aspect_ratio <= 1.3:
            question_cnts.append(contour)

    if not question_cnts:
        raise OmrProcessingError(
            "Nenhuma bolha de resposta foi identificada. Certifique-se de usar o gabarito padrão."
        )

    ordered, _ = contours.sort_contours(question_cnts, method="top-to-bottom")
    return list(ordered)


def _letter_for_index(index: int) -> str:
    if 0 <= index < len(LETTERS):
        return LETTERS[index]
    return str(index + 1)


def analyze_omr_image(
    image_bytes: bytes,
    questions: Sequence[tuple[int, int]],
    *,
    choices_per_question: int = 5,
) -> OmrAnalysisResult:
    if not questions:
        raise OmrProcessingError("Não há questões associadas a este caderno para analisar.")
    image = _decode_image(image_bytes)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    document_contour = _find_document_contour(edged)
    warped_gray = four_point_transform(gray, document_contour.reshape(4, 2))

    thresh = cv2.threshold(
        warped_gray,
        0,
        255,
        cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU,
    )[1]

    bubble_contours = _extract_bubble_contours(thresh)

    expected = len(questions) * choices_per_question
    if len(bubble_contours) < expected:
        raise OmrProcessingError(
            "Foram detectadas menos bolhas que o esperado. Confira se a imagem engloba toda a grade."
        )
    if len(bubble_contours) > expected:
        bubble_contours = bubble_contours[:expected]

    rows: List[List[np.ndarray]] = []
    for start in range(0, expected, choices_per_question):
        slice_cnts = bubble_contours[start : start + choices_per_question]
        ordered_row, _ = contours.sort_contours(slice_cnts, method="left-to-right")
        rows.append(list(ordered_row))

    temp_results: List[tuple[int, int, List[OmrCellScore]]] = []
    all_percents: List[float] = []

    for (ordem, cq_id), row_contours in zip(questions, rows):
        row_scores: List[OmrCellScore] = []
        for idx, contour in enumerate(row_contours):
            mask = np.zeros(thresh.shape, dtype="uint8")
            cv2.drawContours(mask, [contour], -1, 255, -1)
            masked = cv2.bitwise_and(thresh, thresh, mask=mask)
            total = float(cv2.countNonZero(masked))
            x, y, w, h = cv2.boundingRect(contour)
            area = float(max(w * h, 1))
            percent = total / area
            percent = float(np.clip(percent, 0.0, 1.0))
            letter = _letter_for_index(idx)
            row_scores.append(OmrCellScore(letter=letter, percent=percent))
            all_percents.append(percent)
        temp_results.append((ordem, cq_id, row_scores))

    samples = len(all_percents) or 1
    mean = float(sum(all_percents) / samples)
    variance = float(sum((value - mean) ** 2 for value in all_percents) / samples)
    stddev = float(np.sqrt(variance))
    threshold = float(max(mean + max(stddev * 0.75, 0.12), 0.55))
    gap_min = float(max(0.05, stddev * 0.25))

    results: List[OmrQuestionResult] = []
    detected_count = 0

    for ordem, cq_id, row_scores in temp_results:
        sorted_scores = sorted(row_scores, key=lambda item: item.percent, reverse=True)
        top = sorted_scores[0] if sorted_scores else None
        runner = sorted_scores[1] if len(sorted_scores) > 1 else None
        detected: str | None = None

        if top and top.percent >= threshold:
            if runner is None or top.percent - runner.percent >= gap_min:
                detected = top.letter

        if detected:
            detected_count += 1

        results.append(
            OmrQuestionResult(
                ordem=ordem,
                caderno_questao_id=cq_id,
                detected=detected,
                scores=row_scores,
            )
        )

    stats = OmrAnalysisStats(
        mean=mean,
        stddev=stddev,
        threshold=threshold,
        samples=len(all_percents),
    )

    return OmrAnalysisResult(results=results, stats=stats, detected_count=detected_count)
