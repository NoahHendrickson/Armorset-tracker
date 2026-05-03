"use client";

import { Shader, Dither, SineWave } from "shaders/react";

/**
 * Full-viewport WebGPU/WebGL backdrop for the landing sign-in screen (shaders.com package).
 */
export function SignInShaderBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 min-h-[100dvh] w-full bg-[#212629] opacity-10"
      aria-hidden
    >
      <Shader
        className="h-full min-h-[100dvh] w-full"
        style={{ width: "100%", height: "100%", minHeight: "100dvh" }}
      >
        <Dither
          colorA="#ffffff"
          colorB="#212629"
          pattern="bayer8"
          pixelSize={8}
          threshold={0.32}
          visible={true}
        >
          <SineWave
            amplitude={0.1}
            angle={90}
            frequency={0.7}
            position={{
              x: 0,
              y: 0.5,
            }}
            softness={0.79}
            thickness={2}
          />
        </Dither>
      </Shader>
    </div>
  );
}
