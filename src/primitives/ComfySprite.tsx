import React from 'react';
import {Img, staticFile} from 'remotion';

export interface ComfySpriteProps {
  /** File name inside public/comfy_sprites/, e.g. `wukong_ink_stand_01.png`. */
  file: string;
  width?: number | string;
  height?: number | string;
  opacity?: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Static ComfyUI cut-out composited by Remotion.
 *
 * Never ask Remotion to generate or matte a character inline. The PNG must
 * already have a transparent alpha channel and be colour-graded at the source.
 */
export const ComfySprite: React.FC<ComfySpriteProps> = ({
  file,
  width,
  height,
  opacity = 1,
  style,
  className,
}) => (
  <Img
    src={staticFile(`comfy_sprites/${file}`)}
    alt=""
    aria-hidden="true"
    style={{
      width,
      height,
      opacity,
      objectFit: 'contain',
      filter: 'drop-shadow(0 24px 54px rgba(11,9,10,0.55))',
      pointerEvents: 'none',
      ...style,
    }}
    className={className}
  />
);
