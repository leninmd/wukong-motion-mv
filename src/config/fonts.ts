import {staticFile} from 'remotion';
import {FONT_STACKS} from './theme';

/**
 * Extracted from the original `@font-face` block and `document.fonts.ready`
 * boot gate. Font files are optional until art direction locks the typefaces;
 * missing local files must never deadlock a render.
 */
export interface ProjectFont {
  family: string;
  file: string;
  weight: string;
  style?: 'normal' | 'italic' | 'oblique';
}

export const PROJECT_FONTS: ProjectFont[] = [
  {
    family: 'Noto Serif SC',
    file: 'fonts/NotoSerifSC-VF.ttf',
    weight: '200 900',
    style: 'normal',
  },
  {
    family: 'Source Han Serif SC Heavy',
    file: 'fonts/SourceHanSerifSC-Heavy.ttf',
    weight: '400 900',
    style: 'normal',
  },
  {
    family: 'LXGW WenKai',
    file: 'fonts/LXGWWenKai-Regular.ttf',
    weight: '300 700',
    style: 'normal',
  },
  {
    family: 'Ma Shan Zheng',
    file: 'fonts/MaShanZheng-Regular.ttf',
    weight: '400',
    style: 'normal',
  },
];

export interface FontLoadResult {
  loaded: string[];
  skipped: string[];
}

/**
 * Loads every available project font into the document font set.
 *
 * Call from a component wrapped by Remotion's delayRender/continueRender if a
 * scene depends on exact metrics. Failures are non-fatal so a missing optional
 * face can fall back to the system stack instead of stopping the render.
 */
export const loadProjectFonts = async (
  fonts: ProjectFont[] = PROJECT_FONTS,
): Promise<FontLoadResult> => {
  const result: FontLoadResult = {loaded: [], skipped: []};

  if (typeof document === 'undefined') {
    return {loaded: [], skipped: fonts.map((font) => font.family)};
  }

  await Promise.all(
    fonts.map(async (font) => {
      try {
        const face = new FontFace(font.family, `url(${staticFile(font.file)})`, {
          weight: font.weight,
          style: font.style ?? 'normal',
          display: 'block',
        });
        await face.load();
        document.fonts.add(face);
        result.loaded.push(font.family);
      } catch {
        result.skipped.push(font.family);
      }
    }),
  );

  return result;
};

export const font = (size: number, family: string = FONT_STACKS.song): string =>
  `${Math.round(size)}px ${family}`;

export const heavyFont = (size: number, weight = 900): string =>
  `${weight} ${Math.round(size)}px ${FONT_STACKS.heavy}`;
