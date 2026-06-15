import { useState, useEffect } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import type { Engine } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "./ThemeProvider";

const initParticles = async (engine: Engine) => {
  await loadSlim(engine);
};

export const ParticleBackground = () => {
  return null;
};


