import type { OcrWord } from "../ocr/types";
import type { Grid } from "./table";

/** One recognised page: the cleaned image (as shown), its words and the editable grid. */
export interface PageResult {
  page: number;
  imageUrl: string;
  width: number;
  height: number;
  /** Degrees the image was turned to straighten it. */
  skew: number;
  words: OcrWord[];
  grid: Grid;
}
