// Native local-only modules are excluded from the Worker bundle.
export const db:any=null;
export const dataDirectory='';
export async function saveMedia(..._args:any[]):Promise<string>{throw new Error('Local storage unavailable in Worker');}
export async function readMedia(..._args:any[]):Promise<Buffer>{throw new Error('Local storage unavailable in Worker');}
export async function removeMedia(..._args:any[]):Promise<void>{throw new Error('Local storage unavailable in Worker');}
