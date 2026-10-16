import { getContext, setContext } from 'svelte';
import type { GpuEngine } from './gpuRenderer';
export type GpuContext = { engine: GpuEngine | null; presenting: boolean; error: string };
const KEY = Symbol('the-gates-pixi');
export const provideGpu = (context: GpuContext) => setContext(KEY, context);
export const useGpu = () => getContext<GpuContext>(KEY);
